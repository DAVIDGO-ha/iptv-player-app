// Background chosen in Settings › Background: the app's own picture (default), one of 4 pictures, or any colour.
import { getSettings, onSettings } from './settings'

export const BG_IMAGES = [
  { id: 'sky', name: 'Sky Glass' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'lights', name: 'City Lights' },
  { id: 'sunset', name: 'Sunset' },
]
export const BG_COLORS = ['#0A0C2A', '#000000', '#111827', '#1E1B4B', '#0C4A6E', '#064E3B', '#4C0519', '#3B0764']
export const bgChoice = () => String((getSettings() as any).bg || 'default')
export const isColor = (v: string) => /^#[0-9a-f]{6}$/i.test(v)

/** Shows the chosen picture / colour. Returns false for "default" (the app's own background stays). */
export function applyBgChoice(): boolean {
  const b = document.body
  if (!b) return false
  const v = bgChoice()
  if (BG_IMAGES.some((i) => i.id === v)) {
    b.style.setProperty('background', `#05060f url("./bg/${v}.jpg") center / cover no-repeat fixed`, 'important')
    return true
  }
  if (isColor(v)) {
    b.style.setProperty('background', v, 'important')
    return true
  }
  b.style.removeProperty('background')
  return false
}

/** For apps without their own background logic: apply now and whenever the setting changes. */
export function initBackground() {
  applyBgChoice()
  onSettings(() => applyBgChoice())
}
