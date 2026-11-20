// "Pro player": a native player that decodes every sound format (Dolby AC3 / E-AC3, DTS, MP2…)
// Android app → built-in libVLC player. Laptop app → VLC (if installed). Browsers can't play these sounds.
import { UA } from './flavor'

const W = window as any

// While the Pro player is open, every small / built-in player stops its stream (one connection per line:
// a second stream makes the provider cut both, and two players at once can run old devices out of memory).
let proOpen = false
const proSubs = new Set<(v: boolean) => void>()
const setProOpen = (v: boolean) => {
  proOpen = v
  proSubs.forEach((f) => f(v))
}
export const isProOpen = () => proOpen
export const onProOpen = (f: (v: boolean) => void) => (proSubs.add(f), () => void proSubs.delete(f))

export const hasNativePro = () => !!W.Capacitor?.isNativePlatform?.()
export const hasDesktopPro = () => !!W.desktop?.openVlc
export const canPro = () => hasNativePro() || hasDesktopPro()

/** Can a stream that has no sound in the built-in engine be moved to the Pro player automatically? */
export async function autoProOk(): Promise<boolean> {
  if (hasNativePro()) return true
  if (hasDesktopPro()) {
    try {
      return !!(await W.desktop.hasVlc?.())
    } catch {
      return false
    }
  }
  return false
}

/** Firestick / Android TV app: play everything in the Pro player (old TV sticks often show sound but no picture in the web engine). */
export function proPreferred(): boolean {
  if (!hasNativePro()) return false
  let e = 'auto'
  try {
    e = JSON.parse(localStorage.getItem('ip.settings') || '{}').engine || 'auto'
  } catch {}
  if (e === 'pro') return true
  if (e === 'builtin') return false
  return document.documentElement.classList.contains('tv')
}

/** Android app: series episodes (and MKV / AVI files) almost always carry Dolby / DTS sound → always use the Pro player. */
export function proFor(kind: string, url: string): boolean {
  if (!hasNativePro()) return false
  let e = 'auto'
  try {
    e = JSON.parse(localStorage.getItem('ip.settings') || '{}').engine || 'auto'
  } catch {}
  if (e === 'builtin') return false
  // Live TV: always the VLC engine in the Android app (phone, tablet, TV) — one steady connection, reconnects by itself
  return proPreferred() || kind === 'live' || kind === 'episode' || /\.(mkv|avi)(\?|$)/i.test(url)
}

// ——— Small VLC player inside the app screen (Android app): the channel plays next to the list, like Hot Player ———
const vlc = (m: string, a: any = {}): Promise<any> => {
  const C = W.Capacitor
  try {
    return Promise.resolve(C?.nativePromise ? C.nativePromise('VlcPlayer', m, a) : C?.Plugins?.VlcPlayer?.[m]?.(a))
  } catch (e) {
    return Promise.reject(e)
  }
}
/** Android app, unless "Built-in" is chosen in Settings › Player engine. */
export function embedOk(): boolean {
  if (!hasNativePro()) return false
  try {
    return (JSON.parse(localStorage.getItem('ip.settings') || '{}').engine || 'auto') !== 'builtin'
  } catch {
    return true
  }
}
export type Box = { x: number; y: number; w: number; h: number } // fractions (0–1) of the page
export const embedPlay = (url: string, live: boolean, box: Box) => vlc('embedPlay', { url, live, ua: UA, ...box })
export const embedRect = (box: Box) => vlc('embedRect', box).catch(() => {})
export const embedStop = () => vlc('embedStop').catch(() => {})
export const embedState = (): Promise<{ state?: string; video?: boolean } | undefined> => vlc('embedState').catch(() => undefined)

/** Android app (phone or TV): formats that never have sound / picture in the built-in player go straight to the Pro player.
 *  Everything else may play inside the dashboard first (the right-hand screen), like Live TV. */
export function mustPro(kind: string, url: string): boolean {
  if (!hasNativePro()) return false
  let e = 'auto'
  try {
    e = JSON.parse(localStorage.getItem('ip.settings') || '{}').engine || 'auto'
  } catch {}
  if (e === 'builtin') return false
  return kind === 'episode' || /\.(mkv|avi)(\?|$)/i.test(url)
}

/** Plays the stream in the Pro player. Resolves with the position (seconds) when the user comes back, or null. */
export async function playPro(o: {
  url: string
  title?: string
  start?: number
  live?: boolean
  urls?: string[] // channel list → CH+/CH– and Up/Down change channel inside the Pro player
  titles?: string[]
  index?: number
}): Promise<{ pos: number; dur: number; index: number } | null> {
  if (hasNativePro()) {
    const C = W.Capacitor
    // Only send the channels around the current one: Android saves this call while the player is open, and a list of
    // thousands of channels is too big to save → Android closes the app. 100 before + 100 after is plenty for CH+/CH–.
    let urls = o.urls || []
    let titles = o.titles || []
    let index = o.index || 0
    const from = Math.max(0, index - 100)
    if (urls.length > 201) {
      urls = urls.slice(from, from + 201)
      titles = titles.slice(from, from + 201)
      index -= from
    }
    const args = { url: o.url, title: o.title || '', start: o.start || 0, live: !!o.live, ua: UA, urls, titles, index }
    setProOpen(true)
    let r: any
    try {
      r = C.nativePromise ? await C.nativePromise('VlcPlayer', 'play', args) : await C.Plugins?.VlcPlayer?.play(args)
    } finally {
      setProOpen(false)
    }
    return r ? { pos: Number(r.pos) || 0, dur: Number(r.dur) || 0, index: (Number(r.index) || 0) + (urls.length < (o.urls || []).length ? from : 0) } : null
  }
  if (hasDesktopPro()) {
    await W.desktop.openVlc(o.url, o.title || '')
    return null
  }
  location.href = 'vlc://' + o.url
  return null
}
