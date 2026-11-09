import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { useEngine } from './useEngine'
import { autoProOk, canPro, hasNativePro, playPro } from '../lib/pro'
import { Icon, Img, fmtDur, fmtTime, keyDir, moveFocus, progressOf, Spinner } from '../ui'
import { srtToVtt } from '../lib/engines'
import { episodeStream, streamFor } from '../lib/catalog'
import { epgCached, nowNext, programmesFor } from '../lib/epg'
import { xtShortEpg } from '../lib/xtream'
import type { Item, PlayRequest, Programme } from '../lib/types'
import { RecButton } from '../screens/Rec'

const BACK_KEYS = ['Escape', 'Backspace', 'GoBack', 'BrowserBack']
const BACK_CODES = [10009, 461, 8, 27]
type Menu = null | 'audio' | 'subs' | 'aspect' | 'speed' | 'quality' | 'sleep' | 'channels' | 'info'

export function Player() {
  const app = useApp()
  if (!app.player) return null
  return <PlayerView req={app.player} />
}

function PlayerView({ req }: { req: PlayRequest }) {
  const app = useApp()
  const { settings, active } = app
  const live = req.kind === 'live'
  const vod = !live
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const { engine, error, tracksTick, retry, noAudio: noSnd, noVideo } = useEngine(video, req.url, live)
  const noAudio = noSnd || noVideo

  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [buf, setBuf] = useState(0)
  const [muted, setMuted] = useState(false)
  const [vol, setVol] = useState(() => Number(localStorage.getItem('ip.vol') ?? 1))
  const [ui, setUi] = useState(true)
  const [menu, setMenu] = useState<Menu>(null)
  const [aspect, setAspect] = useState(settings.aspect)
  const [speed, setSpeed] = useState(1)
  const [sleepAt, setSleepAt] = useState(0)
  const [num, setNum] = useState('')
  const [isFull, setFull] = useState(false)
  const [epg, setEpg] = useState<Programme[]>([])
  const [nextIn, setNextIn] = useState<number | null>(null)
  const [extSub, setExtSub] = useState<string | null>(null)
  const hideT = useRef<any>(0)

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    app.play(null)
  }, [])

  // ——— Pro player (plays Dolby / DTS sound) ———
  const openPro = useCallback(async () => {
    const v = video.current
    const start = live ? 0 : v?.currentTime || req.startAt || 0
    v?.pause()
    try {
      const r = await playPro({ url: req.url, title: req.title + (req.subtitle ? ' — ' + req.subtitle : ''), start, live })
      if (r && !live && req.historyKey && req.history && r.pos > 3) app.saveHistory({ key: req.historyKey, ...req.history, pos: r.pos, dur: r.dur })
      if (hasNativePro()) close()
    } catch (e: any) {
      app.toast('Pro player: ' + (e?.message || e))
    }
  }, [req.url])
  const autoPro = useRef('')
  useEffect(() => {
    // Anything the built-in engine can't play (no sound, no picture, unsupported format) → Pro player
    // (Android app: built-in VLC engine · laptop: VLC when installed)
    if (!noAudio && !error) return
    if (autoPro.current === req.url) return
    autoPro.current = req.url
    autoProOk().then((ok) => {
      if (!ok) return
      app.toast(error ? 'Opening in the Pro player…' : noVideo ? 'This picture format needs the Pro player — switching' : 'This sound is Dolby/DTS — switching to the Pro player')
      openPro()
    })
  }, [noAudio, error])

  // ——— UI auto-hide ———
  const poke = useCallback(() => {
    setUi(true)
    clearTimeout(hideT.current)
    hideT.current = setTimeout(() => {
      if (!video.current?.paused) setUi(false)
    }, 4000)
  }, [])
  useEffect(() => {
    poke()
    return () => clearTimeout(hideT.current)
  }, [req.url])
  useEffect(() => {
    if (menu) clearTimeout(hideT.current)
    else poke()
  }, [menu])

  // ——— video events ———
  useEffect(() => {
    const v = video.current!
    v.volume = vol
    const on: Record<string, () => void> = {
      play: () => setPlaying(true),
      pause: () => (setPlaying(false), setUi(true)),
      waiting: () => setWaiting(true),
      playing: () => setWaiting(false),
      canplay: () => setWaiting(false),
      timeupdate: () => {
        setT(v.currentTime)
        if (v.buffered.length) setBuf(v.buffered.end(v.buffered.length - 1))
      },
      durationchange: () => setDur(isFinite(v.duration) ? v.duration : 0),
      volumechange: () => (setMuted(v.muted), setVol(v.volume), localStorage.setItem('ip.vol', String(v.volume))),
      ended: () => onEnded(),
      loadedmetadata: () => {
        if (req.startAt && req.startAt > 5 && isFinite(v.duration) && req.startAt < v.duration - 10) v.currentTime = req.startAt
        v.playbackRate = speed
      },
    }
    Object.entries(on).forEach(([k, f]) => v.addEventListener(k, f))
    return () => Object.entries(on).forEach(([k, f]) => v.removeEventListener(k, f))
  }, [req.url])

  // ——— history / resume ———
  useEffect(() => {
    if (!req.historyKey || !req.history) return
    const save = () => {
      const v = video.current
      if (!v) return
      app.saveHistory({ key: req.historyKey!, ...req.history!, pos: live ? 0 : v.currentTime, dur: live ? 0 : v.duration || 0 })
    }
    if (live) {
      save()
      localStorage.setItem('ip.lastLive', JSON.stringify({ pid: active?.id, id: req.history.id }))
      return
    }
    const i = setInterval(() => video.current && video.current.currentTime > 3 && save(), 8000)
    return () => {
      clearInterval(i)
      if (video.current && video.current.currentTime > 3) save()
    }
  }, [req.url])

  // ——— Live EPG ———
  useEffect(() => {
    if (!live || !req.history) return
    const ch = req.channels?.[req.index ?? -1]
    const fromXml = programmesFor(epgCached(active!.id), ch?.epgId, ch?.name)
    if (fromXml.length) return setEpg(fromXml)
    setEpg([])
    if (active?.type === 'xtream' && ch)
      xtShortEpg(active, ch.id, 8)
        .then(setEpg)
        .catch(() => {})
  }, [req.url])
  const { now, next } = nowNext(epg, settings.epgOffset)

  // ——— Next episode ———
  const nextEp = req.episodes && req.episodes.list[req.episodes.index + 1]
  const playEpisode = (i: number) => {
    const E = req.episodes!
    const e = E.list[i]
    if (!e || !active) return
    app.play({
      ...req,
      title: E.seriesName,
      subtitle: `S${e.season} · E${e.episode} — ${e.title}`,
      url: episodeStream(active, e),
      historyKey: 'ep:' + e.id,
      history: { kind: 'episode', id: e.id, name: e.title, image: e.image || E.image, seriesId: E.seriesId, seriesName: E.seriesName, season: e.season, episode: e.episode },
      startAt: app.history['ep:' + e.id]?.pos || 0,
      episodes: { ...E, index: i },
    })
  }
  function onEnded() {
    if (nextEp && settings.autoplayNext) setNextIn(8)
    else if (!nextEp) setUi(true)
  }
  useEffect(() => {
    if (nextIn == null) return
    if (nextIn <= 0) {
      setNextIn(null)
      playEpisode(req.episodes!.index + 1)
      return
    }
    const id = setTimeout(() => setNextIn((n) => (n == null ? n : n - 1)), 1000)
    return () => clearTimeout(id)
  }, [nextIn])
  useEffect(() => setNextIn(null), [req.url])

  // ——— Zapping ———
  const zap = (delta: number) => {
    if (!req.channels || req.index == null) return
    const n = req.channels.length
    playChannel((req.index + delta + n) % n)
  }
  const playChannel = (i: number) => {
    const ch: Item | undefined = req.channels?.[i]
    if (!ch || !active) return
    app.play({
      ...req,
      title: ch.name,
      subtitle: settings.showNumbers ? `CH ${ch.num}` : undefined,
      url: streamFor(active, ch),
      image: ch.logo,
      historyKey: 'live:' + ch.id,
      history: { kind: 'live', id: ch.id, name: ch.name, image: ch.logo },
      index: i,
    })
  }
  useEffect(() => {
    if (!num) return
    const id = setTimeout(() => {
      const target = Number(num)
      setNum('')
      const i = req.channels?.findIndex((c) => c.num === target) ?? -1
      if (i >= 0) playChannel(i)
      else app.toast(`Channel ${target} not found`)
    }, 1600)
    return () => clearTimeout(id)
  }, [num])

  // ——— Sleep timer ———
  useEffect(() => {
    if (!sleepAt) return
    const id = setInterval(() => {
      if (Date.now() >= sleepAt) {
        video.current?.pause()
        app.toast('Sleep timer: playback stopped')
        close()
      }
    }, 5000)
    return () => clearInterval(id)
  }, [sleepAt])

  // ——— Controls ———
  const toggle = () => {
    const v = video.current!
    v.paused ? v.play().catch(() => {}) : v.pause()
  }
  const seek = (d: number) => {
    const v = video.current!
    if (!vod || !isFinite(v.duration)) return
    v.currentTime = Math.max(0, Math.min(v.duration - 1, v.currentTime + d))
    poke()
  }
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else {
        await root.current!.requestFullscreen()
        ;(screen.orientation as any)?.lock?.('landscape').catch(() => {})
      }
    } catch {
      ;(video.current as any)?.webkitEnterFullscreen?.()
    }
  }
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  const pip = async () => {
    const v: any = video.current
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else if (v.requestPictureInPicture) await v.requestPictureInPicture()
      else v.webkitSetPresentationMode?.('picture-in-picture')
    } catch {
      app.toast('Picture in Picture is not available here')
    }
  }
  const airplay = (video.current as any)?.webkitShowPlaybackTargetPicker
  const setRate = (r: number) => {
    setSpeed(r)
    video.current!.playbackRate = r
    setMenu(null)
  }

  // ——— Keyboard / TV remote ———
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const code = e.keyCode
      if (document.querySelector('.modal-wrap')) return
      if (BACK_KEYS.includes(e.key) || BACK_CODES.includes(code)) {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return
        e.preventDefault()
        e.stopPropagation()
        if (menu) setMenu(null)
        else if (ui && playing) setUi(false)
        else close()
        return
      }
      if (/^\d$/.test(e.key) && live) {
        setNum((n) => (n + e.key).slice(0, 4))
        return
      }
      const media: Record<number, () => void> = {
        415: () => video.current?.play(),
        19: () => video.current?.pause(),
        10252: toggle,
        179: toggle,
        413: close,
        417: () => seek(30),
        412: () => seek(-30),
        427: () => zap(1),
        428: () => zap(-1),
        33: () => zap(1),
        34: () => zap(-1),
      }
      if (media[code]) {
        e.preventDefault()
        media[code]()
        poke()
        return
      }
      const dir = keyDir(e)
      if (!ui && !menu) {
        if (dir === 'l' && vod) return e.preventDefault(), seek(-10)
        if (dir === 'r' && vod) return e.preventDefault(), seek(10)
        if (dir === 'u' && live) return e.preventDefault(), zap(-1)
        if (dir === 'd' && live) return e.preventDefault(), zap(1)
        if (e.key === ' ' || e.key === 'k') return e.preventDefault(), toggle()
        if (e.key === 'Enter' || dir) {
          e.preventDefault()
          poke()
          setTimeout(() => (root.current?.querySelector('.ctl-play') as HTMLElement)?.focus(), 20)
          return
        }
      }
      if (dir) {
        e.preventDefault()
        poke()
        const scope = root.current!.querySelector(menu ? '.p-menu' : '.p-chrome') || root.current!
        if (!moveFocus(dir, scope) && dir === 'u' && !menu) setUi(false)
        return
      }
      const isInput = (e.target as HTMLElement)?.tagName === 'INPUT'
      if (isInput) return
      if (e.key === ' ' || e.key === 'k') (e.preventDefault(), toggle())
      if (e.key === 'm') video.current!.muted = !video.current!.muted
      if (e.key === 'f') fullscreen()
      poke()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  })

  // ——— External subtitles ———
  const loadSub = (f: File) => {
    f.text().then((txt) => {
      const url = URL.createObjectURL(new Blob([srtToVtt(txt)], { type: 'text/vtt' }))
      setExtSub(url)
      setMenu(null)
      setTimeout(() => {
        const v = video.current!
        for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = v.textTracks[i].label === f.name ? 'showing' : 'disabled'
      }, 200)
    })
  }

  const audio = useMemo(() => engine?.audio() || { list: [], current: -1 }, [engine, tracksTick, menu])
  const subs = useMemo(() => engine?.subs() || { list: [], current: -1 }, [engine, tracksTick, menu, extSub])
  const quality = useMemo(() => engine?.quality() || { list: [], current: -1 }, [engine, tracksTick, menu])
  const pct = dur ? (t / dur) * 100 : 0
  const bpct = dur ? (buf / dur) * 100 : 0

  const progEl = useRef<HTMLDivElement>(null)
  const scrub = (clientX: number) => {
    const r = progEl.current!.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    if (dur) video.current!.currentTime = x * dur
  }

  return (
    <div
      ref={root}
      className={`player-root full sub-${settings.subSize} ${settings.subBg ? 'sub-bg' : ''} ${ui ? 'ui-on' : 'ui-off'}`}
      onMouseMove={poke}
      onTouchStart={poke}
    >
      <div className="p-stage" onClick={() => (menu ? setMenu(null) : ui ? toggle() : poke())} onDoubleClick={fullscreen}>
        <video ref={video} className={'p-video ar-' + aspect.replace(':', '')} playsInline autoPlay>
          {extSub && <track kind="subtitles" src={extSub} label="External" default />}
        </video>
      </div>

      {(waiting || !engine) && !error && (
        <div className="p-center">
          <Spinner size={46} />
        </div>
      )}
      {error && (
        <div className="p-center p-error glass">
          <Icon n="info" s={34} />
          <h3>Can’t play this stream</h3>
          <p>{error}</p>
          <div className="row gap">
            <button className="btn primary" onClick={retry} data-autofocus>
              <Icon n="refresh" s={18} /> Retry
            </button>
            <button className="btn" onClick={openPro}>
              <Icon n="play" s={18} /> {canPro() ? 'Pro player' : 'Open in VLC'}
            </button>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(req.url).then(() => app.toast('Stream link copied'))}>
              Copy link
            </button>
          </div>
        </div>
      )}
      {noAudio && !error && (
        <button className="p-noaudio glass" onClick={openPro}>
          <Icon n={noVideo ? 'tv' : 'mute'} s={18} /> {noVideo ? 'No picture? This video format needs' : 'No sound? This uses Dolby/DTS audio —'} <b>{canPro() ? 'the Pro player' : 'VLC'}</b>
        </button>
      )}
      {num && <div className="p-num glass">{num}</div>}

      {nextIn != null && nextEp && (
        <div className="p-next glass">
          <div className="muted small">Next episode in {nextIn}s</div>
          <div className="strong">S{nextEp.season} · E{nextEp.episode} — {nextEp.title}</div>
          <div className="row gap">
            <button className="btn primary" onClick={() => playEpisode(req.episodes!.index + 1)} data-autofocus>
              Play Now
            </button>
            <button className="btn" onClick={() => setNextIn(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="p-chrome" aria-hidden={!ui && !menu}>
        <div className="p-top">
          <button className="icon-btn big" onClick={close} aria-label="Back">
            <Icon n="back" />
          </button>
          {live && req.image && <Img className="p-logo" src={req.image} alt={req.title} />}
          <div className="p-titles">
            <div className="p-title">{req.title}</div>
            <div className="p-sub">
              {live ? (now ? now.title : req.subtitle) : req.subtitle}
              {req.kind === 'catchup' && <span className="badge">CATCH-UP</span>}
            </div>
          </div>
          <div className="p-top-actions">
            {airplay && (
              <button className="icon-btn" onClick={() => (video.current as any).webkitShowPlaybackTargetPicker()} aria-label="AirPlay">
                <Icon n="cast" />
              </button>
            )}
            <button className="icon-btn" onClick={pip} aria-label="Picture in Picture">
              <Icon n="pip" />
            </button>
            <button className="icon-btn" onClick={fullscreen} aria-label="Fullscreen">
              <Icon n={isFull ? 'exitfull' : 'full'} />
            </button>
          </div>
        </div>

        <div className="p-bottom">
          {live ? (
            <div className="p-livebar">
              <span className="live-dot">LIVE</span>
              {now ? (
                <>
                  <span className="small">{fmtTime(now.start)}</span>
                  <div className="bar">
                    <i style={{ width: progressOf(now.start, now.stop) * 100 + '%' }} />
                  </div>
                  <span className="small">{fmtTime(now.stop)}</span>
                  {next && <span className="small muted ellip">Next: {next.title}</span>}
                </>
              ) : (
                <div className="bar">
                  <i style={{ width: '100%' }} />
                </div>
              )}
            </div>
          ) : (
            <div className="p-seek">
              <span className="small tabular">{fmtDur(t)}</span>
              <div
                ref={progEl}
                className="seekbar"
                tabIndex={0}
                role="slider"
                aria-valuenow={Math.round(pct)}
                onPointerDown={(e) => {
                  scrub(e.clientX)
                  const mv = (ev: PointerEvent) => scrub(ev.clientX)
                  const up = () => (window.removeEventListener('pointermove', mv), window.removeEventListener('pointerup', up))
                  window.addEventListener('pointermove', mv)
                  window.addEventListener('pointerup', up)
                }}
              >
                <b style={{ width: bpct + '%' }} />
                <i style={{ width: pct + '%' }} />
                <em style={{ left: pct + '%' }} />
              </div>
              <span className="small tabular">-{fmtDur(dur - t)}</span>
            </div>
          )}

          <div className="p-controls">
            <div className="p-group">
              {live ? (
                <button className="icon-btn" onClick={() => zap(-1)} aria-label="Previous channel" disabled={!req.channels}>
                  <Icon n="prev" fill />
                </button>
              ) : (
                <button className="icon-btn" onClick={() => seek(-10)} aria-label="Back 10 seconds">
                  <Icon n="skipb" />
                  <span className="ten">10</span>
                </button>
              )}
              <button className="icon-btn play ctl-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
                <Icon n={playing ? 'pause' : 'play'} fill s={30} />
              </button>
              {live ? (
                <button className="icon-btn" onClick={() => zap(1)} aria-label="Next channel" disabled={!req.channels}>
                  <Icon n="next" fill />
                </button>
              ) : (
                <button className="icon-btn" onClick={() => seek(10)} aria-label="Forward 10 seconds">
                  <Icon n="skipf" />
                  <span className="ten">10</span>
                </button>
              )}
              {nextEp && (
                <button className="pill" onClick={() => playEpisode(req.episodes!.index + 1)}>
                  Next Episode <Icon n="chevron" s={16} />
                </button>
              )}
              <div className="vol">
                <button className="icon-btn" onClick={() => (video.current!.muted = !muted)} aria-label="Mute">
                  <Icon n={muted || vol === 0 ? 'mute' : 'audio'} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : vol}
                  onChange={(e) => {
                    video.current!.muted = false
                    video.current!.volume = Number(e.target.value)
                  }}
                  aria-label="Volume"
                />
              </div>
            </div>
            <div className="p-group">
              {live && req.channels && (
                <button className="icon-btn" onClick={() => setMenu('channels')} aria-label="Channel list">
                  <Icon n="list" />
                </button>
              )}
              {live && epg.length > 0 && (
                <button className="icon-btn" onClick={() => setMenu('info')} aria-label="Programme guide">
                  <Icon n="guide" />
                </button>
              )}
              {canPro() && (
                <button className="icon-btn" onClick={openPro} aria-label="Pro player (all sound formats)" title="Pro player (all sound formats)">
                  <Icon n="tv" />
                </button>
              )}
              <button className="icon-btn" onClick={() => setMenu('audio')} aria-label="Audio tracks">
                <Icon n="audio" />
              </button>
              <button className="icon-btn" onClick={() => setMenu('subs')} aria-label="Subtitles">
                <Icon n="sub" />
              </button>
              {quality.list.length > 1 && (
                <button className="icon-btn" onClick={() => setMenu('quality')} aria-label="Quality">
                  <Icon n="quality" />
                </button>
              )}
              <button className="icon-btn" onClick={() => setMenu('aspect')} aria-label="Aspect ratio">
                <Icon n="aspect" />
              </button>
              {vod && (
                <button className="icon-btn" onClick={() => setMenu('speed')} aria-label="Speed">
                  <Icon n="speed" />
                </button>
              )}
              {(live || req.kind === 'catchup') && <RecButton url={req.url} title={req.title} live={live} className="icon-btn" iconOnly />}
              <button className={'icon-btn ' + (sleepAt ? 'accent' : '')} onClick={() => setMenu('sleep')} aria-label="Sleep timer">
                <Icon n="timer" />
              </button>
            </div>
          </div>
          {engine && <div className="p-engine">{engine.name}</div>}
        </div>
      </div>

      {menu && (
        <div className={'p-menu glass ' + (menu === 'channels' || menu === 'info' ? 'side' : '')} onClick={(e) => e.stopPropagation()}>
          {menu === 'audio' && (
            <MenuList
              title="Audio"
              items={audio.list.length ? audio.list.map((a) => ({ id: a.id, label: a.label })) : [{ id: -2, label: 'Default' }]}
              current={audio.list.length ? audio.current : -2}
              onPick={(id) => (id >= 0 && engine?.setAudio(id), setMenu(null))}
            />
          )}
          {menu === 'subs' && (
            <>
              <MenuList
                title="Subtitles"
                items={[{ id: -1, label: 'Off' }, ...subs.list.map((s) => ({ id: s.id, label: s.label }))]}
                current={subs.current}
                onPick={(id) => (engine?.setSubs(id), setMenu(null))}
              />
              <label className="menu-item file">
                <Icon n="upload" s={18} /> Load subtitle file (.srt / .vtt)
                <input type="file" accept=".srt,.vtt,text/vtt" onChange={(e) => e.target.files?.[0] && loadSub(e.target.files[0])} />
              </label>
            </>
          )}
          {menu === 'quality' && (
            <MenuList
              title="Quality"
              items={[{ id: -1, label: 'Auto' }, ...quality.list]}
              current={quality.current}
              onPick={(id) => (engine?.setQuality(id), setMenu(null))}
            />
          )}
          {menu === 'aspect' && (
            <MenuList
              title="Aspect Ratio"
              items={[
                { id: 'contain', label: 'Fit' },
                { id: 'cover', label: 'Zoom / Fill' },
                { id: 'fill', label: 'Stretch' },
                { id: '16:9', label: '16:9' },
                { id: '4:3', label: '4:3' },
              ]}
              current={aspect}
              onPick={(id) => (setAspect(id as any), setMenu(null))}
            />
          )}
          {menu === 'speed' && (
            <MenuList
              title="Playback Speed"
              items={[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => ({ id: r, label: r === 1 ? 'Normal' : r + '×' }))}
              current={speed}
              onPick={(r) => setRate(r as number)}
            />
          )}
          {menu === 'sleep' && (
            <MenuList
              title="Sleep Timer"
              items={[0, 15, 30, 60, 90, 120].map((m) => ({ id: m, label: m ? `${m} minutes` : 'Off' }))}
              current={sleepAt ? -99 : 0}
              onPick={(m) => {
                setSleepAt(m ? Date.now() + (m as number) * 60000 : 0)
                if (m) app.toast(`Playback will stop in ${m} minutes`)
                setMenu(null)
              }}
            />
          )}
          {menu === 'channels' && req.channels && (
            <div className="menu-channels">
              <div className="menu-title">Channels</div>
              {req.channels.map((c, i) => (
                <button key={c.id} className={'menu-ch ' + (i === req.index ? 'on' : '')} onClick={() => (playChannel(i), setMenu(null))} data-autofocus={i === req.index || undefined}>
                  {settings.showNumbers && <span className="num">{c.num}</span>}
                  <Img className="ch-logo sm" src={c.logo} alt={c.name} />
                  <span className="ellip">{c.name}</span>
                </button>
              ))}
            </div>
          )}
          {menu === 'info' && (
            <div className="menu-channels">
              <div className="menu-title">TV Guide — {req.title}</div>
              {epg
                .filter((p) => p.stop > Date.now() - settings.epgOffset * 36e5)
                .slice(0, 12)
                .map((p, i) => (
                  <div key={i} className={'epg-row ' + (p === now ? 'on' : '')} tabIndex={0}>
                    <div className="small muted">
                      {fmtTime(p.start)} – {fmtTime(p.stop)}
                    </div>
                    <div className="strong">{p.title}</div>
                    {p.desc && <div className="small muted clamp2">{p.desc}</div>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MenuList<T extends string | number>({ title, items, current, onPick }: { title: string; items: { id: T; label: string }[]; current: T | number; onPick: (id: T) => void }) {
  useEffect(() => {
    setTimeout(() => (document.querySelector('.p-menu .menu-item.on, .p-menu .menu-item') as HTMLElement)?.focus(), 20)
  }, [])
  return (
    <div>
      <div className="menu-title">{title}</div>
      {items.map((i) => (
        <button key={String(i.id)} className={'menu-item ' + (i.id === current ? 'on' : '')} onClick={() => onPick(i.id)}>
          <span>{i.label}</span>
          {i.id === current && <Icon n="check" s={18} />}
        </button>
      ))}
    </div>
  )
}
