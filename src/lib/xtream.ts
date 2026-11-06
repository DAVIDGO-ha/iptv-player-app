import { fetchJSON } from './net'
import type { Catalog, Category, Item, Playlist, Programme, Kind, Episode } from './types'

const enc = encodeURIComponent
export const base = (p: Playlist) => {
  let s = (p.server || '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s
  return s
}
const api = (p: Playlist, action = '', extra = '') =>
  `${base(p)}/player_api.php?username=${enc(p.username!)}&password=${enc(p.password!)}${action ? '&action=' + action : ''}${extra}`

const ADULT = /(adult|xxx|18\+|porn|\+18|for adults)/i

export async function xtLogin(p: Playlist) {
  const j = await fetchJSON(api(p), 20000)
  if (!j || !j.user_info) throw new Error('This is not a valid Xtream Codes server.')
  if (j.user_info.auth === 0 || j.user_info.auth === '0') throw new Error('Wrong username or password.')
  if (j.user_info.status && j.user_info.status !== 'Active') throw new Error(`Account status: ${j.user_info.status}`)
  return j
}

function cats(list: any[], kind: Kind): Category[] {
  return (Array.isArray(list) ? list : []).map((c) => ({
    id: String(c.category_id),
    name: String(c.category_name || 'Unnamed'),
    kind,
    adult: ADULT.test(c.category_name || ''),
  }))
}

export async function xtCatalog(p: Playlist, onStep?: (s: string) => void): Promise<Catalog> {
  onStep?.('Signing in…')
  const account = await xtLogin(p)
  onStep?.('Loading channels…')
  const [lc, ls] = await Promise.all([fetchJSON(api(p, 'get_live_categories')), fetchJSON(api(p, 'get_live_streams'), 90000)])
  onStep?.('Loading movie & series categories…')
  // Movies & series are loaded per category on demand — big panels have 100k+ titles
  const [vc, sc] = await Promise.all([fetchJSON(api(p, 'get_vod_categories')), fetchJSON(api(p, 'get_series_categories'))])

  const live: Item[] = (Array.isArray(ls) ? ls : []).map((s: any, i: number) => ({
    id: String(s.stream_id),
    kind: 'live',
    name: String(s.name || '').trim(),
    logo: s.stream_icon || '',
    categoryId: String(s.category_id ?? ''),
    num: Number(s.num) || i + 1,
    epgId: s.epg_channel_id || '',
    archive: Number(s.tv_archive) === 1,
    archiveDays: Number(s.tv_archive_duration) || 0,
    added: Number(s.added) || 0,
  }))
  return {
    live: { cats: cats(lc, 'live'), items: live },
    movie: { cats: cats(vc, 'movie'), items: [], lazy: true },
    series: { cats: cats(sc, 'series'), items: [], lazy: true },
    fetchedAt: Date.now(),
    epgUrl: `${base(p)}/xmltv.php?username=${enc(p.username!)}&password=${enc(p.password!)}`,
    account,
  }
}

export const mapMovie = (s: any): Item => ({
    id: String(s.stream_id),
    kind: 'movie',
    name: String(s.name || '').trim(),
    logo: s.stream_icon || '',
    categoryId: String(s.category_id ?? ''),
    ext: s.container_extension || 'mp4',
    rating: parseFloat(s.rating_5based ? s.rating_5based * 2 : s.rating) || 0,
    added: Number(s.added) || 0,
    year: s.year || '',
  })
export const mapSeries = (s: any): Item => ({
    id: String(s.series_id),
    kind: 'series',
    name: String(s.name || '').trim(),
    logo: s.cover || '',
    categoryId: String(s.category_id ?? ''),
    rating: parseFloat(s.rating_5based ? s.rating_5based * 2 : s.rating) || 0,
    added: Number(s.last_modified) || 0,
    year: (s.releaseDate || s.release_date || '').slice(0, 4),
    plot: s.plot || '',
  })

export async function xtCategoryItems(p: Playlist, kind: 'movie' | 'series', catId: string): Promise<Item[]> {
  const action = kind === 'movie' ? 'get_vod_streams' : 'get_series'
  const j = await fetchJSON(api(p, action, `&category_id=${encodeURIComponent(catId)}`), 90000)
  return (Array.isArray(j) ? j : []).map(kind === 'movie' ? mapMovie : mapSeries)
}

const u = (p: Playlist) => `${enc(p.username!)}/${enc(p.password!)}`
export const liveUrl = (p: Playlist, id: string, fmt: string) => `${base(p)}/live/${u(p)}/${id}.${fmt}`
export const movieUrl = (p: Playlist, id: string, ext = 'mp4') => `${base(p)}/movie/${u(p)}/${id}.${ext}`
export const episodeUrl = (p: Playlist, id: string, ext = 'mp4') => `${base(p)}/series/${u(p)}/${id}.${ext}`

// Server-local "YYYY-MM-DD HH:MM:SS" → catch-up url
export function timeshiftUrl(p: Playlist, id: string, startLocal: string, minutes: number) {
  const m = startLocal.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  const ts = m ? `${m[1]}-${m[2]}-${m[3]}:${m[4]}-${m[5]}` : startLocal
  return `${base(p)}/timeshift/${u(p)}/${Math.max(1, Math.round(minutes))}/${ts}/${id}.ts`
}

export async function xtVodInfo(p: Playlist, id: string) {
  const j = await fetchJSON(api(p, 'get_vod_info', `&vod_id=${id}`))
  return { info: j?.info || {}, movie: j?.movie_data || {} }
}

export async function xtSeriesInfo(p: Playlist, id: string): Promise<{ info: any; seasons: number[]; episodes: Episode[] }> {
  const j = await fetchJSON(api(p, 'get_series_info', `&series_id=${id}`))
  const eps: Episode[] = []
  const raw = j?.episodes || {}
  const groups = Array.isArray(raw) ? raw : Object.values(raw)
  for (const g of groups as any[])
    for (const e of g || [])
      eps.push({
        id: String(e.id),
        season: Number(e.season) || 1,
        episode: Number(e.episode_num) || 0,
        title: e.title || `Episode ${e.episode_num}`,
        ext: e.container_extension || 'mp4',
        image: e.info?.movie_image || '',
        plot: e.info?.plot || '',
        duration: e.info?.duration || '',
      })
  eps.sort((a, b) => a.season - b.season || a.episode - b.episode)
  const seasons = [...new Set(eps.map((e) => e.season))]
  return { info: j?.info || {}, seasons, episodes: eps }
}

function b64(s: string) {
  try {
    const bin = atob(s)
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
  } catch {
    return s
  }
}

export async function xtShortEpg(p: Playlist, id: string, limit = 6): Promise<Programme[]> {
  const j = await fetchJSON(api(p, 'get_short_epg', `&stream_id=${id}&limit=${limit}`), 15000)
  return (j?.epg_listings || []).map((e: any) => ({
    start: Number(e.start_timestamp) * 1000,
    stop: Number(e.stop_timestamp) * 1000,
    title: b64(e.title || ''),
    desc: b64(e.description || ''),
  }))
}

// Past programmes (for catch-up) — keeps the server-local start string
export async function xtArchive(p: Playlist, id: string) {
  const j = await fetchJSON(api(p, 'get_simple_data_table', `&stream_id=${id}`), 20000)
  return (j?.epg_listings || [])
    .map((e: any) => ({
      start: Number(e.start_timestamp) * 1000,
      stop: Number(e.stop_timestamp) * 1000,
      startLocal: e.start as string,
      title: b64(e.title || ''),
      desc: b64(e.description || ''),
      hasArchive: Number(e.has_archive) === 1,
    }))
    .filter((e: any) => e.stop < Date.now())
}
