import { useEffect, useRef, useState } from 'react'
import { attachEngine, detectType, type Engine } from '../lib/engines'
import { attachTranscode, canTranscode, needsTranscode, probe } from '../lib/transcode'
import { isProOpen, onProOpen } from '../lib/pro'
import { dropRoute, unrouted } from '../lib/net'

// Attach the right engine to a <video>, with automatic fallback between formats.
export function useEngine(videoRef: React.RefObject<HTMLVideoElement>, wantUrl: string | undefined, live: boolean) {
  // Pro player open → this player lets go of the stream (the line has one connection), and resumes after
  const [proOn, setProOn] = useState(isProOpen())
  useEffect(() => onProOpen(setProOn), [])
  const url = proOn ? undefined : wantUrl
  const [error, setError] = useState('')
  const [engine, setEngine] = useState<Engine | null>(null)
  const [tracksTick, setTick] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [noAudio, setNoAudio] = useState(false)
  const [noVideo, setNoVideo] = useState(false)
  const engRef = useRef<Engine | null>(null)
  // Laptop app: Dolby / DTS sound → ffmpeg converts the sound so the built-in player has sound
  const [txFor, setTxFor] = useState('')

  useEffect(() => {
    const v = videoRef.current
    if (!v || !url) return
    let dead = false
    setError('')
    setNoAudio(false)
    setNoVideo(false)
    // Playing but no sound decoded → Dolby/DTS sound; sound but no picture → HEVC/H.265 or a format the
    // device's web engine can't show (old Firesticks). Both play fine in the Pro player.
    let aBad = 0
    let vBad = 0
    let ticks = 0
    const tx = canTranscode()
    let txOn = false
    const audioCheck = setInterval(() => {
      if (v.paused || v.currentTime < 2) return
      if (++ticks > 6) return clearInterval(audioCheck)
      const dec = (v as any).webkitAudioDecodedByteCount
      const vdec = (v as any).webkitVideoDecodedByteCount
      if (dec === 0 && ++aBad === 2 && !dead) {
        if (tx && !txOn) return clearInterval(audioCheck), setTxFor(url)
        setNoAudio(true)
      }
      if ((v.videoWidth === 0 || vdec === 0) && ++vBad === 2 && !dead) {
        if (tx && !txOn) return clearInterval(audioCheck), setTxFor(url)
        setNoVideo(true)
      }
    }, 2500)
    const first = detectType(url, live ? 'live' : undefined)
    // Fallback order per first guess
    const order: { u: string; t: 'hls' | 'ts' | 'native'; plain?: boolean }[] = [{ u: url, t: first }]
    if (live && /\.ts(\?|$)/.test(url)) order.push({ u: url.replace(/\.ts(\?|$)/, '.m3u8$1'), t: 'hls' })
    if (live && /\.m3u8(\?|$)/.test(url)) order.push({ u: url.replace(/\.m3u8(\?|$)/, '.ts$1'), t: 'ts' })
    if (first === 'native') order.push({ u: url, t: 'hls' })
    if (first !== 'native') order.push({ u: url, t: 'native' })
    // The link was switched to the server's address (anti-block) and does not play → last try with the server's own
    // name: a proxy / shared server only answers to its name. If that plays, the switch is removed for this server.
    const plain = unrouted(url)
    if (plain) order.push({ u: plain, t: first, plain: true })
    let curPlain = false

    let step = 0
    // Once a format has played, a drop (server hiccup, Wi-Fi blip, stream restart) reconnects the SAME format
    // instead of trying other formats — IPTV servers often close a live stream every few minutes.
    let worked = false
    let reconnects = 0
    let lastGood = 0
    let reconnecting = false
    const attach = async (o: { u: string; t: 'hls' | 'ts' | 'native'; plain?: boolean }, resumeAt = 0) => {
      curPlain = !!o.plain
      const e = await attachEngine(v, o.u, {
        live,
        type: o.t,
        onFatal: (m) => !dead && failed(m),
        onTracks: () => setTick((x) => x + 1),
      })
      if (dead) return e.destroy()
      engRef.current = e
      setEngine(e)
      if (resumeAt > 1) v.addEventListener('loadedmetadata', () => (v.currentTime = resumeAt), { once: true })
      v.play().catch(() => {
        /* autoplay may need a tap */
      })
    }
    const tryNext = async (why?: string) => {
      engRef.current?.destroy()
      engRef.current = null
      if (dead) return
      const o = order[step++]
      if (!o) {
        setError(why || 'This stream could not be played.')
        return
      }
      // Not the first try: the server needs a moment to free the line's connection (one connection per line —
      // a new try straight away is refused, and the stream looks "stopped")
      if (step > 1) await new Promise((r) => setTimeout(r, 1500))
      if (dead) return
      try {
        await attach(o)
      } catch (err: any) {
        tryNext(err?.message)
      }
    }
    const reconnect = async () => {
      if (dead || reconnecting) return
      if (Date.now() - lastGood > 60000) reconnects = 0 // played well for a minute → fresh retries
      if (++reconnects > 6) return setError('The stream stopped. Check your internet, then try again.')
      reconnecting = true
      const resumeAt = live ? 0 : v.currentTime
      engRef.current?.destroy()
      engRef.current = null
      await new Promise((r) => setTimeout(r, Math.min(1500 + 1500 * reconnects, 8000))) // let the server free the connection first
      reconnecting = false
      if (dead) return
      try {
        await attach(order[Math.max(0, step - 1)], resumeAt)
      } catch {
        reconnect()
      }
    }
    const failed = (why?: string) => (worked ? reconnect() : tryNext(why))
    const onPlaying = () => {
      worked = true
      lastGood = Date.now()
      if (curPlain) dropRoute(plain)
    }
    v.addEventListener('playing', onPlaying)
    // Frozen picture (no error, time not moving) for 12 s while it should be playing → reconnect
    let lastT = -1
    let frozenFor = 0
    const watchdog = setInterval(() => {
      if (dead || v.paused || !worked || reconnecting || !engRef.current) return (frozenFor = 0)
      if (v.currentTime !== lastT) {
        lastT = v.currentTime
        frozenFor = 0
        lastGood = Date.now()
        return
      }
      if ((frozenFor += 3) >= 12) {
        frozenFor = 0
        reconnect()
      }
    }, 3000)
    const onEnded = () => live && worked && reconnect() // a live channel never really ends
    v.addEventListener('ended', onEnded)
    const onErr = () => {
      const code = v.error?.code
      if (!v.getAttribute('src') && !engRef.current) return
      failed(code === 4 ? 'This format is not supported on this device. Try the Pro player button.' : 'Playback error.')
    }
    v.addEventListener('error', onErr)
    const onMeta = () => setTick((x) => x + 1)
    v.addEventListener('loadedmetadata', onMeta)
    const start = async () => {
      if (tx) {
        const info = txFor === url ? await probe(url) : live ? null : await probe(url)
        if (dead) return
        if (txFor === url || needsTranscode(info)) {
          try {
            txOn = true
            const e = await attachTranscode(v, url, live, info)
            if (dead) return e.destroy()
            engRef.current = e
            setEngine(e)
            v.play().catch(() => {})
            return
          } catch {
            /* no ffmpeg → normal engine; a later no-sound check shows the Pro player button */
          }
        }
      }
      tryNext()
    }
    start()
    return () => {
      dead = true
      clearInterval(audioCheck)
      clearInterval(watchdog)
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('error', onErr)
      v.removeEventListener('loadedmetadata', onMeta)
      engRef.current?.destroy()
      engRef.current = null
      setEngine(null)
    }
  }, [url, live, attempt, txFor])

  return { engine, error, tracksTick, noAudio, noVideo, retry: () => setAttempt((a) => a + 1) }
}
