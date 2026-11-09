import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { Empty, Icon, Img, Modal, Spinner, fmtTime, progressOf, useProgressive } from '../ui'
import { ChannelRow, SortSelect, playLive, sortItems, useGuardedCategory } from './common'
import { useEngine } from '../player/useEngine'
import { streamFor } from '../lib/catalog'
import { epgCached, nowNext, programmesFor } from '../lib/epg'
import { timeshiftUrl, xtArchive, xtShortEpg } from '../lib/xtream'
import { proxied } from '../lib/net'
import { playPro } from '../lib/pro'
import { RecButton } from './Rec'
import type { Item, Programme } from '../lib/types'

export const useWide = () => {
  const q = '(min-width: 1000px)'
  const tv = () => document.documentElement.classList.contains('tv') // every TV: same 3-column layout
  const [w, setW] = useState(() => tv() || matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const f = () => setW(tv() || m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return w
}

export const SPORT_RE = /sport|football|soccer|futbol|calcio|f1|formula|motogp|nba|nfl|nhl|mlb|ufc|boxing|wwe|golf|tennis|cricket|rugby|racing|bein|dazn|espn|eurosport|arena|tnt sport|premier league|champions|laliga|la liga|bundesliga|serie a|ligue 1|ppv|events?\b/i

export function Live({ sports = false }: { sports?: boolean }) {
  const app = useApp()
  const vis = app.visible('live')
  const { cats, items } = useMemo(() => {
    if (!sports) return vis
    const cs = vis.cats.filter((c) => SPORT_RE.test(c.name))
    const ids = new Set(cs.map((c) => c.id))
    return { ...vis, cats: cs, items: vis.items.filter((i) => ids.has(i.categoryId)) }
  }, [vis, sports])
  const catKey = sports ? 'ip.sportCat' : 'ip.liveCat'
  const g = useGuardedCategory(localStorage.getItem(catKey) || 'all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('num')
  const [sel, setSel] = useState<Item | null>(null)
  const wide = useWide()
  const preview = wide // TV too: first OK = preview on the right, second OK = full screen (Pro player on TVs)
  useEffect(() => localStorage.setItem(catKey, g.cat), [g.cat])
  const title = sports ? 'Sports' : 'Live TV'

  const list = useMemo(() => {
    let l: Item[]
    if (g.cat === 'all') l = items
    else if (g.cat === 'fav') l = app.favs.live.map((id) => items.find((i) => i.id === id)!).filter(Boolean)
    else if (g.cat === 'recent')
      l = Object.values(app.history)
        .filter((h) => h.kind === 'live')
        .sort((a, b) => b.at - a.at)
        .map((h) => items.find((i) => i.id === h.id)!)
        .filter(Boolean)
    else l = items.filter((i) => i.categoryId === g.cat)
    if (q) {
      const s = q.toLowerCase()
      l = l.filter((i) => i.name.toLowerCase().includes(s) || String(i.num) === s)
    }
    return g.cat === 'fav' || g.cat === 'recent' ? l : sortItems(l, sort)
  }, [items, g.cat, q, sort, app.favs.live])
  const { shown, sentinel } = useProgressive(list, 80)
  // Big screens: the right side plays straight away (last channel watched in this list, else the first one)
  useEffect(() => {
    if (!preview || !list.length || (sel && list.some((i) => i.id === sel.id))) return
    const last = Object.values(app.history)
      .filter((h) => h.kind === 'live')
      .sort((a, b) => b.at - a.at)
      .map((h) => list.find((i) => i.id === h.id))
      .find(Boolean)
    setSel(last || list[0])
  }, [preview, list])

  const catList = [
    { id: 'all', name: sports ? 'All Sports' : 'All Channels', count: items.length, locked: false },
    { id: 'fav', name: 'Favorites', count: app.favs.live.length, locked: false },
    { id: 'recent', name: 'Recently Watched', count: undefined as any, locked: false },
    ...cats.map((c) => ({ id: c.id, name: c.name, count: c.count, locked: app.isLocked(c) })),
  ]

  const open = (ch: Item) => {
    if (preview && sel?.id !== ch.id) setSel(ch)
    else playLive(app, ch, list)
  }

  if (!items.length && !cats.length)
    return sports ? (
      <Empty icon="live" title="No sports categories found" text="Your playlist has no categories with sports names (Sports, Football, F1, beIN, DAZN…)." />
    ) : (
      <Empty icon="live" title="No live channels" text="This playlist doesn’t include live TV." />
    )

  return (
    <div className={'live ' + (wide ? 'wide' : '')}>
      {wide ? (
        <aside className="live-cats">
          <h1 className="large-title pad">{title}</h1>
          <div className="cat-scroll">
            {catList.map((c) => (
              <button key={c.id} className={'cat-row ' + (g.cat === c.id ? 'on' : '')} onClick={() => g.pick(c.id, c.locked)}>
                {c.id === 'fav' && <Icon n="heart" s={16} />}
                {c.id === 'recent' && <Icon n="history" s={16} />}
                {c.locked && <Icon n="lock" s={15} />}
                <span className="ellip">{c.name}</span>
                {c.count != null && <span className="cnt">{c.count}</span>}
              </button>
            ))}
          </div>
        </aside>
      ) : (
        <div className="page-head compact">
          <h1 className="large-title">{title}</h1>
        </div>
      )}
      <section className="live-list">
        {!wide && (
          <div className="chips hscroll">
            {catList.map((c) => (
              <button key={c.id} className={'chip ' + (g.cat === c.id ? 'on' : '')} onClick={() => g.pick(c.id, c.locked)}>
                {c.locked && <Icon n="lock" s={13} />}
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="toolbar">
          <div className="search-box">
            <Icon n="search" s={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channels or number" />
          </div>
          <SortSelect live value={sort} onChange={setSort} />
        </div>
        <div className="ch-scroll">
          {shown.map((ch) => (
            <div key={ch.id} onContextMenu={(e) => (e.preventDefault(), app.toggleFav('live', ch.id))}>
              <ChannelRow ch={ch} active={sel?.id === ch.id} onClick={() => open(ch)} />
            </div>
          ))}
          {sentinel}
          {!list.length && <Empty icon="search" title={g.cat === 'fav' ? 'No favorite channels yet' : 'No channels'} text={g.cat === 'fav' ? 'Right-click or long-press a channel to add it.' : undefined} />}
        </div>
      </section>
      {preview && (
        <section className="live-preview">
          {sel ? <Preview key={sel.id} ch={sel} list={list} /> : <Empty icon="tv" title="Select a channel" text="Choose once to preview, again to watch full screen." />}
        </section>
      )}
      {g.pin}
    </div>
  )
}

function Preview({ ch, list }: { ch: Item; list: Item[] }) {
  const app = useApp()
  const v = useRef<HTMLVideoElement>(null)
  const url = app.active && !app.player ? streamFor(app.active, ch) : '' // pause preview while full player is open
  const { error, engine, noAudio: noSnd, noVideo } = useEngine(v, url, true)
  const noAudio = noSnd || noVideo
  const [epg, setEpg] = useState<Programme[]>(() => programmesFor(epgCached(app.active!.id), ch.epgId, ch.name))
  const [catchup, setCatchup] = useState(false)
  useEffect(() => {
    if (epg.length || app.active?.type !== 'xtream') return
    xtShortEpg(app.active, ch.id, 10).then(setEpg).catch(() => {})
  }, [])
  const { now } = nowNext(epg, app.settings.epgOffset)
  const fav = app.isFav('live', ch.id)
  const upcoming = epg.filter((p) => p.stop > Date.now() - app.settings.epgOffset * 36e5).slice(0, 8)

  return (
    <div className="preview">
      <div className="preview-video" onClick={() => playLive(app, ch, list)}>
        <video ref={v} playsInline autoPlay muted={false} />
        {!engine && !error && (
          <div className="p-center">
            <Spinner />
          </div>
        )}
        {error && <div className="p-center small muted pad">{error}</div>}
        {(noAudio || error) && (
          <button className="noaudio-chip" onClick={(e) => (e.stopPropagation(), playPro({ url, title: ch.name, live: true }))}>
            <Icon n="mute" s={15} /> {error ? 'Play with' : noVideo ? 'No picture?' : 'No sound?'} Pro player
          </button>
        )}
        <span className="expand">
          <Icon n="full" s={18} />
        </span>
      </div>
      <div className="preview-info">
        <div className="row gap center-y">
          <Img className="ch-logo lg" src={ch.logo} alt={ch.name} />
          <div className="grow">
            <h2 className="ellip">{ch.name}</h2>
            {now && <div className="muted small ellip">{now.title}</div>}
          </div>
        </div>
        {now && (
          <div className="row gap center-y small">
            {fmtTime(now.start)}
            <div className="bar grow">
              <i style={{ width: progressOf(now.start, now.stop) * 100 + '%' }} />
            </div>
            {fmtTime(now.stop)}
          </div>
        )}
        <div className="row gap wrap">
          <button className="btn primary" onClick={() => playLive(app, ch, list)}>
            <Icon n="full" s={18} /> Full Screen
          </button>
          <button className="btn" onClick={() => app.toggleFav('live', ch.id)}>
            <Icon n="heart" s={18} fill={fav} /> {fav ? 'Favorited' : 'Favorite'}
          </button>
          {app.active && <RecButton url={streamFor(app.active, ch)} title={ch.name} />}
          {ch.archive && app.active?.type === 'xtream' && (
            <button className="btn" onClick={() => setCatchup(true)}>
              <Icon n="catchup" s={18} /> Catch-Up
            </button>
          )}
        </div>
        <div className="epg-list">
          {upcoming.map((p, i) => (
            <div key={i} className={'epg-row ' + (p === now ? 'on' : '')}>
              <div className="small muted">
                {fmtTime(p.start)} – {fmtTime(p.stop)}
              </div>
              <div className="strong">{p.title}</div>
              {p === now && p.desc && <div className="small muted clamp2">{p.desc}</div>}
            </div>
          ))}
          {!upcoming.length && <div className="muted small">No programme information.</div>}
        </div>
      </div>
      {catchup && <CatchUp ch={ch} onClose={() => setCatchup(false)} />}
    </div>
  )
}

export function CatchUp({ ch, onClose }: { ch: Item; onClose: () => void }) {
  const app = useApp()
  const [list, setList] = useState<any[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    xtArchive(app.active!, ch.id)
      .then((l) => setList(l.reverse()))
      .catch((e) => setErr(e.message))
  }, [])
  const days = useMemo(() => {
    const m = new Map<string, any[]>()
    ;(list || []).forEach((p) => {
      const d = new Date(p.start).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(p)
    })
    return [...m.entries()]
  }, [list])
  const play = (p: any) => {
    const mins = (p.stop - p.start) / 60000
    app.play({
      kind: 'catchup',
      title: ch.name,
      subtitle: `${p.title} · ${fmtTime(p.start)}`,
      url: proxied(timeshiftUrl(app.active!, ch.id, p.startLocal, mins), true),
      image: ch.logo,
    })
    onClose()
  }
  return (
    <Modal title={`Catch-Up · ${ch.name}`} onClose={onClose} wide>
      {!list && !err && <Spinner />}
      {err && <div className="alert">{err}</div>}
      {list && !list.length && <div className="muted">No recordings available for this channel.</div>}
      {days.map(([d, ps]) => (
        <div key={d}>
          <div className="eyebrow pad-y">{d}</div>
          {ps.map((p: any, i: number) => (
            <button key={i} className="epg-row btnlike" onClick={() => play(p)}>
              <span className="small muted">
                {fmtTime(p.start)} – {fmtTime(p.stop)}
              </span>
              <span className="strong">{p.title}</span>
            </button>
          ))}
        </div>
      ))}
    </Modal>
  )
}
