import { useEffect, useRef, useState } from 'react'
import { attachEngine, detectType, type Engine } from '../lib/engines'

// Attach the right engine to a <video>, with automatic fallback between formats.
export function useEngine(videoRef: React.RefObject<HTMLVideoElement>, url: string | undefined, live: boolean) {
  const [error, setError] = useState('')
  const [engine, setEngine] = useState<Engine | null>(null)
  const [tracksTick, setTick] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [noAudio, setNoAudio] = useState(false)
  const engRef = useRef<Engine | null>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v || !url) return
    let dead = false
    setError('')
    setNoAudio(false)
    // Picture plays but no sound is decoded → the sound is Dolby/DTS (not supported by the web engine)
    let checks = 0
    const audioCheck = setInterval(() => {
      const dec = (v as any).webkitAudioDecodedByteCount
      if (dec === undefined || v.paused || v.currentTime < 2) return
      if (dec > 0) return clearInterval(audioCheck)
      if (++checks >= 2) {
        clearInterval(audioCheck)
        if (!dead) setNoAudio(true)
      }
    }, 2500)
    const first = detectType(url, live ? 'live' : undefined)
    // Fallback order per first guess
    const order: { u: string; t: 'hls' | 'ts' | 'native' }[] = [{ u: url, t: first }]
    if (live && /\.ts(\?|$)/.test(url)) order.push({ u: url.replace(/\.ts(\?|$)/, '.m3u8$1'), t: 'hls' })
    if (live && /\.m3u8(\?|$)/.test(url)) order.push({ u: url.replace(/\.m3u8(\?|$)/, '.ts$1'), t: 'ts' })
    if (first === 'native') order.push({ u: url, t: 'hls' })
    if (first !== 'native') order.push({ u: url, t: 'native' })

    let step = 0
    const tryNext = async (why?: string) => {
      engRef.current?.destroy()
      engRef.current = null
      if (dead) return
      const o = order[step++]
      if (!o) {
        setError(why || 'This stream could not be played.')
        return
      }
      try {
        const e = await attachEngine(v, o.u, {
          live,
          type: o.t,
          onFatal: (m) => !dead && tryNext(m),
          onTracks: () => setTick((x) => x + 1),
        })
        if (dead) return e.destroy()
        engRef.current = e
        setEngine(e)
        v.play().catch(() => {
          /* autoplay may need a tap */
        })
      } catch (err: any) {
        tryNext(err?.message)
      }
    }
    const onErr = () => {
      const code = v.error?.code
      if (!v.getAttribute('src') && !engRef.current) return
      tryNext(code === 4 ? 'This format is not supported on this device. Try the Pro player button.' : 'Playback error.')
    }
    v.addEventListener('error', onErr)
    const onMeta = () => setTick((x) => x + 1)
    v.addEventListener('loadedmetadata', onMeta)
    tryNext()
    return () => {
      dead = true
      clearInterval(audioCheck)
      v.removeEventListener('error', onErr)
      v.removeEventListener('loadedmetadata', onMeta)
      engRef.current?.destroy()
      engRef.current = null
      setEngine(null)
    }
  }, [url, live, attempt])

  return { engine, error, tracksTick, noAudio, retry: () => setAttempt((a) => a + 1) }
}
