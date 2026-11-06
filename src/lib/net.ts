import { getSettings } from './settings'

// Route a URL through the user's proxy (needed in browsers for CORS / http-on-https).
export function proxied(url: string, isStream = false): string {
  const s = getSettings()
  const p = (s.proxy || '').trim()
  if (!p || (isStream && !s.proxyStreams)) return url
  return p.includes('{url}') ? p.replace('{url}', encodeURIComponent(url)) : p + url
}

const isNative = () => !!(window as any).Capacitor?.isNativePlatform?.()
// Some IPTV panels block browser user-agents; in the app we look like a normal IPTV player.
const PLAYER_UA = 'IPTVSmartersPlayer'

async function getOnce(url: string, timeout: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const init: RequestInit = { signal: ctrl.signal }
    if (isNative()) init.headers = { 'User-Agent': PLAYER_UA, Accept: '*/*' }
    return await fetch(proxied(url), init)
  } finally {
    clearTimeout(t)
  }
}

// Same link with the other protocol: many panels only answer on http, a few only on https.
const swapProto = (u: string) => (/^https:/i.test(u) ? u.replace(/^https:/i, 'http:') : /^http:/i.test(u) ? u.replace(/^http:/i, 'https:') : '')

// Remember which protocol answered for each host, so stream links use it too.
const protoOk = new Map<string, string>()
const hostOf = (u: string) => (u.match(/^https?:\/\/([^/?#]+)/i) || [])[1] || ''
export const fixProto = (u: string) => {
  const p = protoOk.get(hostOf(u))
  return p ? u.replace(/^https?:/i, p) : u
}

export async function fetchText(url: string, timeout = 45000): Promise<string> {
  let r: Response | undefined
  let last: any
  for (const u of [url, swapProto(url)].filter(Boolean)) {
    try {
      r = await getOnce(u, timeout)
      if (r.ok) protoOk.set(hostOf(u), u.slice(0, u.indexOf(':') + 1).toLowerCase())
      if (r.ok || r.status < 500) break
    } catch (e: any) {
      last = e
    }
  }
  if (!r) {
    if (last?.name === 'AbortError') throw new Error('The server took too long to answer. Try again in a moment.')
    const why = String(last?.message || last || '').slice(0, 120)
    throw new Error(
      isNative()
        ? `Could not reach the IPTV server. Check the link is correct and your subscription is active${why ? ` (${why})` : ''}.`
        : 'Could not reach the server. Check the URL, or set a proxy in Settings › Network (browsers block some IPTV servers).'
    )
  }
  if (r.status === 401 || r.status === 403) throw new Error(`The server refused the login (HTTP ${r.status}). Check username/password or that the line is active.`)
  if (!r.ok) throw new Error(`Server error (HTTP ${r.status}). The IPTV server may be down — try again later.`)
  return await r.text()
}

export async function fetchJSON(url: string, timeout?: number): Promise<any> {
  const t = await fetchText(url, timeout)
  try {
    return JSON.parse(t)
  } catch {
    throw new Error('The server returned an invalid response.')
  }
}
