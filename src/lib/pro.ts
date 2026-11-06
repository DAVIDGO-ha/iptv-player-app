// "Pro player": a native player that decodes every sound format (Dolby AC3 / E-AC3, DTS, MP2…)
// Android app → built-in libVLC player. Laptop app → VLC (if installed). Browsers can't play these sounds.
const W = window as any

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
    const args = { url: o.url, title: o.title || '', start: o.start || 0, live: !!o.live, ua: 'IPTVSmartersPlayer', urls: o.urls || [], titles: o.titles || [], index: o.index || 0 }
    const r = C.nativePromise ? await C.nativePromise('VlcPlayer', 'play', args) : await C.Plugins?.VlcPlayer?.play(args)
    return r ? { pos: Number(r.pos) || 0, dur: Number(r.dur) || 0, index: Number(r.index) || 0 } : null
  }
  if (hasDesktopPro()) {
    await W.desktop.openVlc(o.url, o.title || '')
    return null
  }
  location.href = 'vlc://' + o.url
  return null
}
