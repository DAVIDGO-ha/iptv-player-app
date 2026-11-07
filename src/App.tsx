import React, { useEffect, useRef } from 'react'
import { useApp } from './store'
import { Icon, Logo } from './ui'
import { Player } from './player/Player'
import { Welcome, AddPlaylist, Playlists, Blocked, Locked } from './screens/Playlists'
import { Home, Loading, ErrorState } from './screens/Home'
import { Live } from './screens/Live'
import { Guide } from './screens/Guide'
import { Library, MovieDetail, SeriesDetail } from './screens/Vod'
import { Search, Favorites, More, MultiView, History, Account } from './screens/Other'
import { Settings } from './screens/Settings'
import { playLive } from './screens/common'

const NAV = [
  ['home', 'Home'],
  ['live', 'Live TV'],
  ['movies', 'Movies'],
  ['series', 'Series'],
  ['sports', 'Sports'],
  ['guide', 'TV Guide'],
]
const ICONS = [
  ['search', 'search', 'Search'],
  ['favorites', 'heart', 'Favorites'],
  ['multiview', 'grid', 'Multi-View'],
  ['settings', 'user', 'Settings'],
]
const TABS = [
  ['home', 'home', 'Home'],
  ['live', 'live', 'Live TV'],
  ['movies', 'movie', 'Movies'],
  ['series', 'series', 'Series'],
  ['more', 'more', 'More'],
]
const NEEDS_CATALOG = ['home', 'live', 'sports', 'guide', 'movies', 'series', 'search', 'favorites', 'multiview', 'movie', 'series', 'history']

export function App() {
  const app = useApp()
  const { route, settings } = app
  const main = useRef<HTMLDivElement>(null)

  // Theme + accent
  useEffect(() => {
    const r = document.documentElement
    const dark = settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    r.dataset.theme = dark ? 'dark' : 'light'
    r.style.setProperty('--accent', settings.accent)
    r.style.setProperty('--on-accent', settings.accent === '#FFFFFF' ? '#000' : '#fff')
  }, [settings.theme, settings.accent])

  // Global back button (remote / browser / Escape)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (app.player) return
      const isBack = ['Escape', 'GoBack', 'BrowserBack'].includes(e.key) || [10009, 461].includes(e.keyCode) || (e.key === 'Backspace' && !(e.target as HTMLElement).matches('input,textarea'))
      if (!isBack) return
      const modal = document.querySelector('.modal-wrap .modal-head .icon-btn') as HTMLElement | null
      e.preventDefault()
      if (modal) return modal.click()
      if (app.stack.length > 1) app.nav.back()
      else if (route.name !== 'home' && app.playlists.length) app.nav.tab('home')
      else if ((window as any).tizen) (window as any).tizen.application.getCurrentApplication().exit()
      else if ((window as any).webOS) (window as any).webOS.platformBack?.()
      else (window as any).Capacitor?.Plugins?.App?.exitApp?.()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  useEffect(() => {
    main.current?.scrollTo({ top: 0 })
    setTimeout(() => {
      const el = (main.current?.querySelector('[data-autofocus]') as HTMLElement) || null
      if (el && matchMedia('(hover: none), (min-width: 1600px)').matches) el.focus({ preventScroll: true })
    }, 60)
  }, [route])

  // Start with last channel
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !app.catalog || !settings.autostartLast) return
    started.current = true
    try {
      const last = JSON.parse(localStorage.getItem('ip.lastLive') || 'null')
      if (last?.pid !== app.active?.id) return
      const ch = app.catalog.live.items.find((i) => i.id === last.id)
      if (ch) playLive(app, ch, app.catalog.live.items.filter((i) => i.categoryId === ch.categoryId))
    } catch {}
  }, [app.catalog])

  // Programme reminders
  useEffect(() => {
    const id = setInterval(() => {
      const due = app.reminders.filter((r) => r.start <= Date.now() + 60000)
      due.forEach((r) => {
        app.removeReminder(r.id)
        const ch = app.catalog?.live.items.find((i) => i.id === r.channelId)
        app.toast(`“${r.title}” starts now on ${r.channelName}`, ch ? { label: 'Watch', run: () => playLive(app, ch) } : undefined)
      })
    }, 20000)
    return () => clearInterval(id)
  }, [app.reminders, app.catalog])

  const p = route.params || {}
  let screen: React.ReactNode
  const needs = NEEDS_CATALOG.includes(route.name)
  if (route.name === 'welcome') screen = <Welcome />
  else if (route.name === 'add') screen = <AddPlaylist />
  else if (route.name === 'edit') screen = <AddPlaylist edit={app.playlists.find((x) => x.id === p.id)} />
  else if (route.name === 'playlists') screen = <Playlists />
  else if (route.name === 'settings') screen = <Settings />
  else if (route.name === 'more') screen = <More />
  else if (route.name === 'account') screen = <Account />
  else if (needs && app.loading) screen = <Loading />
  else if (needs && app.error) screen = <ErrorState />
  else if (needs && !app.catalog) screen = <Loading />
  else if (route.name === 'home') screen = <Home />
  else if (route.name === 'live') screen = <Live key="live" />
  else if (route.name === 'sports') screen = <Live sports key="sports" />
  else if (route.name === 'guide') screen = <Guide />
  else if (route.name === 'movies') screen = <Library kind="movie" key="m" />
  else if (route.name === 'series' && !p.id) screen = <Library kind="series" key="s" />
  else if (route.name === 'movie') screen = <MovieDetail id={p.id} given={p.item} key={p.id} />
  else if (route.name === 'series') screen = <SeriesDetail id={p.id} resume={p.resume} given={p.item} key={p.id} />
  else if (route.name === 'search') screen = <Search />
  else if (route.name === 'favorites') screen = <Favorites />
  else if (route.name === 'multiview') screen = <MultiView />
  else if (route.name === 'history') screen = <History />
  else screen = <Home />

  if (app.blocked) return <Blocked />
  if (app.expired) return <Locked />

  const bare = route.name === 'welcome' || !app.playlists.length
  const root = app.stack[0].name
  const tabOf = (r: string) => (['sports', 'guide', 'search', 'favorites', 'multiview', 'settings', 'history', 'playlists', 'account'].includes(r) ? 'more' : r)

  return (
    <div className={'app ' + (bare ? 'bare' : '')}>
      {!bare && (
        <header className="topbar" aria-label="Main">
          <button className="brand" onClick={() => app.nav.tab('home')} aria-label="IPTV PLAYER home">
            <Logo size={34} />
            <span>
              IPTV <b>PLAYER</b>
            </span>
          </button>
          <nav className="top-nav">
            {NAV.map(([r, l]) => (
              <button key={r} className={'top-link ' + (root === r ? 'on' : '')} onClick={() => app.nav.tab(r)}>
                {l}
              </button>
            ))}
          </nav>
          <div className="top-icons">
            <Clock />
            {ICONS.map(([r, ic, l]) => (
              <button key={r} className={'icon-btn ' + (root === r ? 'on' : '')} onClick={() => app.nav.tab(r)} aria-label={l} title={l}>
                <Icon n={ic} />
              </button>
            ))}
            <button className="pl-chip" onClick={() => app.nav.tab('playlists')} title="Playlists">
              <Icon n="list" s={16} />
              <span className="ellip">{app.active?.name}</span>
            </button>
          </div>
        </header>
      )}
      <main className="main" ref={main}>
        {screen}
      </main>
      {!bare && (
        <nav className="tabbar glass" aria-label="Tabs">
          {TABS.map(([r, ic, l]) => (
            <button key={r} className={tabOf(root) === r ? 'on' : ''} onClick={() => app.nav.tab(r)}>
              <Icon n={ic} />
              <span>{l}</span>
            </button>
          ))}
        </nav>
      )}
      <Player />
      <div className="toasts">
        {app.toasts.map((t) => (
          <div key={t.id} className="toast glass">
            <span>{t.text}</span>
            {t.action && (
              <button className="link" onClick={t.action.run}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Clock() {
  const [t, setT] = React.useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  const app = useApp()
  return <span className="clock">{t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: app.settings.timeFormat === '12' })}</span>
}
