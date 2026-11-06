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

export function deviceId(): string {
  let id = read<string>('ip.device', '')
  if (!id) {
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
    id = Array.from({ length: 6 }, hex).join(':')
    write('ip.device', id)
  }
  return id
}
