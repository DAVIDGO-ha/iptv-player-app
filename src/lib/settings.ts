// Global settings (persisted in localStorage, readable outside React)
export type Settings = {
  theme: 'dark' | 'light' | 'auto'
  accent: string
  timeFormat: '24' | '12'
  liveFormat: 'ts' | 'm3u8'
  buffer: 'low' | 'normal' | 'high'
  aspect: 'contain' | 'cover' | 'fill' | '16:9' | '4:3'
  autoplayNext: boolean
  autostartLast: boolean
  showNumbers: boolean
  epgOffset: number // hours
  epgUrl: string
  subSize: 's' | 'm' | 'l'
  subBg: boolean
  proxy: string // e.g. https://myproxy.com/?url={url}
  proxyStreams: boolean
  pin: string
  hideAdult: boolean
  language: string
  engine: 'auto' | 'pro' | 'builtin' // auto = Pro player on Firestick / Android TV
  region: string // background flag: 'auto' or a country code (GB, DE, FR…)
}

export const DEFAULTS: Settings = {
  theme: 'dark',
  accent: '#FF2D3A',
  timeFormat: '24',
  liveFormat: 'ts',
  buffer: 'normal',
  aspect: 'contain',
  autoplayNext: true,
  autostartLast: false,
  showNumbers: true,
  epgOffset: 0,
  epgUrl: '',
  subSize: 'm',
  subBg: true,
  proxy: '',
  proxyStreams: false,
  pin: '0000',
  hideAdult: true,
  language: 'en',
  engine: 'auto',
  region: 'auto',
}

const KEY = 'ip.settings'
let current: Settings = { ...DEFAULTS, ...read(KEY, {}) }
const subs = new Set<(s: Settings) => void>()

export function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
export function write(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export const getSettings = () => current
export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  write(KEY, current)
  subs.forEach((f) => f(current))
}
export function onSettings(f: (s: Settings) => void) {
  subs.add(f)
  return () => subs.delete(f)
}

// First start: use this device's hardware ID (Android ID / PC network MAC) so reinstalling keeps the same
// MAC Address — and the same 7-day free trial — like IBO Player.
export async function initDeviceId(): Promise<void> {
  if (read<string>('ip.device', '')) return
  const W = window as any
  let hw = ''
  try {
    if (W.desktop?.mac) hw = String((await W.desktop.mac()) || '')
    else if (W.Capacitor?.isNativePlatform?.()) {
      const C = W.Capacitor
      const r = C.nativePromise ? await C.nativePromise('VlcPlayer', 'hwid', {}) : await C.Plugins?.VlcPlayer?.hwid()
      hw = String(r?.id || '')
    }
  } catch {}
  let hex = hw.toUpperCase().replace(/[^0-9A-F]/g, '')
  if (hex.length > 12) {
    // Android ID (16 hex) → fold into 6 bytes
    let a = 0x811c9dc5, b = 0x01000193
    for (const c of hex) {
      a = Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0
      b = Math.imul(b ^ c.charCodeAt(0), 2246822519) >>> 0
    }
    hex = (a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')).slice(0, 12).toUpperCase()
  }
  if (hex.length === 12 && !/^0+$/.test(hex)) write('ip.device', hex.match(/.{2}/g)!.join(':'))
}

export function deviceId(): string {
  let id = read<string>('ip.device', '')
  if (!id) {
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
    id = Array.from({ length: 6 }, hex).join(':')
    write('ip.device', id)
  }
  return id
}
