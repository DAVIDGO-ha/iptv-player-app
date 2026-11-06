import React, { useState } from 'react'
import { useApp, type Store } from '../store'
import { Icon, Img, PinPad, fmtTime, progressOf } from '../ui'
import { streamFor } from '../lib/catalog'
import { nowNext, programmesFor, epgCached } from '../lib/epg'
import type { Item } from '../lib/types'

export function playLive(app: Store, ch: Item, list?: Item[]) {
  if (!app.active) return
  const channels = list && list.length ? list : [ch]
  app.play({
    kind: 'live',
    title: ch.name,
    subtitle: app.settings.showNumbers ? `CH ${ch.num}` : undefined,
    url: streamFor(app.active, ch),
    image: ch.logo,
    historyKey: 'live:' + ch.id,
    history: { kind: 'live', id: ch.id, name: ch.name, image: ch.logo },
    channels,
    index: Math.max(0, channels.findIndex((c) => c.id === ch.id)),
  })
}

export function Header({ title, sub, children, back }: { title: string; sub?: string; children?: React.ReactNode; back?: boolean }) {
  const app = useApp()
  return (
    <header className="page-head">
      <div className="row gap center-y">
        {back && (
          <button className="icon-btn" onClick={app.nav.back} aria-label="Back">
            <Icon n="back" />
          </button>
        )}
        <div>
          <h1 className="large-title">{title}</h1>
          {sub && <div className="muted small">{sub}</div>}
        </div>
      </div>
      <div className="row gap center-y">{children}</div>
    </header>
  )
}

export function Poster({ item, onClick, progress }: { item: { name: string; logo?: string; rating?: number; year?: string }; onClick: () => void; progress?: number }) {
  return (
    <button className="poster" onClick={onClick} title={item.name}>
      <div className="poster-img">
        <Img src={item.logo} alt={item.name} className="cover" />
        {!!item.rating && item.rating > 0 && (
          <span className="rating">
            <Icon n="star" s={11} fill /> {item.rating.toFixed(1)}
          </span>
        )}
        {progress != null && progress > 0 && (
          <div className="pbar">
            <i style={{ width: Math.min(100, progress * 100) + '%' }} />
          </div>
        )}
      </div>
      <div className="poster-name ellip">{item.name}</div>
      {item.year && <div className="poster-meta">{item.year}</div>}
    </button>
  )
}

export function ChannelRow({ ch, onClick, active, onFocus }: { ch: Item; onClick: () => void; active?: boolean; onFocus?: () => void }) {
  const app = useApp()
  const epg = epgCached(app.active?.id || '')
  const { now } = nowNext(programmesFor(epg, ch.epgId, ch.name), app.settings.epgOffset)
  const fav = app.isFav('live', ch.id)
  return (
    <button className={'ch-row ' + (active ? 'on' : '')} onClick={onClick} onFocus={onFocus}>
      {app.settings.showNumbers && <span className="num">{ch.num}</span>}
      <Img className="ch-logo" src={ch.logo} alt={ch.name} />
      <div className="ch-text">
        <div className="ellip strong">{ch.name}</div>
        {now ? (
          <>
            <div className="ellip small muted">
              {fmtTime(now.start)} {now.title}
            </div>
            <div className="bar thin">
              <i style={{ width: progressOf(now.start, now.stop) * 100 + '%' }} />
            </div>
          </>
        ) : null}
      </div>
      <span className="ch-flags">
        {ch.archive && <Icon n="catchup" s={16} className="muted" />}
        {fav && <Icon n="heart" s={16} fill className="accent" />}
      </span>
    </button>
  )
}

export function Rail({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rail">
      <div className="rail-head">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="rail-items hscroll">{children}</div>
    </section>
  )
}

// Category selection guarded by parental PIN
export function useGuardedCategory(initial: string) {
  const app = useApp()
  const [cat, setCat] = useState(initial)
  const [ask, setAsk] = useState<string | null>(null)
  const pick = (id: string, locked: boolean) => (locked ? setAsk(id) : setCat(id))
  const pin = ask ? (
    <PinPad
      title="This category is locked"
      onClose={() => setAsk(null)}
      onDone={(p) => {
        if (p !== app.settings.pin) return false
        app.setUnlocked(true)
        setCat(ask)
        setAsk(null)
      }}
    />
  ) : null
  return { cat, setCat, pick, pin }
}

export function sortItems(items: Item[], sort: string) {
  const l = [...items]
  if (sort === 'az') l.sort((a, b) => a.name.localeCompare(b.name))
  if (sort === 'za') l.sort((a, b) => b.name.localeCompare(a.name))
  if (sort === 'new') l.sort((a, b) => (b.added || 0) - (a.added || 0))
  if (sort === 'rating') l.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  if (sort === 'num') l.sort((a, b) => (a.num || 0) - (b.num || 0))
  return l
}

export function SortSelect({ value, onChange, live }: { value: string; onChange: (v: string) => void; live?: boolean }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Sort">
      {live ? <option value="num">Number</option> : <option value="def">Default</option>}
      {!live && <option value="new">Recently Added</option>}
      {!live && <option value="rating">Top Rated</option>}
      <option value="az">A – Z</option>
      <option value="za">Z – A</option>
    </select>
  )
}
