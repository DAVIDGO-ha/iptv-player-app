import React, { useEffect, useMemo } from 'react'
import { useApp } from '../store'
import { Empty, Icon, Img, Spinner } from '../ui'
import { ChannelRow, Poster, Rail, playLive } from './common'
import { NeonTiles, ArtTV, ArtReel, ArtClap, ArtBall } from './Tiles'
import { SPORT_RE } from './Live'
import type { Item } from '../lib/types'

export function Loading() {
  const app = useApp()
  return (
    <div className="center-fill">
      <Spinner size={44} />
      <div className="muted">{app.loading}</div>
    </div>
  )
}

export function ErrorState() {
  const app = useApp()
  return (
    <Empty
      icon="info"
      title="Couldn’t load your playlist"
      text={app.error}
      action={
        <div className="row gap">
          <button className="btn primary" onClick={() => app.load(app.active, true)} data-autofocus>
            <Icon n="refresh" s={18} /> Try Again
          </button>
          <button className="btn" onClick={() => app.nav.push('settings')}>
            Settings
          </button>
          <button className="btn" onClick={() => app.nav.push('playlists')}>
            Playlists
          </button>
        </div>
      }
    />
  )
}

export function Home() {
  const app = useApp()
  const live = app.visible('live')
  const movies = app.visible('movie')
  const series = app.visible('series')

  // Big panels: load the first movie & series category so the home rails have content
  useEffect(() => {
    if (movies.lazy && !movies.items.length) {
      const c = movies.cats.find((x) => !app.isLocked(x))
      if (c) app.loadCat('movie', c.id)
    }
    if (series.lazy && !series.items.length) {
      const c = series.cats.find((x) => !app.isLocked(x))
      if (c) app.loadCat('series', c.id)
    }
  }, [movies.lazy, series.lazy])

  const byId = useMemo(() => {
    const m: Record<string, Item> = {}
    ;[...live.items, ...movies.items, ...series.items].forEach((i) => (m[i.kind + ':' + i.id] = i))
    return m
  }, [live, movies, series])

  const hist = Object.values(app.history).sort((a, b) => b.at - a.at)
  const cont = hist.filter((h) => h.kind !== 'live' && h.dur && h.pos && h.pos / h.dur < 0.95)
  const recentLive = hist.filter((h) => h.kind === 'live').map((h) => byId['live:' + h.id]).filter(Boolean).slice(0, 12)
  const favLive = app.favs.live.map((id) => byId['live:' + id]).filter(Boolean)
  const totalMovies = movies.lazy ? movies.cats.length : movies.items.length
  const totalSeries = series.lazy ? series.cats.length : series.items.length
  const newMovies = useMemo(() => [...movies.items].sort((a, b) => (b.added || 0) - (a.added || 0)).slice(0, 24), [movies])
  const topMovies = useMemo(() => movies.items.filter((m) => (m.rating || 0) >= 7).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 24), [movies])
  const newSeries = useMemo(() => [...series.items].sort((a, b) => (b.added || 0) - (a.added || 0)).slice(0, 24), [series])
  const hero = useMemo(() => {
    const pool = (topMovies.length ? topMovies : newMovies).filter((m) => m.logo).slice(0, 8)
    return pool[Math.floor(Math.random() * pool.length)]
  }, [topMovies, newMovies])

  const acc = app.catalog?.account?.user_info
  const sportsCount = useMemo(() => {
    const ids = new Set(live.cats.filter((c) => SPORT_RE.test(c.name)).map((c) => c.id))
    return live.items.filter((i) => ids.has(i.categoryId)).length
  }, [live])
  const resume = (h: (typeof hist)[0]) => {
    if (h.kind === 'movie') app.nav.push('movie', { id: h.id })
    else app.nav.push('series', { id: h.seriesId, resume: h.id })
  }

  return (
    <div className="page">
      <div className="home-top">
        <div>
          <div className="eyebrow">{greeting()}</div>
          <h1 className="home-title">What are you watching today?</h1>
        </div>
        {acc?.exp_date && (
          <button className="acct-pill" onClick={() => app.nav.push('account')}>
            <Icon n="user" s={16} /> Expires {new Date(Number(acc.exp_date) * 1000).toLocaleDateString()}
          </button>
        )}
      </div>

      <NeonTiles
        tiles={[
          { id: 'live', label: 'LIVE TV', sub: `${live.items.length.toLocaleString()} channels`, color: '#ff2d3a', art: <ArtTV />, onClick: () => app.nav.tab('live'), autofocus: true },
          { id: 'movies', label: 'MOVIES', sub: movies.lazy ? `${totalMovies} categories` : `${totalMovies.toLocaleString()} titles`, color: '#ffb020', art: <ArtReel />, onClick: () => app.nav.tab('movies') },
          { id: 'series', label: 'SERIES', sub: series.lazy ? `${totalSeries} categories` : `${totalSeries.toLocaleString()} shows`, color: '#a855ff', art: <ArtClap />, onClick: () => app.nav.tab('series') },
          { id: 'sports', label: 'SPORTS', sub: `${sportsCount.toLocaleString()} channels`, color: '#22d3ee', art: <ArtBall />, onClick: () => app.nav.tab('sports') },
        ]}
      />

      {newMovies.length > 0 && (
        <Rail title="Latest & Popular" action={<button className="link" onClick={() => app.nav.tab('movies')}>See All</button>}>
          {newMovies.map((m) => (
            <button key={m.id} className="land-card" onClick={() => app.nav.push('movie', { id: m.id, item: m })}>
              <div className="land-img">
                <Img src={m.logo} alt={m.name} className="cover" />
                {!!m.rating && <span className="rating"><Icon n="star" s={11} fill /> {m.rating.toFixed(1)}</span>}
              </div>
              <div className="poster-name ellip">{m.name}</div>
            </button>
          ))}
        </Rail>
      )}

      {cont.length > 0 && (
        <Rail title="Continue Watching">
          {cont.slice(0, 20).map((h) => (
            <button key={h.key} className="wide-card" onClick={() => resume(h)}>
              <div className="wide-img">
                <Img src={h.image} alt={h.name} className="cover" />
                <div className="pbar">
                  <i style={{ width: ((h.pos || 0) / (h.dur || 1)) * 100 + '%' }} />
                </div>
                <span className="play-badge">
                  <Icon n="play" fill s={16} />
                </span>
              </div>
              <div className="poster-name ellip">{h.seriesName || h.name}</div>
              <div className="poster-meta ellip">{h.kind === 'episode' ? `S${h.season} · E${h.episode}` : `${Math.round(((h.dur! - h.pos!) / 60))} min left`}</div>
            </button>
          ))}
        </Rail>
      )}

      {(favLive.length > 0 || recentLive.length > 0) && (
        <Rail title={favLive.length ? 'Favorite Channels' : 'Recently Watched Channels'}>
          {(favLive.length ? favLive : recentLive).map((c, _, arr) => (
            <button key={c.id} className="ch-tile" onClick={() => playLive(app, c, arr)}>
              <Img className="ch-tile-logo" src={c.logo} alt={c.name} />
              <span className="ellip small">{c.name}</span>
            </button>
          ))}
        </Rail>
      )}

      {topMovies.length > 0 && (
        <Rail title="Top Rated">
          {topMovies.map((m) => (
            <Poster key={m.id} item={m} onClick={() => app.nav.push('movie', { id: m.id, item: m })} />
          ))}
        </Rail>
      )}
      {newSeries.length > 0 && (
        <Rail title="Latest Series" action={<button className="link" onClick={() => app.nav.tab('series')}>See All</button>}>
          {newSeries.map((m) => (
            <Poster key={m.id} item={m} onClick={() => app.nav.push('series', { id: m.id, item: m })} />
          ))}
        </Rail>
      )}
      {!live.items.length && !totalMovies && !totalSeries && (
        <Empty icon="tv" title="This playlist is empty" text="Your provider returned no channels, movies or series." />
      )}
    </div>
  )
}

export { ChannelRow }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
