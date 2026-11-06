// Country background: the living-room picture has a UK flag. For German viewers the flag is
// repainted as a waving German flag (black / red / gold) right on the device — no extra download.
import { getSettings, onSettings } from './settings'

const DE_TZ = /^Europe\/(Berlin|Vienna|Zurich|Busingen|Vaduz)$/

export function wantGerman(): boolean {
  const r = (getSettings() as any).region || 'auto'
  if (r === 'de') return true
  if (r === 'uk') return false
  let tz = ''
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {}
  if (DE_TZ.test(tz)) return true
  if (tz === 'Europe/London') return false
  return (navigator.languages || [navigator.language]).some((l) => /^de\b/i.test(l || ''))
}

// Outline of the flag in the 1920×1080 picture and its lower edge (the flag waves up to the right)
const POLY: [number, number][] = [[0, 0], [474, 0], [484, 45], [482, 90], [476, 120], [476, 160], [468, 190], [444, 212], [404, 222], [330, 241], [250, 255], [150, 271], [60, 285], [0, 295]]
const BX = [0, 60, 150, 250, 330, 404, 444, 480]
const BY = [295, 285, 271, 255, 241, 222, 212, 205]
const interp = (x: number) => {
  if (x <= BX[0]) return BY[0]
  for (let i = 1; i < BX.length; i++) if (x <= BX[i]) return BY[i - 1] + ((BY[i] - BY[i - 1]) * (x - BX[i - 1])) / (BX[i] - BX[i - 1])
  return BY[BY.length - 1]
}

const load = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })

const cache: Record<string, Promise<string>> = {}

export function germanBackground(src: string): Promise<string> {
  return (cache[src] ||= (async () => {
    const img = await load(src)
    const W = img.naturalWidth
    const H = img.naturalHeight
    const s = W / 1920
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    // work only on the flag's box
    const bw = Math.ceil(500 * s)
    const bh = Math.ceil(310 * s)
    const orig = ctx.getImageData(0, 0, bw, bh)
    // soft polygon mask
    const mc = document.createElement('canvas')
    mc.width = bw
    mc.height = bh
    const m = mc.getContext('2d')!
    m.filter = `blur(${2 * s}px)`
    m.fillStyle = '#fff'
    m.beginPath()
    POLY.forEach(([x, y], i) => (i ? m.lineTo(x * s, y * s) : m.moveTo(x * s, y * s)))
    m.closePath()
    m.fill()
    const mask = m.getImageData(0, 0, bw, bh).data
    // low-frequency light of the original (keeps the scene's glow)
    const lc = document.createElement('canvas')
    lc.width = bw
    lc.height = bh
    const l = lc.getContext('2d')!
    l.filter = `blur(${30 * s}px)`
    l.drawImage(cv, 0, 0)
    const low = l.getImageData(0, 0, bw, bh).data
    let sum = 0
    let n = 0
    for (let i = 0; i < bw * bh; i++) {
      const w = mask[i * 4] / 255
      if (w > 0.5) {
        sum += 0.299 * low[i * 4] + 0.587 * low[i * 4 + 1] + 0.114 * low[i * 4 + 2]
        n++
      }
    }
    const avg = sum / Math.max(1, n) || 1
    const d = orig.data
    for (let py = 0; py < bh; py++) {
      const Y = py / s
      for (let px = 0; px < bw; px++) {
        const i = (py * bw + px) * 4
        let w = mask[i] / 255
        if (w <= 0) continue
        const X = px / s
        const r0 = d[i]
        const g0 = d[i + 1]
        const b0 = d[i + 2]
        const L = 0.299 * r0 + 0.587 * g0 + 0.114 * b0
        // keep the man's hair in front of the flag
        if (Y > 256 && L < 95 && !(b0 > r0 + 25)) continue
        const b = interp(X)
        const c = 150 - 0.2 * X
        const t = 2 * c - b
        const v = (Y - t) / (b - t)
        let cr: number, cg: number, cb: number
        if (v < 1 / 3) (cr = 28), (cg = 28), (cb = 32)
        else if (v < 2 / 3) (cr = 210), (cg = 12), (cb = 20)
        else (cr = 255), (cg = 198), (cb = 0)
        const wave = 1 + 0.16 * Math.sin(2 * Math.PI * (X * 0.0065 + Y * 0.0045)) + 0.08 * Math.sin(2 * Math.PI * (X * 0.013 - Y * 0.003) + 1.3)
        const lo = (0.299 * low[i] + 0.587 * low[i + 1] + 0.114 * low[i + 2]) / avg
        let sh = Math.min(1.35, Math.max(0.5, wave * (0.75 + 0.25 * lo)))
        sh *= Math.min(1.05, Math.max(0.75, 1.05 - 0.25 * (X / 480)))
        d[i] = r0 * (1 - w) + Math.min(255, cr * sh) * w
        d[i + 1] = g0 * (1 - w) + Math.min(255, cg * sh) * w
        d[i + 2] = b0 * (1 - w) + Math.min(255, cb * sh) * w
      }
    }
    ctx.putImageData(orig, 0, 0)
    const blob: Blob = await new Promise((res) => cv.toBlob((b) => res(b!), 'image/jpeg', 0.88))
    return URL.createObjectURL(blob)
  })())
}

// Applies the right background (UK / Germany) and follows the setting
export function initCountryBackground() {
  const apply = async () => {
    const body = document.body
    if (!wantGerman()) {
      body.style.backgroundImage = ''
      return
    }
    const small = matchMedia('(max-width: 860px)').matches
    try {
      const url = await germanBackground(small ? './bg/room-sm.jpg' : './bg/room.jpg')
      if (wantGerman()) body.style.backgroundImage = `url("${url}")`
    } catch {}
  }
  apply()
  onSettings(() => apply())
  try {
    matchMedia('(max-width: 860px)').addEventListener('change', apply)
  } catch {}
}
