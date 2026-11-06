import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { Empty, Icon, Img, Modal, Segmented, Spinner } from '../ui'
import { ChannelRow, Header, Poster, Rail, playLive } from './common'
import { useEngine } from '../player/useEngine'
import { streamFor } from '../lib/catalog'
import type { Item } from '../lib/types'

export function Search() {
  const app = useApp()
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim().toLowerCase()), 220)
    return () => clearTimeout(t)
  }, [q])
  const res = useMemo(() => {
    if (dq.length < 2) return null
    const f = (k: 'live' | 'movie' | 'series') => app.visible(k).items.filter((i) => i.name.toLowerCase().includes(dq)).slice(0, 40)
    return { live: f('live'), movie: f('movie'), series: f('series') }
  }, [dq, app.catalog])
  return (
    <div className="page">
      <Header title="Search" />
      <div className="search-box big">
        <Icon n="search" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Channels, movies and series" data-autofocus />
        {q && (
          <button className="icon-btn" onClick={() => setQ('')} aria-label="Clear">
            <Icon n="close" s={18} />
          </button>
        )}
      </div>
      {!res && (
        <Empty
          icon="search"
          title="Find anything"
          text={app.visible('movie').lazy ? 'Searches all channels, plus the movie & series categories you have opened.' : 'Type at least two letters to search your whole playlist.'}
        />
      )}
      {res && !res.live.length && !res.movie.length && !res.series.length && <Empty icon="search" title={`No results for “${q}”`} />}
      {res && res.live.length > 0 && (
        <section className="rail">
          <div className="rail-head">
            <h2>Channels</h2>
          </div>
          <div className="ch-grid">
            {res.live.map((c) => (
              <ChannelRow key={c.id} ch={c} onClick={() => playLive(app, c, res.live)} />
            ))}
          </div>
        </section>
      )}
      {res && res.movie.length > 0 && (
        <Rail title="Movies">
          {res.movie.map((m) => (
            <Poster key={m.id} item={m} onClick={() => app.nav.push('movie', { id: m.id, item: m })} />
          ))}
        </Rail>
      )}
      {res && res.series.length > 0 && (
        <Rail title="Series">
          {res.series.map((m) => (
            <Poster key={m.id} item={m} onClick={() => app.nav.push('series', { id: m.id, item: m })} />
          ))}
        </Rail>
      )}
    </div>
  )
}

export function Favorites() {
  const app = useApp()
  const [tab, setTab] = useState<'live' | 'movie' | 'series'>('live')
  const items = useMemo(() => {
    return app.favs[tab].map((id) => app.findItem(tab, id)!).filter(Boolean)
  }, [tab, app.favs, app.catalog, app.favItems])
  return (
    <div className="page">
      <Header title="Favorites" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { v: 'live', l: `Channels (${app.favs.live.length})` },
          { v: 'movie', l: `Movies (${app.favs.movie.length})` },
          { v: 'series', l: `Series (${app.favs.series.length})` },
        ]}
      />
      {!items.length && <Empty icon="heart" title="No favorites yet" text="Tap the heart or “My List” on anything you love." />}
      {tab === 'live' ? (
        <div className="ch-grid">
          {items.map((c) => (
            <ChannelRow key={c.id} ch={c} onClick={() => playLive(app, c, items)} />
          ))}
        </div>
      ) : (
        <div className="poster-grid">
          {items.map((i) => (
            <Poster key={i.id} item={i} onClick={() => app.nav.push(tab, { id: i.id, item: i })} />
          ))}
        </div>
      )}
    </div>
  )
}

export function More() {
  const app = useApp()
  const links = [
    ['guide', 'guide', 'TV Guide'],
    ['search', 'search', 'Search'],
    ['favorites', 'heart', 'Favorites'],
    ['multiview', 'grid', 'Multi-View'],
    ['history', 'history', 'Watch History'],
    ['playlists', 'list', 'Playlists'],
    ['account', 'user', 'Account Info'],
    ['settings', 'settings', 'Settings'],
  ]
  return (
    <div className="page narrow">
      <Header title="More" />
      <div className="list-card">
        {links.map(([r, ic, l]) => (
          <button key={r} className="set-row nav" onClick={() => app.nav.push(r)}>
            <span className="set-ic">
              <Icon n={ic} s={18} />
            </span>
            <span className="grow">{l}</span>
            <Icon n="chevron" s={18} className="muted" />
          </button>
        ))}
      </div>
    </div>
  )
}

export function History() {
  const app = useApp()
  const list = Object.values(app.history).sort((a, b) => b.at - a.at)
  const open = (h: (typeof list)[0]) => {
    if (h.kind === 'live') {
      const ch = app.catalog?.live.items.find((i) => i.id === h.id)
      if (ch) playLive(app, ch)
    } else if (h.kind === 'movie') app.nav.push('movie', { id: h.id })
    else app.nav.push('series', { id: h.seriesId, resume: h.id })
  }
  return (
    <div className="page narrow">
      <Header title="Watch History" back>
        {list.length > 0 && (
          <button className="btn" onClick={app.clearHistory}>
            <Icon n="trash" s={18} /> Clear
          </button>
        )}
      </Header>
      {!list.length && <Empty icon="history" title="Nothing watched yet" />}
      <div className="list-card">
        {list.map((h) => (
          <div key={h.key} className="pl-row">
            <button className="pl-main" onClick={() => open(h)}>
              <Img className="ch-logo" src={h.image} alt={h.name} />
              <span className="grow">
                <span className="strong block ellip">{h.seriesName ? `${h.seriesName} · S${h.season}E${h.episode}` : h.name}</span>
                <span className="small muted">
                  {h.kind === 'live' ? 'Live TV' : h.kind === 'movie' ? 'Movie' : 'Episode'} · {new Date(h.at).toLocaleString()}
                </span>
              </span>
            </button>
            <button className="icon-btn" onClick={() => app.removeHistory(h.key)} aria-label="Remove">
              <Icon n="close" s={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Account() {
  const app = useApp()
  const a = app.catalog?.account
  const u = a?.user_info
  const s = a?.server_info
  const d = (x: any) => (x ? new Date(Number(x) * 1000).toLocaleString() : 'Unlimited')
  return (
    <div className="page narrow">
      <Header title="Account Info" back />
      {!u ? (
        <Empty icon="user" title="No account details" text="Account information is available for Xtream Codes playlists." />
      ) : (
        <div className="list-card">
          {[
            ['Playlist', app.active?.name],
            ['Username', u.username],
            ['Status', u.status],
            ['Expiry date', d(u.exp_date)],
            ['Created', d(u.created_at)],
            ['Trial', u.is_trial === '1' ? 'Yes' : 'No'],
            ['Active connections', u.active_cons],
            ['Max connections', u.max_connections],
            ['Formats', (u.allowed_output_formats || []).join(', ')],
            ['Server', s?.url ? `${s.server_protocol || 'http'}://${s.url}:${s.port}` : app.active?.server],
            ['Server time zone', s?.timezone],
          ].map(([k, v]) => (
            <div className="set-row" key={k as string}>
              <span className="grow muted">{k}</span>
              <span className="strong">{String(v ?? '—')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ——— Multi-View: up to 4 live channels at once ———
export function MultiView() {
  const app = useApp()
  const [layout, setLayout] = useState<'2' | '4'>('4')
  const [slots, setSlots] = useState<(Item | null)[]>([null, null, null, null])
  const [audio, setAudio] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const n = Number(layout)
  return (
    <div className="page multiview-page">
      <Header title="Multi-View" sub="Watch several channels at once — tap a screen to hear it.">
        <Segmented value={layout} onChange={setLayout} options={[{ v: '2', l: '2 Screens' }, { v: '4', l: '4 Screens' }]} />
      </Header>
      <div className={'mv-grid mv-' + layout}>
        {slots.slice(0, n).map((ch, i) => (
          <div key={i} className={'mv-cell ' + (audio === i ? 'on' : '')}>
            {ch ? (
              <MvTile ch={ch} muted={audio !== i} onFocus={() => setAudio(i)} onChange={() => setPick(i)} onClose={() => setSlots((s) => s.map((x, j) => (j === i ? null : x)))} />
            ) : (
              <button className="mv-add" onClick={() => setPick(i)}>
                <Icon n="plus" s={30} />
                <span>Add Channel</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="tiny muted">Each screen uses one connection from your subscription.</p>
      {pick != null && (
        <ChannelPicker
          onClose={() => setPick(null)}
          onPick={(c) => {
            setSlots((s) => s.map((x, j) => (j === pick ? c : x)))
            setAudio(pick)
            setPick(null)
          }}
        />
      )}
    </div>
  )
}

function MvTile({ ch, muted, onFocus, onChange, onClose }: { ch: Item; muted: boolean; onFocus: () => void; onChange: () => void; onClose: () => void }) {
  const app = useApp()
  const v = useRef<HTMLVideoElement>(null)
  const { error, engine } = useEngine(v, app.player ? '' : streamFor(app.active!, ch), true)
  useEffect(() => {
    if (v.current) v.current.muted = muted
  }, [muted, engine])
  return (
    <div className="mv-tile" onClick={onFocus}>
      <video ref={v} playsInline autoPlay muted={muted} />
      {!engine && !error && (
        <div className="p-center">
          <Spinner />
        </div>
      )}
      {error && <div className="p-center small muted pad">{error}</div>}
      <div className="mv-bar">
        <Img className="ch-logo sm" src={ch.logo} alt={ch.name} />
        <span className="ellip small grow">{ch.name}</span>
        {!muted && <Icon n="audio" s={16} className="accent" />}
        <button className="icon-btn sm" onClick={(e) => (e.stopPropagation(), onChange())} aria-label="Change channel">
          <Icon n="refresh" s={16} />
        </button>
        <button className="icon-btn sm" onClick={(e) => (e.stopPropagation(), onClose())} aria-label="Remove">
          <Icon n="close" s={16} />
        </button>
      </div>
    </div>
  )
}

export function ChannelPicker({ onPick, onClose }: { onPick: (c: Item) => void; onClose: () => void }) {
  const app = useApp()
  const { items, cats } = app.visible('live')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const list = useMemo(() => {
    let l = cat === 'all' ? items : items.filter((i) => i.categoryId === cat)
    if (q) l = l.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    return l.slice(0, 200)
  }, [q, cat, items])
  return (
    <Modal title="Choose a channel" onClose={onClose} wide>
      <div className="toolbar">
        <div className="search-box">
          <Icon n="search" s={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" data-autofocus />
        </div>
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">All</option>
          {cats
            .filter((c) => !app.isLocked(c))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      <div className="picker-list">
        {list.map((c) => (
          <ChannelRow key={c.id} ch={c} onClick={() => onPick(c)} />
        ))}
      </div>
    </Modal>
  )
}
