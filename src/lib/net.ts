import { getSettings, read, write } from './settings'
import { SITE_URL } from '../config'

// ——— Anti-block route (no VPN): when an internet provider blocks an IPTV server by name (DNS block — common in
// the UK and Germany), the app looks up the server's real address with Cloudflare / Google and connects to that
// address instead. Once a server needed it, the app keeps using it — new clients may wait once, never again. ———
type Route = { ip: string; at: number }
let routes: Record<string, Route> = read('ip.routes', {}) // host → working IP address
const okHosts = new Set<string>(read<string[]>('ip.okHosts', [])) // hosts that loaded at least once (direct or swapped)
const hostOf = (u: string) => (u.match(/^https?:\/\/([^/?#:]+)/i) || [])[1]?.toLowerCase() || ''
const isIp = (h: string) => /^\d+\.\d+\.\d+\.\d+$/.test(h)
const saveRoutes = () => write('ip.routes', routes)
const markOk = (h: string) => {
  if (!h || okHosts.has(h)) return
  okHosts.add(h)
  write('ip.okHosts', [...okHosts].slice(-200))
}
/** Use the saved working address for a blocked server (also for every channel / movie / episode link). */
export function routed(url: string): string {
  const h = hostOf(url)
  const r = h && routes[h]
  return r ? url.replace(/^(https?:\/\/)[^/?#:]+/i, '$1' + r.ip) : url
}
// Ask OUR server (www.iptv-player-tv.com) for the IPTV server's real address — it looks it up outside the
// customer's internet provider. Nothing else: no VPN, no tunnel.
async function dohResolve(host: string): Promise<string[]> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10000)
  try {
    const r = await fetch(SITE_URL + '/api/device/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host }), signal: ctrl.signal })
    const j = await r.json()
    return (Array.isArray(j?.ips) ? j.ips : []).filter((x: any) => isIp(String(x)))
  } catch {
    return []
  } finally {
    clearTimeout(t)
  }
}
/** Tell our server a playlist failed to load (and whether the app fixed it) → shown in the admin dashboard. */
function report(host: string, error: string, fixed: boolean) {
  try {
    fetch(SITE_URL + '/api/device/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, error, fixed, report: true, id: read('ip.device', '') }) }).catch(() => {})
  } catch {}
}
/** Saved routes are refreshed in the background (the provider may move the server to a new address). */
export async function refreshRoutes() {
  for (const h of Object.keys(routes)) {
    if (Date.now() - routes[h].at < 10 * 60000) continue
    const ips = await dohResolve(h)
    if (ips.length) routes[h] = { ip: ips[0], at: Date.now() }
  }
  saveRoutes()
}

// Route a URL through the user's proxy (needed in browsers for CORS / http-on-https).
export function proxied(url: string, isStream = false): string {
  url = routed(url)
  const s = getSettings()
  const p = (s.proxy || '').trim()
  if (!p || (isStream && !s.proxyStreams)) return url
  return p.includes('{url}') ? p.replace('{url}', encodeURIComponent(url)) : p + url
}

const isNative = () => !!(window as any).Capacitor?.isNativePlatform?.()
// Some IPTV panels block browser user-agents; in the app we look like a normal IPTV player.
const PLAYER_UA = 'IPTVSmartersPlayer'

async function getOnce(url: string, timeout: number, hostHeader?: string): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const init: RequestInit = { signal: ctrl.signal }
    if (isNative()) init.headers = { 'User-Agent': PLAYER_UA, Accept: '*/*', ...(hostHeader ? { Host: hostHeader } : {}) }
    return await fetch(proxied(url), init)
  } finally {
    clearTimeout(t)
  }
}

// Same link with the other protocol: many panels only answer on http, a few only on https.
const swapProto = (u: string) => (/^https:/i.test(u) ? u.replace(/^https:/i, 'http:') : /^http:/i.test(u) ? u.replace(/^http:/i, 'https:') : '')

// Remember which protocol answered for each host, so stream links use it too.
const protoOk = new Map<string, string>()
export const fixProto = (u: string) => {
  const p = protoOk.get(hostOf(u))
  return p ? u.replace(/^https?:/i, p) : u
}

const FIRST_WAIT = 5 * 60000 // a new client's first load may take up to 5 minutes — after that, never again

export async function fetchText(url: string, timeout = 45000): Promise<string> {
  let r: Response | undefined
  let last: any
  const host = hostOf(url)
  // First time with this server: be patient (big panels can take minutes the very first time)
  const firstTime = !!host && !isIp(host) && !okHosts.has(host) && !routes[host]
  const wait = firstTime ? Math.max(timeout, FIRST_WAIT) : timeout
  const tryAll = async (tm: number) => {
    for (const u of [url, swapProto(url)].filter(Boolean)) {
      try {
        r = await getOnce(u, tm, routes[host] ? host : undefined)
        if (r.ok) protoOk.set(hostOf(u), u.slice(0, u.indexOf(':') + 1).toLowerCase())
        if (r.ok || r.status < 500) return
      } catch (e: any) {
        last = e
        r = undefined
      }
    }
  }
  await tryAll(wait)
  // Blocked / not answering → switch to the server's real address (looked up outside the internet provider) and keep it
  if ((!r || r.status >= 500) && host && !isIp(host)) {
    const had = routes[host]
    if (had) {
      // the saved address stopped working → maybe the block is gone: try the normal way once
      delete routes[host]
      await tryAll(Math.min(timeout, 30000))
    }
    if (!r || r.status >= 500) {
      const ips = await dohResolve(host)
      for (const ip of ips) {
        routes[host] = { ip, at: Date.now() }
        await tryAll(Math.max(timeout, 60000))
        if (r && r.status < 500) break
        delete routes[host]
      }
    }
    saveRoutes()
    report(host, String(last?.message || last || (r ? 'HTTP ' + r.status : 'no answer')).slice(0, 200), !!routes[host] && !!r && r.status < 500)
  }
  if (r && r.ok) markOk(host)
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
    // Some internet providers answer with their own "blocked" web page → use the server's real address instead
    const host = hostOf(url)
    if (host && !isIp(host) && !routes[host]) {
      for (const ip of await dohResolve(host)) {
        routes[host] = { ip, at: Date.now() }
        try {
          const j = JSON.parse(await fetchText(url, timeout))
          saveRoutes()
          report(host, 'Internet provider block page', true)
          return j
        } catch {
          delete routes[host]
        }
      }
    }
    if (host && !routes[host]) report(host, 'Invalid response (maybe a block page)', false)
    throw new Error('The server returned an invalid response.')
  }
}
