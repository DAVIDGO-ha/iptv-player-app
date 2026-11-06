// Playback engines: native <video>, hls.js (HLS), mpegts.js (MPEG-TS / FLV live).
// Libraries load lazily: local ./vendor copy first (offline / packaged apps), then CDN.
import { getSettings } from './settings'

const SRC: Record<string, { global: string; urls: string[] }> = {
  hls: {
    global: 'Hls',
    urls: ['./vendor/hls.min.js', 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js', 'https://unpkg.com/hls.js@1.5.15/dist/hls.min.js'],
  },
  mpegts: {
    global: 'mpegts',
    urls: ['./vendor/mpegts.js', 'https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.js', 'https://unpkg.com/mpegts.js@1.7.3/dist/mpegts.js'],
  },
}
const loading: Record<string, Promise<any>> = {}

function script(url: string) {
  return new Promise<void>((res, rej) => {
    const s = document.createElement('script')
    s.src = url
    s.async = true
    s.onload = () => res()
    s.onerror = () => (s.remove(), rej())
    document.head.appendChild(s)
  })
}
export function loadLib(name: 'hls' | 'mpegts'): Promise<any> {
  const g = (window as any)[SRC[name].global]
  if (g) return Promise.resolve(g)
  return (loading[name] ||= (async () => {
    for (const u of SRC[name].urls) {
      try {
        await script(u)
        const lib = (window as any)[SRC[name].global]
        if (lib) return lib
      } catch {}
    }
    delete loading[name]
    throw new Error(`Could not load the ${name} playback engine (check your internet connection).`)
  })())
}

export type Track = { id: number; label: string; lang?: string }
export type Engine = {
  name: string
  destroy(): void
  audio(): { list: Track[]; current: number }
  setAudio(id: number): void
  subs(): { list: Track[]; current: number }
  setSubs(id: number): void
  quality(): { list: Track[]; current: number }
  setQuality(id: number): void
}

const nativeTracks = (v: HTMLVideoElement) => ({
  audio() {
    const at: any = (v as any).audioTracks
    if (!at || !at.length) return { list: [], current: -1 }
    const list: Track[] = []
    let current = -1
    for (let i = 0; i < at.length; i++) {
      list.push({ id: i, label: at[i].label || at[i].language || `Track ${i + 1}`, lang: at[i].language })
      if (at[i].enabled) current = i
    }
    return { list, current }
  },
  setAudio(id: number) {
    const at: any = (v as any).audioTracks
    if (at) for (let i = 0; i < at.length; i++) at[i].enabled = i === id
  },
  subs() {
    const list: Track[] = []
    let current = -1
    for (let i = 0; i < v.textTracks.length; i++) {
      const t = v.textTracks[i]
      if (t.kind !== 'subtitles' && t.kind !== 'captions') continue
      list.push({ id: i, label: t.label || t.language || `Subtitle ${i + 1}`, lang: t.language })
      if (t.mode === 'showing') current = i
    }
    return { list, current }
  },
  setSubs(id: number) {
    for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = i === id ? 'showing' : 'disabled'
  },
})

export function detectType(url: string, hint?: string): 'hls' | 'ts' | 'native' {
  const path = url.split('?')[0].toLowerCase()
  if (hint === 'm3u8' || /\.m3u8$/.test(path) || /\/hls\//.test(path) || /[?&](type|output|extension)=(m3u8|hls)/i.test(url)) return 'hls'
  if (hint === 'ts' || /\.(ts|flv)$/.test(path) || /[?&](output|type)=(ts|mpegts)/i.test(url)) return 'ts'
  if (/\.(mp4|m4v|webm|mov|mkv|avi|mp3|aac|ogg)$/.test(path)) return 'native'
  return hint === 'live' ? 'ts' : 'native'
}

const bufferSec = () => ({ low: 8, normal: 30, high: 90 })[getSettings().buffer]

export async function attachEngine(
  v: HTMLVideoElement,
  url: string,
  opts: { live: boolean; type?: 'hls' | 'ts' | 'native'; onFatal?: (e: string) => void; onTracks?: () => void }
): Promise<Engine> {
  const type = opts.type || detectType(url, opts.live ? 'live' : undefined)
  const base = nativeTracks(v)
  const noQ = { quality: () => ({ list: [], current: -1 }), setQuality() {} }
  v.textTracks.onaddtrack = () => opts.onTracks?.()

  if (type === 'hls') {
    const canNative = v.canPlayType('application/vnd.apple.mpegurl')
    const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent) && !/Chrome|Android/.test(navigator.userAgent)
    if (canNative && isApple) {
      v.src = url
      return { name: 'Native HLS', destroy: () => (v.removeAttribute('src'), v.load()), ...base, ...noQ }
    }
    let Hls: any
    try {
      Hls = await loadLib('hls')
    } catch (e) {
      if (canNative) {
        v.src = url
        return { name: 'Native HLS', destroy: () => (v.removeAttribute('src'), v.load()), ...base, ...noQ }
      }
      throw e
    }
    if (!Hls.isSupported()) {
      v.src = url
      return { name: 'Native HLS', destroy: () => (v.removeAttribute('src'), v.load()), ...base, ...noQ }
    }
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: opts.live,
      maxBufferLength: bufferSec(),
      backBufferLength: opts.live ? 30 : 90,
      manifestLoadingMaxRetry: 4,
      fragLoadingMaxRetry: 6,
    })
    let recovered = 0
    hls.on(Hls.Events.ERROR, (_: any, d: any) => {
      if (!d.fatal) return
      if (d.type === Hls.ErrorTypes.MEDIA_ERROR && recovered++ < 2) return hls.recoverMediaError()
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR && recovered++ < 3) return hls.startLoad()
      opts.onFatal?.(d.details || 'Stream error')
    })
    // Many channels carry Dolby (AC3/E-AC3) + AAC/MP2 sound: choose a track the device can play
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
      const ok = (c?: string) => !c || (window as any).MediaSource?.isTypeSupported?.(`audio/mp4; codecs="${c}"`)
      const tr = hls.audioTracks || []
      const cur = tr[hls.audioTrack]
      if (tr.length > 1 && cur && !ok(cur.audioCodec)) {
        const i = tr.findIndex((t: any) => ok(t.audioCodec))
        if (i >= 0) hls.audioTrack = i
      }
    })
    ;['MANIFEST_PARSED', 'AUDIO_TRACKS_UPDATED', 'SUBTITLE_TRACKS_UPDATED', 'LEVEL_SWITCHED'].forEach((ev) =>
      hls.on(Hls.Events[ev], () => opts.onTracks?.())
    )
    hls.loadSource(url)
    hls.attachMedia(v)
    return {
      name: 'HLS',
      destroy: () => hls.destroy(),
      audio: () => ({
        list: (hls.audioTracks || []).map((t: any, i: number) => ({ id: i, label: t.name || t.lang || `Audio ${i + 1}`, lang: t.lang })),
        current: hls.audioTrack,
      }),
      setAudio: (id) => (hls.audioTrack = id),
      subs: () => {
        const l = hls.subtitleTracks || []
        if (!l.length) return base.subs()
        return { list: l.map((t: any, i: number) => ({ id: i, label: t.name || t.lang || `Subtitle ${i + 1}`, lang: t.lang })), current: hls.subtitleTrack }
      },
      setSubs: (id) => {
        if ((hls.subtitleTracks || []).length) {
          hls.subtitleTrack = id
          hls.subtitleDisplay = id >= 0
        } else base.setSubs(id)
      },
      quality: () => ({
        list: (hls.levels || []).map((l: any, i: number) => ({ id: i, label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps` })),
        current: hls.autoLevelEnabled ? -1 : hls.currentLevel,
      }),
      setQuality: (id) => (hls.currentLevel = id),
    }
  }

  if (type === 'ts') {
    const mpegts = await loadLib('mpegts')
    if (!mpegts.getFeatureList().mseLivePlayback) {
      v.src = url
      return { name: 'Native', destroy: () => (v.removeAttribute('src'), v.load()), ...base, ...noQ }
    }
    const p = mpegts.createPlayer(
      { type: /\.flv/i.test(url) ? 'flv' : 'mpegts', isLive: opts.live, url },
      {
        enableWorker: true,
        enableStashBuffer: getSettings().buffer !== 'low',
        stashInitialSize: getSettings().buffer === 'high' ? 1024 * 1024 : 384 * 1024,
        liveBufferLatencyChasing: opts.live,
        liveBufferLatencyMaxLatency: bufferSec(),
        autoCleanupSourceBuffer: true,
        lazyLoad: false,
      }
    )
    p.on(mpegts.Events.ERROR, (t: string, d: string) => opts.onFatal?.(`${t}: ${d}`))
    p.attachMediaElement(v)
    p.load()
    return {
      name: 'MPEG-TS',
      destroy: () => {
        try {
          p.pause()
          p.unload()
          p.detachMediaElement()
          p.destroy()
        } catch {}
      },
      ...base,
      ...noQ,
    }
  }

  v.src = url
  return { name: 'Native', destroy: () => (v.removeAttribute('src'), v.load()), ...base, ...noQ }
}

// SRT → WebVTT for external subtitle files
export function srtToVtt(srt: string) {
  if (/^WEBVTT/.test(srt.trim())) return srt
  return 'WEBVTT\n\n' + srt.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
}
