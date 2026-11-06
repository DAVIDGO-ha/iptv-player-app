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
  window.dispatchEvent(new Event('ip-blocked'))
  return Array.isArray(j?.playlists) ? j.playlists : []
}
export const isBlocked = () => !!read<boolean>('ip.blocked', false)

export const toPlaylist = (c: CloudPlaylist): Playlist => ({
  id: 'cloud-' + c.id,
  name: c.name || 'My Playlist',
  type: c.type === 'm3u' ? 'm3u' : 'xtream',
  server: c.server,
  username: c.username,
  password: c.password,
  url: c.url,
  epgUrl: c.epgUrl,
  cloud: true,
  addedAt: c.updatedAt ? Date.parse(c.updatedAt) || 0 : 0,
})
