import { idbGet, idbSet } from './idb'
import { fetchText, proxied } from './net'
import { parseM3U } from './m3u'
import { xtCatalog, liveUrl, movieUrl, episodeUrl } from './xtream'
import { getSettings } from './settings'
import type { Catalog, Episode, Item, Playlist } from './types'

export async function loadCatalog(p: Playlist, force = false, onStep?: (s: string) => void): Promise<Catalog> {
  const key = 'cat.' + p.id
  if (!force) {
    const c = await idbGet<Catalog>(key)
    if (c) return c
  }
  let cat: Catalog
  if (p.type === 'xtream') cat = await xtCatalog(p, onStep)
  else {
    let text: string | undefined
    if (p.file) text = await idbGet<string>('m3u.' + p.id)
    else {
      onStep?.('Downloading playlist…')
      text = await fetchText(p.url!, 180000)
    }
    if (!text) throw new Error('Playlist file is missing. Please add it again.')
    onStep?.('Reading playlist…')
    cat = parseM3U(text)
  }
  for (const k of ['live', 'movie', 'series'] as const) {
    if (cat[k].lazy) continue
    const counts: Record<string, number> = {}
    cat[k].items.forEach((i) => (counts[i.categoryId] = (counts[i.categoryId] || 0) + 1))
    cat[k].cats.forEach((c) => (c.count = counts[c.id] || 0))
    cat[k].cats = cat[k].cats.filter((c) => c.count)
  }
  await idbSet(key, cat)
  return cat
}

export function streamFor(p: Playlist, item: Item): string {
  let url = item.url || ''
  if (!url && p.type === 'xtream') {
    if (item.kind === 'live') url = liveUrl(p, item.id, getSettings().liveFormat)
    else if (item.kind === 'movie') url = movieUrl(p, item.id, item.ext)
  }
  return proxied(url, true)
}
export function episodeStream(p: Playlist, e: Episode): string {
  return proxied(e.url || episodeUrl(p, e.id, e.ext), true)
}
