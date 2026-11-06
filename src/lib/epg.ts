import { fetchText } from './net'
import { idbGet, idbSet } from './idb'
import type { Programme } from './types'

export type EpgData = { byId: Record<string, Programme[]>; names: Record<string, string>; loadedAt: number }

// "20240101120000 +0100" → ms
function xmltvTime(s: string): number {
  const m = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/)
  if (!m) return 0
  const [, y, mo, d, h, mi, se, tz] = m
  let t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(se || 0))
  if (tz) {
    const sign = tz[0] === '-' ? -1 : 1
    t -= sign * (+tz.slice(1, 3) * 60 + +tz.slice(3, 5)) * 60000
  }
  return t
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&')
    .trim()

export function parseXmltv(xml: string): EpgData {
  const byId: Record<string, Programme[]> = {}
  const names: Record<string, string> = {}
  const now = Date.now()
  const from = now - 7 * 864e5
  const to = now + 3 * 864e5
  const chRe = /<channel\s+id="([^"]*)"[^>]*>([\s\S]*?)<\/channel>/g
  let m: RegExpExecArray | null
  while ((m = chRe.exec(xml))) {
    const dn = m[2].match(/<display-name[^>]*>([\s\S]*?)<\/display-name>/)
    if (dn) names[norm(decode(dn[1]))] = m[1]
  }
  const pRe = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/g
  while ((m = pRe.exec(xml))) {
    const at = m[1]
    const start = xmltvTime(at.match(/start="([^"]+)"/)?.[1] || '')
    const stop = xmltvTime(at.match(/stop="([^"]+)"/)?.[1] || '')
    if (stop < from || start > to) continue
    const ch = decode(at.match(/channel="([^"]+)"/)?.[1] || '')
    const title = decode(m[2].match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || '')
    const desc = decode(m[2].match(/<desc[^>]*>([\s\S]*?)<\/desc>/)?.[1] || '')
    ;(byId[ch] ||= []).push({ start, stop, title, desc })
  }
  for (const k in byId) byId[k].sort((a, b) => a.start - b.start)
  return { byId, names, loadedAt: Date.now() }
}

export const norm = (s: string) => s.toLowerCase().replace(/\b(hd|fhd|uhd|4k|sd|hevc)\b|[^a-z0-9]/g, '')

let mem: { key: string; data: EpgData } | null = null

export async function loadEpg(pid: string, url: string, force = false): Promise<EpgData> {
  const key = 'epg.' + pid
  if (!force && mem?.key === key) return mem.data
  if (!force) {
    const cached = await idbGet<EpgData>(key)
    if (cached && Date.now() - cached.loadedAt < 6 * 36e5) {
      mem = { key, data: cached }
      return cached
    }
  }
  const xml = await fetchText(url, 180000)
  const data = parseXmltv(xml)
  mem = { key, data }
  idbSet(key, data)
  return data
}
export const epgCached = (pid: string) => (mem?.key === 'epg.' + pid ? mem.data : null)

export function programmesFor(epg: EpgData | null, epgId?: string, name?: string): Programme[] {
  if (!epg) return []
  if (epgId && epg.byId[epgId]) return epg.byId[epgId]
  if (name) {
    const id = epg.names[norm(name)]
    if (id && epg.byId[id]) return epg.byId[id]
  }
  return []
}

export function nowNext(list: Programme[], offsetH = 0) {
  const t = Date.now() - offsetH * 36e5
  const i = list.findIndex((p) => p.start <= t && p.stop > t)
  return { now: i >= 0 ? list[i] : undefined, next: i >= 0 ? list[i + 1] : list.find((p) => p.start > t) }
}
