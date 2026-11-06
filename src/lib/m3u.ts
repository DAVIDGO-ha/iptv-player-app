import type { Catalog, Category, Item, Kind, Episode } from './types'

const VOD_EXT = /\.(mp4|mkv|avi|mov|m4v|wmv|flv|webm|mpg|mpeg)(\?|$)/i
const SERIES_RE = /^(.*?)[\s._\-|]*S(\d{1,2})[\s._-]*E(\d{1,4})/i
const ADULT = /(adult|xxx|18\+|porn|\+18)/i

function hash(s: string) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function parseM3U(text: string): Catalog {
  if (!/#EXTM3U/i.test(text.slice(0, 2000)) && !/#EXTINF/i.test(text.slice(0, 5000)))
    throw new Error('This file is not a valid M3U playlist.')
  const lines = text.split(/\r?\n/)
  const header = lines[0] || ''
  const epg = header.match(/(?:url-tvg|x-tvg-url)="([^"]+)"/i)?.[1]?.split(',')[0]

  const catMaps: Record<Kind, Map<string, Category>> = { live: new Map(), movie: new Map(), series: new Map() }
  const live: Item[] = []
  const movie: Item[] = []
  const seriesMap = new Map<string, Item>()
  let info: any = null
  let group = ''

  const cat = (kind: Kind, name: string) => {
    const n = name || 'Uncategorized'
    const id = kind[0] + hash(n)
    if (!catMaps[kind].has(id)) catMaps[kind].set(id, { id, name: n, kind, adult: ADULT.test(n) })
    return id
  }

  for (let raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#EXTINF')) {
      const attrs: Record<string, string> = {}
      line.replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => ((attrs[k.toLowerCase()] = v), ''))
      const stripped = line.replace(/([\w-]+)="([^"]*)"/g, '')
      const name = stripped.slice(stripped.indexOf(',') + 1).trim() || attrs['tvg-name'] || 'Unknown'
      info = { attrs, name, dur: parseFloat(line.slice(8)) }
      group = attrs['group-title'] || ''
      continue
    }
    if (line.startsWith('#EXTGRP:')) {
      group = line.slice(8).trim()
      if (info) info.attrs['group-title'] ||= group
      continue
    }
    if (line.startsWith('#')) continue
    if (!info) info = { attrs: {}, name: line.split('/').pop() || 'Stream', dur: -1 }
    const url = line
    const a = info.attrs
    const g = a['group-title'] || group
    const logo = a['tvg-logo'] || ''
    const isSeriesUrl = /\/series\//i.test(url)
    const isMovieUrl = /\/movie\//i.test(url)
    const sm = info.name.match(SERIES_RE)
    if (isSeriesUrl || (sm && (VOD_EXT.test(url) || !/\/live\//i.test(url)) && !(a['tvg-id'] && !VOD_EXT.test(url)))) {
      const sname = (sm ? sm[1] : info.name).replace(/[\s._\-|]+$/, '').trim() || info.name
      const key = g + '|' + sname.toLowerCase()
      let s = seriesMap.get(key)
      if (!s) {
        s = { id: 's' + hash(key), kind: 'series', name: sname, logo, categoryId: cat('series', g), episodes: [] }
        seriesMap.set(key, s)
      }
      const ep: Episode = {
        id: 'e' + hash(url),
        season: sm ? Number(sm[2]) : 1,
        episode: sm ? Number(sm[3]) : s.episodes!.length + 1,
        title: info.name,
        url,
        image: logo,
      }
      s.episodes!.push(ep)
    } else if (isMovieUrl || VOD_EXT.test(url)) {
      movie.push({ id: 'm' + hash(url), kind: 'movie', name: info.name, logo, categoryId: cat('movie', g), url, ext: url.split('?')[0].split('.').pop() })
    } else {
      live.push({
        id: 'l' + hash(url + live.length),
        kind: 'live',
        name: info.name,
        logo,
        categoryId: cat('live', g),
        num: Number(a['tvg-chno']) || live.length + 1,
        epgId: a['tvg-id'] || '',
        url,
        archive: !!(a['catchup'] || a['catchup-days'] || a['tvg-rec']),
        archiveDays: Number(a['catchup-days'] || a['tvg-rec']) || 0,
      })
    }
    info = null
  }
  const series = [...seriesMap.values()]
  series.forEach((s) => s.episodes!.sort((a, b) => a.season - b.season || a.episode - b.episode))
  return {
    live: { cats: [...catMaps.live.values()], items: live },
    movie: { cats: [...catMaps.movie.values()], items: movie },
    series: { cats: [...catMaps.series.values()], items: series },
    fetchedAt: Date.now(),
    epgUrl: epg,
  }
}
