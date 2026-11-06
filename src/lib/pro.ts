// "Pro player": a native player that decodes every sound format (Dolby AC3 / E-AC3, DTS, MP2…)
// Android app → built-in libVLC player. Laptop app → VLC (if installed). Browsers can't play these sounds.
const W = window as any

export const hasNativePro = () => !!W.Capacitor?.isNativePlatform?.()
export const hasDesktopPro = () => !!W.desktop?.openVlc
export const canPro = () => hasNativePro() || hasDesktopPro()

/** Plays the stream in the Pro player. Resolves with the position (seconds) when the user comes back, or null. */
export async function playPro(o: { url: string; title?: string; start?: number; live?: boolean }): Promise<{ pos: number; dur: number } | null> {
  if (hasNativePro()) {
    const C = W.Capacitor
    const args = { url: o.url, title: o.title || '', start: o.start || 0, live: !!o.live, ua: 'IPTVSmartersPlayer' }
    const r = C.nativePromise ? await C.nativePromise('VlcPlayer', 'play', args) : await C.Plugins?.VlcPlayer?.play(args)
    return r ? { pos: Number(r.pos) || 0, dur: Number(r.dur) || 0 } : null
  }
  if (hasDesktopPro()) {
    await W.desktop.openVlc(o.url, o.title || '')
    return null
  }
  location.href = 'vlc://' + o.url
  return null
}
