// Laptop app: Dolby (AC3 / E-AC3), DTS, MP2… sound can't be decoded by the built-in web engine.
// The desktop app ships ffmpeg and converts only the SOUND to AAC on the fly (picture is copied, so it is light),
// then the normal built-in player plays it — with sound, seeking and resume, just like movies.
import type { Engine } from './engines'

const D = () => (window as any).desktop
let broken = false
export const canTranscode = () => !!D()?.txBase && !broken

type Info = { audio: string; video: string; duration: number; ok: boolean }
const OK_AUDIO = /^(aac|mp3|opus|vorbis|flac|none|)$/
const OK_VIDEO = /^(h264|hevc|vp8|vp9|av1|none|)$/
const cache = new Map<string, Info>()

/** Reads the stream's sound / picture formats (desktop app only). */
export async function probe(url: string): Promise<Info | null> {
  if (!canTranscode()) return null
  if (cache.has(url)) return cache.get(url)!
  try {
    const r = await D().probe(url)
    if (!r?.ok) return null
    cache.set(url, r)
    return r
  } catch {
    return null
  }
}
export const needsTranscode = (i: Info | null) => !!i && (!OK_AUDIO.test(i.audio) || !OK_VIDEO.test(i.video))

const P = HTMLMediaElement.prototype
const CT = Object.getOwnPropertyDescriptor(P, 'currentTime')!
const BU = Object.getOwnPropertyDescriptor(P, 'buffered')!

export async function attachTranscode(v: HTMLVideoElement, url: string, live: boolean, info?: Info | null): Promise<Engine> {
  const base: string | null = await D().txBase()
  if (!base) {
    broken = true
    throw new Error('no ffmpeg')
  }
  const vcopy = !info || OK_VIDEO.test(info.video)
  const dur = live ? 0 : info?.duration || 0
  let offset = 0
  const src = (ss: number) => `${base}/t?ss=${Math.floor(ss)}&vc=${vcopy ? 1 : 0}&u=${encodeURIComponent(url)}`
  if (!live) {
    Object.defineProperty(v, 'currentTime', {
      configurable: true,
      get: () => offset + CT.get!.call(v),
      set: (x: number) => {
        const now = offset + CT.get!.call(v)
        if (!isFinite(x) || Math.abs(x - now) < 1.5) return
        offset = Math.max(0, dur ? Math.min(x, dur - 2) : x)
        v.src = src(offset)
        v.play().catch(() => {})
      },
    })
    if (dur) Object.defineProperty(v, 'duration', { configurable: true, get: () => dur })
    Object.defineProperty(v, 'buffered', {
      configurable: true,
      get: () => {
        const b: TimeRanges = BU.get!.call(v)
        return { length: b.length, start: (i: number) => b.start(i) + offset, end: (i: number) => b.end(i) + offset }
      },
    })
  }
  v.src = src(0)
  const fire = () => v.dispatchEvent(new Event('durationchange'))
  v.addEventListener('loadedmetadata', fire)
  const none = { list: [], current: -1 }
  return {
    name: 'Pro sound (AAC)',
    destroy: () => {
      v.removeEventListener('loadedmetadata', fire)
      delete (v as any).currentTime
      delete (v as any).duration
      delete (v as any).buffered
      v.removeAttribute('src')
      v.load()
    },
    audio: () => none,
    setAudio() {},
    subs: () => none,
    setSubs() {},
    quality: () => none,
    setQuality() {},
  }
}
