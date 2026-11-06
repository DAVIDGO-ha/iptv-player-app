export type Kind = 'live' | 'movie' | 'series'

export type Playlist = {
  id: string
  name: string
  type: 'xtream' | 'm3u'
  server?: string
  username?: string
  password?: string
  url?: string // m3u url
  file?: boolean // m3u content stored in idb
  epgUrl?: string
  addedAt: number
  cloud?: boolean // added from the website (device activation)
}

export type Category = { id: string; name: string; kind: Kind; count?: number; adult?: boolean }

export type Item = {
  id: string
  kind: Kind
  name: string
  logo?: string // channel logo or poster
  categoryId: string
  num?: number
  epgId?: string
  url?: string // direct url (m3u)
  ext?: string
  archive?: boolean
  archiveDays?: number
  rating?: number
  added?: number
  year?: string
  plot?: string
  // m3u series episodes
  episodes?: Episode[]
}

export type Episode = {
  id: string
  season: number
  episode: number
  title: string
  ext?: string
  url?: string
  image?: string
  plot?: string
  duration?: string
}

export type Section = { cats: Category[]; items: Item[]; lazy?: boolean } // lazy = items loaded per category (big panels)
export type Catalog = {
  live: Section
  movie: Section
  series: Section
  fetchedAt: number
  epgUrl?: string
  account?: any
}

export type Programme = { start: number; stop: number; title: string; desc?: string }

export type HistoryEntry = {
  key: string
  kind: 'live' | 'movie' | 'episode'
  id: string
  name: string
  image?: string
  pos?: number
  dur?: number
  at: number
  seriesId?: string
  seriesName?: string
  season?: number
  episode?: number
}

export type PlayRequest = {
  kind: 'live' | 'movie' | 'episode' | 'catchup'
  title: string
  subtitle?: string
  url: string
  image?: string
  historyKey?: string
  history?: Omit<HistoryEntry, 'at' | 'pos' | 'dur' | 'key'>
  startAt?: number
  channels?: Item[] // zapping list for live
  index?: number
  episodes?: { list: Episode[]; index: number; seriesId: string; seriesName: string; image?: string }
}
