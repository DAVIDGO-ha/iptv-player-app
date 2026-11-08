// Device activation: the TV shows Device ID + Key, the client adds playlists on the website, the app syncs them.
import { SITE_URL } from '../config'
import { deviceId, read, write } from './settings'
import type { Playlist } from './types'

export function deviceKey(): string {
  let k = read<string>('ip.devkey', '')
  if (!k) {
    k = String(Math.floor(100000 + Math.random() * 900000))
    write('ip.devkey', k)
  }
  return k
}
export function resetDeviceKey() {
  write('ip.devkey', '')
  return deviceKey()
}
export const activateUrl = () => `${SITE_URL}/activate?id=${encodeURIComponent(deviceId())}`

const platform = () => {
  const ua = navigator.userAgent
  if (/AFT/i.test(ua)) return 'Fire TV'
  if (/Tizen/i.test(ua)) return 'Samsung TV'
  if (/Web0S|webOS/i.test(ua)) return 'LG TV'
  if (/Android TV|GoogleTV|BRAVIA/i.test(ua)) return 'Android TV'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad/i.test(ua)) return 'iOS'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Macintosh/i.test(ua)) return 'Mac'
  return 'Web'
}

async function call(path: string, init?: RequestInit) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(SITE_URL + path, { ...init, signal: ctrl.signal, headers: { 'Content-Type': 'application/json' } })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

let registered = false
export async function registerDevice() {
  if (registered) return
  await call('/api/device/register', { method: 'POST', body: JSON.stringify({ id: deviceId(), key: deviceKey(), platform: platform(), version: '1.1.0' }) })
  registered = true
}

export type CloudPlaylist = { id: string; name: string; type: 'xtream' | 'm3u'; server?: string; username?: string; password?: string; url?: string; epgUrl?: string; updatedAt?: string }

export async function fetchCloudPlaylists(): Promise<CloudPlaylist[]> {
  await registerDevice().catch(() => {})
  const j = await call(`/api/device/playlists?id=${encodeURIComponent(deviceId())}&key=${deviceKey()}`)
  // Blocked from the admin dashboard → remember it (works offline too) until unblocked
  write('ip.blocked', !!j?.blocked)
  if (j?.license) write('ip.license', j.license)
  window.dispatchEvent(new Event('ip-blocked'))
  return Array.isArray(j?.playlists) ? j.playlists : []
}
export const isBlocked = () => !!read<boolean>('ip.blocked', false)

// ——— Licence: 7-day free trial per device, then $5 / year or $15 lifetime (activated from the admin dashboard) ———
export type License = { trialEnd?: string; subEnd?: string | null; lifetime?: boolean }
export const PRICES = { year: '$5', lifetime: '$15' }
export const WHATSAPP = '447473986835'
export const WHATSAPP_LABEL = '+44 7473 986835'
const DAY = 86400000
export function licenseInfo(): { state: 'trial' | 'active' | 'lifetime' | 'expired'; days: number; until?: number; wasPaid: boolean } {
  const l = read<License | null>('ip.license', null)
  let first = read<number>('ip.firstRun', 0)
  if (!first) write('ip.firstRun', (first = Date.now()))
  const now = Date.now()
  if (l?.lifetime) return { state: 'lifetime', days: 0, wasPaid: true }
  const paid = l?.subEnd ? Date.parse(l.subEnd + 'T23:59:59') : 0
  if (paid > now) return { state: 'active', days: Math.ceil((paid - now) / DAY), until: paid, wasPaid: true }
  const trialEnd = l?.trialEnd ? Date.parse(l.trialEnd) : first + 7 * DAY
  if (trialEnd > now) return { state: 'trial', days: Math.ceil((trialEnd - now) / DAY), until: trialEnd, wasPaid: false }
  return { state: 'expired', days: 0, wasPaid: !!paid }
}
export const isExpired = () => licenseInfo().state === 'expired'
export const whatsappLink = () =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi, I want to activate IPTV PLAYER.\nMAC Address: ${deviceId()}\nDevice Key: ${deviceKey()}`)}`

// An M3U link like http://host/get.php?username=…&password=… is an Xtream line: load it with the Xtream API
// (a few seconds) instead of downloading the whole M3U file (can be 300+ MB → stuck on "Loading playlist" on a Firestick).
const xtreamOf = (u?: string) => {
  const m = (u || '').trim().match(/^(https?:\/\/[^/?#]+)\/get\.php\?(.*)$/i)
  if (!m) return null
  const q = new URLSearchParams(m[2])
  const username = q.get('username'), password = q.get('password')
  return username && password ? { server: m[1], username, password } : null
}
export const toPlaylist = (c: CloudPlaylist): Playlist => ({
  id: 'cloud-' + c.id,
  name: c.name || 'My Playlist',
  ...(c.type === 'm3u' && xtreamOf(c.url)
    ? { type: 'xtream' as const, ...xtreamOf(c.url)!, url: undefined }
    : { type: c.type === 'm3u' ? ('m3u' as const) : ('xtream' as const), server: c.server, username: c.username, password: c.password, url: c.url }),
  epgUrl: c.epgUrl,
  cloud: true,
  addedAt: c.updatedAt ? Date.parse(c.updatedAt) || 0 : 0,
})
