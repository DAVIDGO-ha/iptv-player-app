// Country background: the living-room picture has a UK flag. On other countries' devices the flag is
// repainted (right on the device, no extra download) with that country's flag, waving the same way.
import { getSettings, onSettings } from './settings'

export const COUNTRIES: [string, string][] = [
  ['GB', 'United Kingdom'],
  ['IE', 'Ireland'],
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['DE', 'Germany'],
  ['AT', 'Austria'],
  ['CH', 'Switzerland'],
  ['FR', 'France'],
  ['BE', 'Belgium'],
  ['NL', 'Netherlands'],
  ['ES', 'Spain'],
  ['PT', 'Portugal'],
  ['IT', 'Italy'],
  ['SE', 'Sweden'],
  ['AU', 'Australia'],
  ['MA', 'Morocco'],
]
const KNOWN = new Set(COUNTRIES.map((c) => c[0]))

const TZ: Record<string, string> = {
  'Europe/London': 'GB', 'Europe/Belfast': 'GB', 'Europe/Dublin': 'IE',
  'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE', 'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH',
  'Europe/Paris': 'FR', 'Europe/Brussels': 'BE', 'Europe/Amsterdam': 'NL', 'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES', 'Africa/Ceuta': 'ES',
  'Europe/Lisbon': 'PT', 'Atlantic/Madeira': 'PT', 'Atlantic/Azores': 'PT', 'Europe/Rome': 'IT', 'Europe/Stockholm': 'SE',
  'Africa/Casablanca': 'MA', 'Africa/El_Aaiun': 'MA',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
  'America/St_Johns': 'CA', 'America/Regina': 'CA', 'America/Montreal': 'CA', 'America/Moncton': 'CA', 'America/Whitehorse': 'CA',
}

/** The viewer's country: chosen in Settings, else from the device time zone, else from the language (e.g. fr-BE). */
export function country(): string {
  const r = String((getSettings() as any).region || 'auto').toUpperCase()
  if (KNOWN.has(r)) return r
  if (r === 'UK') return 'GB'
  let tz = ''
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {}
  if (TZ[tz]) return TZ[tz]
  if (/^America\//.test(tz) && !/Sao_Paulo|Argentina|Bogota|Lima|Mexico|Santiago|Caracas/.test(tz)) return 'US'
  if (/^(Pacific\/Honolulu|US\/)/.test(tz)) return 'US'
  if (/^Australia\//.test(tz)) return 'AU'
  for (const l of navigator.languages || [navigator.language]) {
    const m = /-([A-Z]{2})$/i.exec(l || '')
    if (m && KNOWN.has(m[1].toUpperCase())) return m[1].toUpperCase()
  }
  return 'GB'
}

// ——— flag artwork (u: 0 = pole side → 1 = flying end, v: 0 = top → 1 = bottom) ———
type RGB = [number, number, number]
const C: Record<string, RGB> = {
  black: [28, 28, 32], red: [206, 17, 38], gold: [255, 198, 0], white: [242, 242, 242], blue: [0, 56, 168],
  navy: [10, 49, 97], green: [0, 122, 61], orange: [255, 130, 0], yellow: [253, 218, 36], frRed: [239, 65, 53],
  frBlue: [0, 85, 164], itGreen: [0, 146, 70], seBlue: [0, 106, 167], seYel: [254, 204, 0], maRed: [193, 39, 45], maGreen: [0, 98, 51],
  usRed: [178, 34, 52], usBlue: [60, 59, 110], ptGreen: [0, 102, 0], auBlue: [1, 33, 105], esRed: [198, 11, 30], esYel: [255, 196, 0],
}
const H3 = (a: RGB, b: RGB, c: RGB) => (_u: number, v: number) => (v < 1 / 3 ? a : v < 2 / 3 ? b : c)
const V3 = (a: RGB, b: RGB, c: RGB) => (u: number) => (u < 1 / 3 ? a : u < 2 / 3 ? b : c)
const A = 2.1 // width / height of the flag in the picture

function star(cx: number, cy: number, r: number, u: number, v: number, points = 5, inner = 0.4) {
  // point inside a star centred at (cx, cy) in flag units (v scaled by A so stars stay round)
  const x = u - cx
  const y = (v - cy) / A
  const d = Math.hypot(x, y)
  if (d > r) return false
  if (d < r * inner * 0.8) return true
  let a = Math.atan2(x, -y)
  const seg = (2 * Math.PI) / points
  a = ((a % seg) + seg) % seg
  const t = Math.abs(a - seg / 2) / (seg / 2) // 0 at the inner corner, 1 at a tip
  return d <= r * (inner + (1 - inner) * t)
}
function nearSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number, w: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy) < w
}
function unionJack(u: number, v: number): RGB {
  // u, v in 0..1 of the canton
  const x = u * 2 - 1
  const y = v * 2 - 1
  if (Math.abs(x) < 0.1 || Math.abs(y) < 0.2) return C.red
  if (Math.abs(x) < 0.17 || Math.abs(y) < 0.34) return C.white
  const dd = Math.min(Math.abs(y - x), Math.abs(y + x))
  if (dd < 0.1) return C.red
  if (dd < 0.22) return C.white
  return C.navy
}
const MAPLE: [number, number][] = [[0, -1], [0.12, -0.75], [0.3, -0.82], [0.24, -0.4], [0.5, -0.62], [0.56, -0.48], [0.82, -0.52], [0.7, -0.25], [0.86, -0.15], [0.45, 0.2], [0.52, 0.38], [0.06, 0.32], [0.06, 0.75], [-0.06, 0.75], [-0.06, 0.32], [-0.52, 0.38], [-0.45, 0.2], [-0.86, -0.15], [-0.7, -0.25], [-0.82, -0.52], [-0.56, -0.48], [-0.5, -0.62], [-0.24, -0.4], [-0.3, -0.82], [-0.12, -0.75]]
function inPoly(x: number, y: number, p: [number, number][]) {
  let ins = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) ins = !ins
  return ins
}

const FLAGS: Record<string, (u: number, v: number) => RGB> = {
  DE: H3(C.black, C.red, C.gold),
  AT: (_u, v) => (v < 1 / 3 || v >= 2 / 3 ? C.red : C.white),
  NL: H3([174, 28, 40], C.white, [33, 70, 139]),
  FR: V3(C.frBlue, C.white, C.frRed),
  IT: V3(C.itGreen, C.white, C.frRed),
  BE: V3(C.black, C.yellow, C.frRed),
  IE: V3(C.itGreen, C.white, C.orange),
  ES: (_u, v) => (v < 0.25 || v >= 0.75 ? C.esRed : C.esYel),
  PT: (u, v) => {
    const d = Math.hypot(u - 0.4, (v - 0.5) / A)
    if (d < 0.085 && d > 0.06) return C.yellow
    if (d < 0.06 && Math.abs(u - 0.4) < 0.04 && Math.abs(v - 0.5) < 0.12) return C.white
    if (d < 0.06) return C.red
    return u < 0.4 ? C.ptGreen : C.red
  },
  SE: (u, v) => ((u > 0.31 && u < 0.44) || (v > 0.4 && v < 0.6) ? C.seYel : C.seBlue),
  CH: (u, v) => {
    const x = (u - 0.5) * A
    const y = v - 0.5
    return (Math.abs(x) < 0.1 && Math.abs(y) < 0.32) || (Math.abs(y) < 0.1 && Math.abs(x) < 0.32) ? C.white : C.red
  },
  US: (u, v) => {
    if (u < 0.4 && v < 7 / 13) {
      const cu = u / 0.4
      const cv = v / (7 / 13)
      const row = Math.floor(cv * 9)
      const col = Math.floor(cu * 11 + (row % 2) * 0.5)
      const sx = (col + 0.5 - (row % 2) * 0.5) / 11
      const sy = (row + 0.5) / 9
      return star(sx * 0.4, sy * (7 / 13), 0.012, u, v) ? C.white : C.usBlue
    }
    return Math.floor(v * 13) % 2 ? C.white : C.usRed
  },
  CA: (u, v) => {
    if (u < 0.25 || u > 0.75) return C.red
    return inPoly((u - 0.5) / 0.2, (v - 0.5) / 0.4, MAPLE) ? C.red : C.white
  },
  AU: (u, v) => {
    if (u < 0.5 && v < 0.5) return unionJack(u / 0.5, v / 0.5)
    const W = C.white
    if (star(0.25, 0.75, 0.06, u, v, 7, 0.45)) return W
    if (star(0.75, 0.82, 0.03, u, v, 7, 0.45) || star(0.75, 0.2, 0.03, u, v, 7, 0.45) || star(0.62, 0.45, 0.03, u, v, 7, 0.45) || star(0.86, 0.4, 0.03, u, v, 7, 0.45) || star(0.8, 0.55, 0.016, u, v, 5)) return W
    return C.auBlue
  },
  MA: (u, v) => {
    // green pentagram (outline) on red
    const r = 0.13
    const pts: [number, number][] = []
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5
      pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a) * A])
    }
    for (let k = 0; k < 5; k++) {
      const [ax, ay] = pts[k]
      const [bx, by] = pts[(k + 2) % 5]
      if (nearSeg(u, v / A, ax, ay / A, bx, by / A, 0.012)) return C.maGreen
    }
    return C.maRed
  },
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

export function flagBackground(src: string, cc: string): Promise<string> {
  const paint = FLAGS[cc]
  if (!paint) return Promise.resolve(src)
  return (cache[src + cc] ||= (async () => {
    const img = await load(src)
    const W = img.naturalWidth
    const H = img.naturalHeight
    const s = W / 1920
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const bw = Math.ceil(500 * s)
    const bh = Math.ceil(310 * s)
    const orig = ctx.getImageData(0, 0, bw, bh)
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
    const lc = document.createElement('canvas')
    lc.width = bw
    lc.height = bh
    const l = lc.getContext('2d')!
    l.filter = `blur(${30 * s}px)`
    l.drawImage(cv, 0, 0)
    const low = l.getImageData(0, 0, bw, bh).data
    let sum = 0
    let n = 0
    for (let i = 0; i < bw * bh; i++)
      if (mask[i * 4] > 128) {
        sum += 0.299 * low[i * 4] + 0.587 * low[i * 4 + 1] + 0.114 * low[i * 4 + 2]
        n++
      }
    const avg = sum / Math.max(1, n) || 1
    const d = orig.data
    for (let py = 0; py < bh; py++) {
      const Y = py / s
      for (let px = 0; px < bw; px++) {
        const i = (py * bw + px) * 4
        const w = mask[i] / 255
        if (w <= 0) continue
        const X = px / s
        const r0 = d[i]
        const g0 = d[i + 1]
        const b0 = d[i + 2]
        const L = 0.299 * r0 + 0.587 * g0 + 0.114 * b0
        if (Y > 256 && L < 95 && !(b0 > r0 + 25)) continue // keep the man's hair in front
        const b = interp(X)
        const c = 150 - 0.2 * X
        const t = 2 * c - b
        const v = (Y - t) / (b - t)
        const u = (X + 105) / 580 // the pole side of the flag is just outside the picture
        const [cr, cg, cb] = paint(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)))
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
    const blob: Blob = await new Promise((res) => cv.toBlob((bl) => res(bl!), 'image/jpeg', 0.88))
    return URL.createObjectURL(blob)
  })())
}

// Applies the right background for the viewer's country and follows the setting
export function initCountryBackground() {
  const apply = async () => {
    const body = document.body
    const cc = country()
    if (cc === 'GB' || !FLAGS[cc]) {
      body.style.backgroundImage = ''
      return
    }
    const small = matchMedia('(max-width: 860px)').matches
    try {
      const url = await flagBackground(small ? './bg/room-sm.jpg' : './bg/room.jpg', cc)
      if (country() === cc) body.style.backgroundImage = `url("${url}")`
    } catch {}
  }
  apply()
  onSettings(() => apply())
  try {
    matchMedia('(max-width: 860px)').addEventListener('change', apply)
  } catch {}
  ;(window as any).__flagBackground = flagBackground // used by the screenshot tool
}
