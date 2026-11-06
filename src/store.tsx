import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getSettings, onSettings, read, setSettings, write, type Settings } from './lib/settings'
import { episodeStream, loadCatalog, streamFor } from './lib/catalog'
import { playPro, proFor } from './lib/pro'
import { idbDel, idbGet, idbSet } from './lib/idb'
import { xtCategoryItems } from './lib/xtream'
import { fetchCloudPlaylists, isBlocked, toPlaylist } from './lib/cloud'
import type { Catalog, Category, HistoryEntry, Item, Kind, PlayRequest, Playlist } from './lib/types'

export type Route = { name: string; params?: any }
type Favs = Record<Kind, string[]>
type Toast = { id: number; text: string; action?: { label: string; run: () => void } }
export type Reminder = { id: string; channelId: string; channelName: string; title: string; start: number }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

function useStore() {
  const [settings, setS] = useState<Settings>(getSettings())
  useEffect(() => onSettings(setS) as any, [])

  const [playlists, setPlaylists] = useState<Playlist[]>(() => read('ip.playlists', []))
  const [activeId, setActiveId] = useState<string>(() => read('ip.active', ''))
  const active = playlists.find((p) => p.id === activeId) || playlists[0]
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string>('')

  const pid = active?.id || 'none'
  const [favs, setFavs] = useState<Favs>({ live: [], movie: [], series: [] })
  const [favItems, setFavItems] = useState<Record<string, Item>>({}) // snapshots so lazy-loaded favorites still show
  const [catItems, setCatItems] = useState<Record<string, Item[]>>({}) // kind:categoryId → items (lazy sections)
  const [catBusy, setCatBusy] = useState<string>('')
  const [history, setHistory] = useState<Record<string, HistoryEntry>>({})
  const [locked, setLocked] = useState<string[]>([])
  const [hidden, setHidden] = useState<string[]>([])
  const [unlocked, setUnlocked] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>(() => read('ip.reminders', []))

  useEffect(() => {
    setFavs(read('ip.fav.' + pid, { live: [], movie: [], series: [] }))
    setFavItems(read('ip.favi.' + pid, {}))
    setCatItems({})
    setHistory(read('ip.hist.' + pid, {}))
    setLocked(read('ip.lock.' + pid, []))
    setHidden(read('ip.hide.' + pid, []))
  }, [pid])

  const [stack, setStack] = useState<Route[]>([{ name: playlists.length ? 'home' : 'welcome' }])
  const route = stack[stack.length - 1]
  const [player, setPlayer] = useState<PlayRequest | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((text: string, action?: Toast['action']) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 9000 : 3200)
  }, [])

  const load = useCallback(
    async (p: Playlist | undefined, force = false) => {
      if (!p) return
      setError('')
      setLoading('Loading…')
      try {
        const c = await loadCatalog(p, force, setLoading)
        setCatalog(c)
        if (force) toast('Playlist updated')
      } catch (e: any) {
        setError(e?.message || String(e))
      } finally {
        setLoading(null)
      }
    },
    [toast]
  )
  useEffect(() => {
    setCatalog(null)
    load(active)
  }, [active?.id])

  const savePlaylists = (l: Playlist[]) => {
    setPlaylists(l)
    write('ip.playlists', l)
  }

  // ——— Website sync (device activation) ———
  const plRef = useRef(playlists)
  plRef.current = playlists
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<number>(0)
  const [blocked, setBlocked] = useState(isBlocked())
  useEffect(() => {
    const f = () => setBlocked(isBlocked())
    window.addEventListener('ip-blocked', f)
    return () => window.removeEventListener('ip-blocked', f)
  }, [])
  // while blocked, check every minute so an unblock works quickly
  useEffect(() => {
    if (!blocked) return
    const id = setInterval(() => syncCloud(), 60000)
    return () => clearInterval(id)
  }, [blocked])
  const syncCloud = useCallback(
    async (manual = false) => {
      setSyncing(true)
      try {
        const remote = (await fetchCloudPlaylists()).map(toPlaylist)
        const cur = plRef.current
        const local = cur.filter((p) => !p.cloud)
        const same = (a: Playlist, b?: Playlist) => !!b && JSON.stringify({ ...a, addedAt: 0 }) === JSON.stringify({ ...b, addedAt: 0 })
        const changed = remote.length !== cur.filter((p) => p.cloud).length || remote.some((r) => !same(r, cur.find((p) => p.id === r.id)))
        setLastSync(Date.now())
        if (!changed) {
          if (manual) toast('Playlists are up to date')
          return
        }
        const added = remote.filter((r) => !cur.some((p) => p.id === r.id))
        const next = [...local, ...remote]
        savePlaylists(next)
        // edited on the website → reload that playlist
        remote.forEach((r) => {
          const old = cur.find((p) => p.id === r.id)
          if (old && !same(r, old)) {
            idbDel('cat.' + r.id)
            idbDel('epg.' + r.id)
            if (r.id === activeId) load(r, true)
          }
        })
        const currentActive = next.find((p) => p.id === activeId)
        if (added.length && (!currentActive || !local.length)) {
          setActiveId(added[0].id)
          write('ip.active', added[0].id)
        } else if (!currentActive && next[0]) {
          setActiveId(next[0].id)
          write('ip.active', next[0].id)
        }
        if (added.length) {
          toast(`Playlist “${added[0].name}” added from the website`)
          setStack((s) => (s[0]?.name === 'welcome' ? [{ name: 'home' }] : s))
        } else toast('Playlists updated from the website')
        if (!next.length) setStack([{ name: 'welcome' }])
      } catch {
        if (manual) toast('Could not reach the website — check your internet')
      } finally {
        setSyncing(false)
      }
    },
    [activeId]
  )
  useEffect(() => {
    syncCloud()
    // fast while waiting for the first playlist, slow afterwards
    const id = setInterval(() => syncCloud(), plRef.current.length ? 5 * 60000 : 8000)
    return () => clearInterval(id)
  }, [playlists.length > 0])

  const nav = useMemo(
    () => ({
      push: (name: string, params?: any) => setStack((s) => [...s, { name, params }]),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      tab: (name: string) => setStack([{ name }]),
      replace: (name: string, params?: any) => setStack((s) => [...s.slice(0, -1), { name, params }]),
    }),
    []
  )

  const addPlaylist = async (p: Omit<Playlist, 'id' | 'addedAt'>, m3uText?: string, editId?: string) => {
    const id = editId || uid()
    const pl: Playlist = { ...p, id, addedAt: Date.now(), file: !!m3uText || p.file }
    if (m3uText) await idbSet('m3u.' + id, m3uText)
    const next = editId ? playlists.map((x) => (x.id === editId ? pl : x)) : [...playlists, pl]
    savePlaylists(next)
    setActiveId(id)
    write('ip.active', id)
    if (editId) {
      await idbDel('cat.' + id)
      await idbDel('epg.' + id)
      load(pl, true)
    }
    return pl
  }
  const removePlaylist = async (id: string) => {
    const next = playlists.filter((p) => p.id !== id)
    savePlaylists(next)
    ;['cat.', 'm3u.', 'epg.'].forEach((k) => idbDel(k + id))
    ;['ip.fav.', 'ip.hist.', 'ip.lock.', 'ip.hide.'].forEach((k) => localStorage.removeItem(k + id))
    if (activeId === id) {
      setActiveId(next[0]?.id || '')
      write('ip.active', next[0]?.id || '')
    }
    if (!next.length) setStack([{ name: 'welcome' }])
  }
  const selectPlaylist = (id: string) => {
    setActiveId(id)
    write('ip.active', id)
    setUnlocked(false)
  }

  const toggleFav = (kind: Kind, id: string, item?: Item) => {
    if (item) {
      const n = { ...favItems, [kind + ':' + id]: { ...item, episodes: undefined } }
      setFavItems(n)
      write('ip.favi.' + pid, n)
    }
    setFavs((f) => {
      const has = f[kind].includes(id)
      const n = { ...f, [kind]: has ? f[kind].filter((x) => x !== id) : [id, ...f[kind]] }
      write('ip.fav.' + pid, n)
      toast(has ? 'Removed from Favorites' : 'Added to Favorites')
      return n
    })
  }
  const isFav = (kind: Kind, id: string) => favs[kind].includes(id)

  const histRef = useRef(history)
  histRef.current = history
  const saveHistory = useCallback(
    (e: Omit<HistoryEntry, 'at'>) => {
      const n = { ...histRef.current, [e.key]: { ...e, at: Date.now() } }
      const keys = Object.keys(n).sort((a, b) => n[b].at - n[a].at)
      keys.slice(300).forEach((k) => delete n[k])
      setHistory(n)
      write('ip.hist.' + pid, n)
    },
    [pid]
  )
  const removeHistory = (key: string) => {
    const n = { ...history }
    delete n[key]
    setHistory(n)
    write('ip.hist.' + pid, n)
  }
  const clearHistory = () => {
    setHistory({})
    write('ip.hist.' + pid, {})
  }

  const toggleLock = (id: string) => {
    const n = locked.includes(id) ? locked.filter((x) => x !== id) : [...locked, id]
    setLocked(n)
    write('ip.lock.' + pid, n)
  }
  const toggleHide = (id: string) => {
    const n = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]
    setHidden(n)
    write('ip.hide.' + pid, n)
  }
  const isLocked = (c?: Category) => !!c && !unlocked && (locked.includes(c.id) || (settings.hideAdult && !!c.adult && !locked.includes('!' + c.id)))
  const lockedCats = useMemo(() => {
    const s = new Set<string>()
    if (!catalog || unlocked) return s
    for (const k of ['live', 'movie', 'series'] as const) catalog[k].cats.forEach((c) => isLocked(c) && s.add(c.id))
    return s
  }, [catalog, locked, unlocked, settings.hideAdult])

  // Lazy sections: load one category on demand (cached in IndexedDB for 12h)
  const loadCat = useCallback(
    async (kind: 'movie' | 'series', catId: string) => {
      const key = kind + ':' + catId
      if (!active || active.type !== 'xtream' || catItems[key]) return
      setCatBusy(key)
      try {
        const ck = `cati.${active.id}.${key}`
        const cached = await idbGet<{ at: number; items: Item[] }>(ck)
        let items = cached && Date.now() - cached.at < 12 * 36e5 ? cached.items : null
        if (!items) {
          items = await xtCategoryItems(active, kind, catId)
          idbSet(ck, { at: Date.now(), items })
        }
        setCatItems((c) => ({ ...c, [key]: items! }))
      } catch (e: any) {
        toast(e?.message || 'Could not load this category')
      } finally {
        setCatBusy('')
      }
    },
    [active?.id, catItems]
  )

  // visible = not hidden, not locked (lazy sections include every category loaded so far)
  const visible = useCallback(
    (kind: Kind) => {
      if (!catalog) return { cats: [] as Category[], items: [] as Item[], lazy: false }
      const hid = new Set(hidden)
      const cats = catalog[kind].cats.filter((c) => !hid.has(c.id))
      const lazy = !!catalog[kind].lazy
      const all = lazy ? Object.entries(catItems).flatMap(([k, v]) => (k.startsWith(kind + ':') ? v : [])) : catalog[kind].items
      const items = all.filter((i) => !hid.has(i.categoryId) && !lockedCats.has(i.categoryId))
      return { cats, items, lazy }
    },
    [catalog, hidden, lockedCats, catItems]
  )
  const findItem = (kind: Kind, id: string): Item | undefined =>
    catalog?.[kind].items.find((i) => i.id === id) ||
    Object.entries(catItems).find(([k, v]) => k.startsWith(kind + ':') && v.some((i) => i.id === id))?.[1].find((i) => i.id === id) ||
    favItems[kind + ':' + id]

  // Firestick / Android TV: everything plays in the Pro player (VLC engine) — picture + every sound format,
  // CH+/CH– and Up/Down change channel. Phones / laptops keep the built-in player.
  const play = (req: PlayRequest | null) => {
    if (!req || !active || !proFor(req.kind, req.url)) return setPlayer(req)
    const live = req.kind === 'live'
    const list = live && req.channels?.length ? req.channels : null
    const eps = !live && req.episodes ? req.episodes : null
    playPro({
      url: req.url,
      title: req.title + (req.subtitle ? ' — ' + req.subtitle : ''),
      start: req.startAt || 0,
      live,
      urls: list ? list.map((c) => streamFor(active, c)) : eps ? eps.list.map((e) => episodeStream(active, e)) : [],
      titles: list ? list.map((c) => (c.num ? c.num + '  ' : '') + c.name) : eps ? eps.list.map((e) => `${eps.seriesName} — S${e.season} E${e.episode} ${e.title}`) : [],
      index: list ? req.index || 0 : eps ? eps.index : 0,
    })
      .then((r) => {
        if (live) {
          const ch = list ? list[r?.index ?? req.index ?? 0] : null
          if (ch) saveHistory({ key: 'live:' + ch.id, kind: 'live', id: ch.id, name: ch.name, image: ch.logo, pos: 0, dur: 0 })
          else if (req.historyKey && req.history) saveHistory({ key: req.historyKey, ...req.history, pos: 0, dur: 0 })
        } else if (r && r.pos > 3) {
          const e = eps ? eps.list[r.index] : null
          if (e) saveHistory({ key: 'ep:' + e.id, kind: 'episode', id: e.id, name: e.title, image: e.image || eps!.image, seriesId: eps!.seriesId, seriesName: eps!.seriesName, season: e.season, episode: e.episode, pos: r.pos, dur: r.dur })
          else if (req.historyKey && req.history) saveHistory({ key: req.historyKey, ...req.history, pos: r.pos, dur: r.dur })
        }
      })
      .catch(() => setPlayer(req)) // Pro player unavailable → built-in player
  }

  const addReminder = (r: Omit<Reminder, 'id'>) => {
    const n = [...reminders.filter((x) => x.start > Date.now()), { ...r, id: uid() }]
    setReminders(n)
    write('ip.reminders', n)
    toast(`Reminder set for “${r.title}”`)
  }
  const removeReminder = (id: string) => {
    const n = reminders.filter((x) => x.id !== id)
    setReminders(n)
    write('ip.reminders', n)
  }

  return {
    settings,
    setSettings,
    playlists,
    active,
    catalog,
    loading,
    error,
    load,
    addPlaylist,
    removePlaylist,
    selectPlaylist,
    favs,
    toggleFav,
    isFav,
    history,
    saveHistory,
    removeHistory,
    clearHistory,
    locked,
    toggleLock,
    hidden,
    toggleHide,
    isLocked,
    unlocked,
    setUnlocked,
    visible,
    loadCat,
    syncCloud,
    syncing,
    lastSync,
    blocked,
    catItems,
    catBusy,
    findItem,
    favItems,
    reminders,
    addReminder,
    removeReminder,
    route,
    stack,
    nav,
    player,
    play,
    toasts,
    toast,
  }
}

export type Store = ReturnType<typeof useStore>
const Ctx = createContext<Store>(null as any)
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const s = useStore()
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>
}
export const useApp = () => useContext(Ctx)
