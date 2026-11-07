import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { Chips, Empty, Icon, Img, Spinner, useProgressive } from '../ui'
import { Header, Poster, SortSelect, sortItems, useGuardedCategory } from './common'
import { episodeStream, streamFor } from '../lib/catalog'
import { xtSeriesInfo, xtVodInfo } from '../lib/xtream'
import { useEngine } from '../player/useEngine'
import { useWide } from './Live'
import { autoProOk, mustPro, playPro } from '../lib/pro'
import type { Episode, Item, Kind, PlayRequest } from '../lib/types'

export function Library({ kind }: { kind: 'movie' | 'series' }) {
  const app = useApp()
  const { cats, items, lazy } = app.visible(kind)
  const saved = localStorage.getItem('ip.cat.' + kind) || 'all'
  const firstCat = cats.find((c) => !app.isLocked(c))?.id || 'fav'
  const g = useGuardedCategory(lazy && (saved === 'all' || (saved !== 'fav' && !cats.some((c) => c.id === saved))) ? firstCat : saved)
  useEffect(() => {
    if (lazy && g.cat !== 'fav' && g.cat !== 'all') app.loadCat(kind, g.cat)
  }, [g.cat, lazy])
  const busy = app.catBusy === kind + ':' + g.cat
  const [sort, setSort] = useState('def')
  const [q, setQ] = useState('')
  useEffect(() => localStorage.setItem('ip.cat.' + kind, g.cat), [g.cat])
  const list = useMemo(() => {
    let l =
      g.cat === 'all'
        ? items
        : g.cat === 'fav'
          ? (app.favs[kind].map((id) => app.findItem(kind, id)).filter(Boolean) as Item[])
          : items.filter((i) => i.categoryId === g.cat)
    if (q) {
      const s = q.toLowerCase()
      l = l.filter((i) => i.name.toLowerCase().includes(s))
    }
    return sortItems(l, sort)
  }, [items, g.cat, sort, q, app.favs, app.favItems])
  const { shown, sentinel } = useProgressive(list, 48)
  const title = kind === 'movie' ? 'Movies' : 'Series'
  const layout = useWide() // big screens: same layout as Live TV
  const wide = layout // phone, PC and TV: player on the right (full screen uses the Pro player on TVs)
  const [sel, setSel] = useState<Item | null>(null)
  // Big screens (laptop, TV, phone in landscape): play inside the dashboard, keep the list visible
  const open = (i: Item) => (wide ? setSel(i) : app.nav.push(kind, { id: i.id, item: i }))
  const prog = (i: Item) => {
    const h = app.history['mv:' + i.id]
    return h?.dur ? (h.pos || 0) / h.dur : undefined
  }

  if (!items.length && !cats.length && !lazy) return <Empty icon={kind} title={`No ${title.toLowerCase()}`} text={`This playlist doesn’t include ${title.toLowerCase()}.`} />

  const page = (
    <div className="page">
      <Header title={title} sub={busy ? 'Loading…' : `${list.length.toLocaleString()} titles${lazy && q ? ' in this category' : ''}`}>
        <div className="search-box">
          <Icon n="search" s={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} />
        </div>
        <SortSelect value={sort} onChange={setSort} />
      </Header>
      <Chips
        value={g.cat}
        onChange={(id) => g.pick(id, app.isLocked(cats.find((c) => c.id === id)))}
        items={[
          ...(lazy ? [] : [{ id: 'all', label: 'All', count: items.length }]),
          { id: 'fav', label: 'My List', count: app.favs[kind].length },
          ...cats.map((c) => ({ id: c.id, label: c.name, count: c.count, locked: app.isLocked(c) })),
        ]}
      />
      <div className="poster-grid">
        {shown.map((i) => (
          <Poster key={i.id} item={i} progress={kind === 'movie' ? prog(i) : undefined} active={sel?.id === i.id} onClick={() => open(i)} />
        ))}
      </div>
      {sentinel}
      {busy && (
        <div className="center-fill" style={{ height: 240 }}>
          <Spinner size={36} />
        </div>
      )}
      {!busy && !list.length && <Empty icon="search" title="Nothing here" text={g.cat === 'fav' ? 'Add titles to My List to see them here.' : undefined} />}
      {g.pin}
    </div>
  )
  if (!layout) return page
  // Same design as Live TV: categories on the left, titles in the middle, the player / details on the right
  const catList = [
    ...(lazy ? [] : [{ id: 'all', name: kind === 'movie' ? 'All Movies' : 'All Series', count: items.length as number | undefined, locked: false }]),
    { id: 'fav', name: 'My List', count: app.favs[kind].length as number | undefined, locked: false },
    ...cats.map((c) => ({ id: c.id, name: c.name, count: c.count as number | undefined, locked: app.isLocked(c) })),
  ]
  return (
    <div className="live wide vod-live">
      <aside className="live-cats">
        <h1 className="large-title pad">{title}</h1>
        <div className="cat-scroll">
          {catList.map((c) => (
            <button key={c.id} className={'cat-row ' + (g.cat === c.id ? 'on' : '')} onClick={() => g.pick(c.id, c.locked)}>
              {c.id === 'fav' && <Icon n="heart" s={16} />}
              {c.locked && <Icon n="lock" s={15} />}
              <span className="ellip">{c.name}</span>
              {!!c.count && <span className="cnt">{c.count}</span>}
            </button>
          ))}
        </div>
      </aside>
      <section className="live-list">
        <div className="toolbar">
          <div className="search-box">
            <Icon n="search" s={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} />
          </div>
          <SortSelect value={sort} onChange={setSort} />
        </div>
        <div className="ch-scroll">
          {shown.map((i) => (
            <VodRow key={i.id} item={i} active={sel?.id === i.id} progress={kind === 'movie' ? prog(i) : undefined} fav={app.isFav(kind, i.id)} onClick={() => open(i)} />
          ))}
          {sentinel}
          {busy && (
            <div className="center-fill" style={{ height: 200 }}>
              <Spinner size={32} />
            </div>
          )}
          {!busy && !list.length && <Empty icon="search" title="Nothing here" text={g.cat === 'fav' ? 'Add titles to My List to see them here.' : undefined} />}
        </div>
      </section>
      {wide && (
        <section className="live-preview vod-preview">
          {sel ? (
            kind === 'movie' ? <MovieDetail key={sel.id} id={sel.id} given={sel} pane /> : <SeriesDetail key={sel.id} id={sel.id} given={sel} pane />
          ) : (
            <Empty icon={kind} title={kind === 'movie' ? 'Pick a movie' : 'Pick a series'} text="It plays right here — keep browsing while you watch. Use Full Screen any time." />
          )}
        </section>
      )}
      {g.pin}
    </div>
  )
}

// One title in the middle list (like a channel row): poster, name, year · rating
function VodRow({ item, active, progress, fav, onClick }: { item: Item; active?: boolean; progress?: number; fav?: boolean; onClick: () => void }) {
  return (
    <button className={'ch-row vod-row ' + (active ? 'on' : '')} onClick={onClick} title={item.name}>
      <Img className="vod-thumb" src={item.logo} alt={item.name} />
      <div className="ch-text">
        <div className="ellip strong">{item.name}</div>
        <div className="small muted row gap center-y">
          {item.year && <span>{item.year}</span>}
          {!!item.rating && item.rating > 0 && (
            <span className="row center-y" style={{ gap: 3 }}>
              <Icon n="star" s={12} fill className="accent" /> {item.rating.toFixed(1)}
            </span>
          )}
        </div>
        {progress != null && progress > 0 && (
          <div className="bar thin">
            <i style={{ width: Math.min(100, progress * 100) + '%' }} />
          </div>
        )}
      </div>
      {fav && (
        <span className="ch-flags">
          <Icon n="heart" s={16} fill className="accent" />
        </span>
      )}
    </button>
  )
}

// Small player inside the dashboard (movies / series). Full Screen continues from the same second.
export function InlinePlayer({ req }: { req: PlayRequest }) {
  const app = useApp()
  const v = useRef<HTMLVideoElement>(null)
  const live = req.kind === 'live'
  const { error, engine, noAudio: noSnd, noVideo } = useEngine(v, app.player ? '' : req.url, live) // pause while the full player is open
  const noAudio = noSnd || noVideo
  const seeked = useRef(false)
  useEffect(() => {
    seeked.current = false
  }, [req.url])
  const save = () => {
    const el = v.current
    if (!el || !req.historyKey || !req.history || live || el.currentTime < 3) return
    app.saveHistory({ key: req.historyKey, ...req.history, pos: el.currentTime, dur: el.duration || 0 })
  }
  useEffect(() => {
    const i = setInterval(save, 8000)
    return () => (clearInterval(i), save())
  }, [req.url])
  const full = () => (save(), app.play({ ...req, startAt: live ? 0 : v.current?.currentTime || req.startAt || 0 }))
  const pro = async () => {
    const el = v.current
    el?.pause()
    const r = await playPro({ url: req.url, title: req.title + (req.subtitle ? ' — ' + req.subtitle : ''), start: el?.currentTime || req.startAt || 0, live })
    if (r && el && r.pos > 0) el.currentTime = r.pos
  }
  // Dolby / DTS sound (most series & many movies) → Pro player automatically
  const autoDone = useRef('')
  useEffect(() => {
    if ((!noAudio && !error) || autoDone.current === req.url || app.player) return
    autoDone.current = req.url
    autoProOk().then((ok) => ok && (app.toast('This sound is Dolby/DTS — playing in the Pro player'), pro()))
  }, [noAudio, error])
  return (
    <div className="preview-video inline-player" onDoubleClick={full}>
      <video
        ref={v}
        playsInline
        autoPlay
        controls
        onLoadedMetadata={(e) => {
          if (!seeked.current && req.startAt) e.currentTarget.currentTime = req.startAt
          seeked.current = true
        }}
      />
      {!engine && !error && (
        <div className="p-center">
          <Spinner />
        </div>
      )}
      {error && <div className="p-center small muted pad">{error}</div>}
      {(noAudio || error) && (
        <button className="noaudio-chip" onClick={pro}>
          <Icon n="mute" s={15} /> {error ? 'Play with' : noVideo ? 'No picture?' : 'No sound?'} Pro player
        </button>
      )}
      <button className="expand" onClick={full} aria-label="Full Screen">
        <Icon n="full" s={18} />
      </button>
    </div>
  )
}

function Backdrop({ src }: { src?: string }) {
  return (
    <div className="detail-bg">
      <Img src={src} alt="" className="cover" fallback={<span />} />
      <div className="detail-shade" />
    </div>
  )
}

function FavBtn({ kind, id, item }: { kind: Kind; id: string; item?: Item }) {
  const app = useApp()
  const f = app.isFav(kind, id)
  return (
    <button className="btn glass-btn xl" onClick={() => app.toggleFav(kind, id, item)}>
      <Icon n={f ? 'check' : 'plus'} s={18} /> {f ? 'In My List' : 'My List'}
    </button>
  )
}

export function MovieDetail({ id, given, pane }: { id: string; given?: Item; pane?: boolean }) {
  const app = useApp()
  const [inline, setInline] = useState<PlayRequest | null>(null)
  const autoStarted = useRef(false)
  const known = app.findItem('movie', id) || given
  const [info, setInfo] = useState<any>(null)
  const [md, setMd] = useState<any>(null)
  useEffect(() => {
    if (app.active?.type === 'xtream')
      xtVodInfo(app.active, id)
        .then((r) => (setInfo(r.info), setMd(r.movie)))
        .catch(() => setInfo({}))
  }, [id])
  // Opened from history / favorites before its category was loaded → build from server info
  const item: Item | undefined =
    known ||
    (md?.stream_id
      ? { id, kind: 'movie', name: md.name || info?.name || '', logo: info?.movie_image || md.stream_icon, categoryId: String(md.category_id ?? ''), ext: md.container_extension || 'mp4', rating: parseFloat(info?.rating) || 0 }
      : undefined)
  if (!item) return info ? <Empty title="Movie not found" /> : <div className="center-fill"><Spinner size={40} /></div>
  const h = app.history['mv:' + id]
  const resumeAt = h?.dur && h.pos && h.pos / h.dur < 0.95 ? h.pos : 0
  const makeReq = (from = 0): PlayRequest => ({
      kind: 'movie',
      title: item.name,
      subtitle: [info?.releasedate?.slice(0, 4) || item.year, info?.genre].filter(Boolean).join(' · '),
      url: streamFor(app.active!, item),
      image: item.logo,
      historyKey: 'mv:' + id,
      history: { kind: 'movie', id, name: item.name, image: item.logo },
      startAt: from,
    })
  const play = (from = 0) => (pane && !mustPro('movie', makeReq(from).url) ? setInline(makeReq(from)) : app.play(makeReq(from)))
  // In the dashboard the movie starts playing as soon as it is picked
  if (pane && !autoStarted.current && app.active && !mustPro('movie', makeReq(0).url)) {
    autoStarted.current = true
    const first = makeReq(resumeAt || 0)
    setTimeout(() => setInline((x) => x || first))
  }
  const back = Array.isArray(info?.backdrop_path) ? info.backdrop_path[0] : info?.backdrop_path
  const trailer = info?.youtube_trailer
  return (
    <div className={'detail' + (pane ? ' pane' : '')}>
      {!pane && <Backdrop src={back || item.logo} />}
      <div className="detail-body">
        {pane ? (
          inline && <InlinePlayer req={inline} />
        ) : (
          <button className="icon-btn glass-btn" onClick={app.nav.back} aria-label="Back">
            <Icon n="back" />
          </button>
        )}
        <div className="detail-main">
          {!pane && <Img className="detail-poster" src={info?.movie_image || item.logo} alt={item.name} />}
          <div className="detail-text">
            <h1 className="hero-title">{info?.name || item.name}</h1>
            <div className="meta-line">
              {(info?.releasedate || item.year) && <span>{String(info?.releasedate || item.year).slice(0, 4)}</span>}
              {info?.duration && <span>{info.duration}</span>}
              {info?.genre && <span>{info.genre}</span>}
              {!!item.rating && (
                <span className="rating-inline">
                  <Icon n="star" s={13} fill /> {item.rating.toFixed(1)}
                </span>
              )}
              {info?.video?.height && <span className="badge">{info.video.height >= 2000 ? '4K' : info.video.height >= 1000 ? 'HD' : 'SD'}</span>}
            </div>
            <div className="row gap wrap">
              {pane ? (
                <button className="btn primary xl" onClick={() => app.play(makeReq(app.history['mv:' + id]?.pos || 0))} data-autofocus>
                  <Icon n="full" s={18} /> Full Screen
                </button>
              ) : (
                <button className="btn primary xl" onClick={() => play(resumeAt || 0)} data-autofocus>
                  <Icon n="play" fill s={18} /> {resumeAt ? 'Resume' : 'Play'}
                </button>
              )}
              {resumeAt > 0 && (
                <button className="btn glass-btn xl" onClick={() => play(0)}>
                  <Icon n="refresh" s={18} /> From Start
                </button>
              )}
              <FavBtn kind="movie" id={id} item={item} />
              {trailer && (
                <a className="btn glass-btn xl" href={`https://www.youtube.com/watch?v=${trailer}`} target="_blank" rel="noreferrer">
                  <Icon n="movie" s={18} /> Trailer
                </a>
              )}
            </div>
            {info == null && app.active?.type === 'xtream' && <Spinner size={22} />}
            {(info?.plot || info?.description) && <p className="plot">{info.plot || info.description}</p>}
            <dl className="credits">
              {info?.director && (
                <>
                  <dt>Director</dt>
                  <dd>{info.director}</dd>
                </>
              )}
              {(info?.cast || info?.actors) && (
                <>
                  <dt>Cast</dt>
                  <dd>{info.cast || info.actors}</dd>
                </>
              )}
              {info?.country && (
                <>
                  <dt>Country</dt>
                  <dd>{info.country}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SeriesDetail({ id, resume, given, pane }: { id: string; resume?: string; given?: Item; pane?: boolean }) {
  const app = useApp()
  const [inline, setInline] = useState<PlayRequest | null>(null)
  const known = app.findItem('series', id) || given
  const [info, setInfo] = useState<any>(null)
  const [eps, setEps] = useState<Episode[] | null>(known?.episodes || null)
  const [season, setSeason] = useState<number>(0)
  const [err, setErr] = useState('')
  const item: Item | undefined = known || (info?.name ? { id, kind: 'series', name: info.name, logo: info.cover, categoryId: '', rating: parseFloat(info.rating) || 0, plot: info.plot } : undefined)
  useEffect(() => {
    if (app.active?.type === 'xtream')
      xtSeriesInfo(app.active, id)
        .then((r) => {
          setInfo(r.info)
          setEps(r.episodes)
        })
        .catch((e) => setErr(e.message))
  }, [id])
  const seasons = useMemo(() => [...new Set((eps || []).map((e) => e.season))], [eps])
  useEffect(() => {
    if (!eps?.length) return
    const r = resume && eps.find((e) => e.id === resume)
    setSeason(r ? r.season : seasons[0])
  }, [eps])
  if (!item) return err ? <Empty title="Series not found" text={err} /> : <div className="center-fill"><Spinner size={40} /></div>

  const list = eps || []
  const inSeason = list.filter((e) => e.season === season)
  const play = (e: Episode, full = false) => {
    const idx = list.indexOf(e)
    const h = app.history['ep:' + e.id]
    const url = episodeStream(app.active!, e)
    ;(pane && !full && !mustPro('episode', url) ? setInline : app.play)({
      kind: 'episode',
      title: item.name,
      subtitle: `S${e.season} · E${e.episode} — ${e.title}`,
      url,
      image: e.image || item.logo,
      historyKey: 'ep:' + e.id,
      history: { kind: 'episode', id: e.id, name: e.title, image: e.image || item.logo, seriesId: id, seriesName: item.name, season: e.season, episode: e.episode },
      startAt: h?.dur && h.pos && h.pos / h.dur < 0.95 ? h.pos : 0,
      episodes: { list, index: idx, seriesId: id, seriesName: item.name, image: item.logo },
    })
  }
  // Next up = latest watched episode (if unfinished) or the one after it
  const nextUp = useMemo(() => {
    const watched = list.map((e) => ({ e, h: app.history['ep:' + e.id] })).filter((x) => x.h)
    if (!watched.length) return list[0]
    const last = watched.sort((a, b) => b.h.at - a.h.at)[0]
    if (last.h.dur && (last.h.pos || 0) / last.h.dur < 0.95) return last.e
    return list[list.indexOf(last.e) + 1] || last.e
  }, [list, app.history])

  // In the dashboard the next episode starts playing as soon as the series is picked
  useEffect(() => {
    if (pane && !inline && nextUp && !mustPro('episode', '')) play(nextUp)
  }, [nextUp?.id])
  const back = Array.isArray(info?.backdrop_path) ? info.backdrop_path[0] : info?.backdrop_path
  const playingEp = inline?.historyKey?.slice(3)
  return (
    <div className={'detail' + (pane ? ' pane' : '')}>
      {!pane && <Backdrop src={back || item.logo} />}
      <div className="detail-body">
        {pane ? (
          inline ? <InlinePlayer req={inline} /> : eps == null && !err ? <div className="preview-video"><div className="p-center"><Spinner /></div></div> : null
        ) : (
          <button className="icon-btn glass-btn" onClick={app.nav.back} aria-label="Back">
            <Icon n="back" />
          </button>
        )}
        <div className="detail-main">
          {!pane && <Img className="detail-poster" src={info?.cover || item.logo} alt={item.name} />}
          <div className="detail-text">
            <h1 className="hero-title">{info?.name || item.name}</h1>
            <div className="meta-line">
              {(info?.releaseDate || item.year) && <span>{String(info?.releaseDate || item.year).slice(0, 4)}</span>}
              {seasons.length > 0 && <span>{seasons.length} Season{seasons.length > 1 ? 's' : ''}</span>}
              {info?.genre && <span>{info.genre}</span>}
              {!!item.rating && (
                <span className="rating-inline">
                  <Icon n="star" s={13} fill /> {item.rating.toFixed(1)}
                </span>
              )}
            </div>
            <div className="row gap wrap">
              {pane && inline && (
                <button className="btn primary xl" onClick={() => app.play({ ...inline, startAt: app.history[inline.historyKey!]?.pos || inline.startAt })} data-autofocus>
                  <Icon n="full" s={18} /> Full Screen
                </button>
              )}
              {nextUp && !pane && (
                <button className="btn primary xl" onClick={() => play(nextUp)} data-autofocus>
                  <Icon n="play" fill s={18} /> {app.history['ep:' + nextUp.id] ? 'Continue' : 'Play'} S{nextUp.season} E{nextUp.episode}
                </button>
              )}
              <FavBtn kind="series" id={id} item={item} />
            </div>
            {(info?.plot || item.plot) && <p className="plot">{info?.plot || item.plot}</p>}
            {info?.cast && (
              <dl className="credits">
                <dt>Cast</dt>
                <dd>{info.cast}</dd>
              </dl>
            )}
          </div>
        </div>

        {eps == null && !err && <Spinner />}
        {err && <div className="alert">{err}</div>}
        {seasons.length > 0 && (
          <>
            <Chips value={String(season)} onChange={(s) => setSeason(Number(s))} items={seasons.map((s) => ({ id: String(s), label: `Season ${s}` }))} />
            <div className="episodes">
              {inSeason.map((e) => {
                const h = app.history['ep:' + e.id]
                const p = h?.dur ? (h.pos || 0) / h.dur : 0
                return (
                  <button key={e.id} className={'episode' + (playingEp === e.id ? ' on' : '')} onClick={() => play(e)}>
                    <div className="ep-img">
                      <Img src={e.image || item.logo} alt={e.title} className="cover" />
                      <span className="play-badge">
                        <Icon n="play" fill s={14} />
                      </span>
                      {p > 0 && (
                        <div className="pbar">
                          <i style={{ width: p * 100 + '%' }} />
                        </div>
                      )}
                    </div>
                    <div className="ep-text">
                      <div className="small muted">
                        Episode {e.episode}
                        {e.duration ? ` · ${e.duration}` : ''}
                        {p >= 0.95 ? ' · Watched' : ''}
                      </div>
                      <div className="strong clamp2">{e.title}</div>
                      {e.plot && <div className="small muted clamp2">{e.plot}</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
        {eps && !eps.length && <Empty icon="series" title="No episodes yet" />}
      </div>
    </div>
  )
}
