import { getSettings } from './settings'

// Route a URL through the user's proxy (needed in browsers for CORS / http-on-https).
export function proxied(url: string, isStream = false): string {
  const s = getSettings()
  const p = (s.proxy || '').trim()
  if (!p || (isStream && !s.proxyStreams)) return url
  return p.includes('{url}') ? p.replace('{url}', encodeURIComponent(url)) : p + url
}

export async function fetchText(url: string, timeout = 45000): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    let r: Response
    try {
      r = await fetch(proxied(url), { signal: ctrl.signal })
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error('The server took too long to answer.')
      throw new Error(
        'Could not reach the server. Check the URL, or set a proxy in Settings › Network (browsers block some IPTV servers).'
      )
    }
    if (!r.ok) throw new Error(`Server error (HTTP ${r.status})`)
    return await r.text()
  } finally {
    clearTimeout(t)
  }
}

export async function fetchJSON(url: string, timeout?: number): Promise<any> {
  const t = await fetchText(url, timeout)
  try {
    return JSON.parse(t)
  } catch {
    throw new Error('The server returned an invalid response.')
  }
}
