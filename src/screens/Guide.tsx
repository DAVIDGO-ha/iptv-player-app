import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { Empty, Icon, Img, Modal, Spinner, fmtTime, useProgressive } from '../ui'
import { playLive, useGuardedCategory } from './common'
import { loadEpg, programmesFor, type EpgData } from '../lib/epg'
import type { Item, Programme } from '../lib/types'
import { CatchUp } from './Live'

const PX_PER_MIN = 6
const HOURS = 8

export function Guide() {
  const app = useApp()
  const { cats, items } = app.visible('live')
  const g = useGuardedCategory(localStorage.getItem('ip.guideCat') || cats[0]?.id || 'all')
  const [epg, setEpg] = useState<EpgData | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<{ ch: Item; p: Programme } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const url = app.settings.epgUrl || app.active?.epgUrl || app.catalog?.epgUrl
  const off = app.settings.epgOffset * 36e5
  useEffect(() => localStorage.setItem('ip.guideCat', g.cat), [g.cat])

  const load = (force = false) => {
    if (!url || !app.active) return
    setBusy(true)
    setErr('')
    loadEpg(app.active.id, url, force)
      .then(setEpg)
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false))
  }
  useEffect(() => load(), [url])

  const t0 = useMemo(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0)
    return d.getTime() - 60 * 60000
  }, [])
  const t1 = t0 + HOURS * 36e5
  const x = (t: number) => ((t + off - t0) / 60000) * PX_PER_MIN

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, x(Date.now() - off) - 160)
  }, [epg])

  const list = useMemo(() => (g.cat === 'all' ? items : items.filter((i) => i.categoryId === g.cat)), [items, g.cat])
  const { shown, sentinel } = useProgressive(list, 40)

  if (!url)
    return (
      <Empty
        icon="guide"
        title="No TV Guide source"
        text="Your playlist doesn’t provide an EPG. Add an XMLTV URL in Settings › TV Guide."
        action={
          <button className="btn primary" onClick={() => app.nav.push('settings')}>
            Open Settings
          </button>
        }
      />
    )

  const slots = Array.from({ length: HOURS * 2 }, (_, i) => t0 + i * 30 * 60000)

  return (
    <div className="page guide-page">
      <header className="page-head">
        <h1 className="large-title">TV Guide</h1>
        <div className="row gap center-y">
          <select className="select" value={g.cat} onChange={(e) => g.pick(e.target.value, app.isLocked(cats.find((c) => c.id === e.target.value)))}>
            <option value="all">All Channels</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {app.isLocked(c) ? '🔒 ' : ''}
                {c.name}
              </option>
            ))}
          </select>
          <button className="icon-btn" onClick={() => load(true)} aria-label="Reload guide">
            <Icon n="refresh" />
          </button>
        </div>
      </header>
      {busy && (
        <div className="center-fill">
          <Spinner size={40} />
          <div className="muted">Loading TV Guide… large guides can take a minute.</div>
        </div>
      )}
      {err && <div className="alert">{err}</div>}
      {epg && !busy && (
        <div className="guide" ref={scroller}>
          <div className="guide-inner" style={{ width: 220 + HOURS * 60 * PX_PER_MIN }}>
            <div className="guide-times">
              <div className="guide-corner" />
              {slots.map((s) => (
                <div key={s} className="slot" style={{ width: 30 * PX_PER_MIN }}>
                  {fmtTime(s - off)}
                </div>
              ))}
            </div>
            <div className="now-line" style={{ left: 220 + x(Date.now() - off) }} />
            {shown.map((ch) => {
              const progs = programmesFor(epg, ch.epgId, ch.name).filter((p) => p.stop + off > t0 && p.start + off < t1)
              return (
                <div key={ch.id} className="guide-row">
                  <button className="guide-ch" onClick={() => playLive(app, ch, list)}>
                    <Img className="ch-logo sm" src={ch.logo} alt={ch.name} />
                    <span className="ellip small">{ch.name}</span>
                  </button>
                  <div className="guide-track">
                    {progs.map((p, i) => {
                      const l = Math.max(0, x(p.start))
                      const w = Math.min(x(p.stop), HOURS * 60 * PX_PER_MIN) - l
                      const isNow = p.start <= Date.now() - off && p.stop > Date.now() - off
                      return (
                        <button
                          key={i}
                          className={'prog ' + (isNow ? 'now' : p.stop < Date.now() - off ? 'past' : '')}
                          style={{ left: l, width: Math.max(4, w - 3) }}
                          onClick={() => setInfo({ ch, p })}
                        >
                          <span className="ellip strong">{p.title}</span>
                          <span className="ellip tiny muted">
                            {fmtTime(p.start)} – {fmtTime(p.stop)}
                          </span>
                        </button>
                      )
                    })}
                    {!progs.length && <div className="prog empty-prog">No information</div>}
                  </div>
                </div>
              )
            })}
            {sentinel}
          </div>
        </div>
      )}
      {info && <ProgInfo {...info} list={list} onClose={() => setInfo(null)} />}
      {g.pin}
    </div>
  )
}

function ProgInfo({ ch, p, list, onClose }: { ch: Item; p: Programme; list: Item[]; onClose: () => void }) {
  const app = useApp()
  const [catchup, setCatchup] = useState(false)
  const t = Date.now() - app.settings.epgOffset * 36e5
  const isNow = p.start <= t && p.stop > t
  const future = p.start > t
  if (catchup) return <CatchUp ch={ch} onClose={onClose} />
  return (
    <Modal title={ch.name} onClose={onClose}>
      <div className="eyebrow">
        {new Date(p.start).toLocaleDateString([], { weekday: 'long' })} · {fmtTime(p.start)} – {fmtTime(p.stop)}
      </div>
      <h2>{p.title}</h2>
      {p.desc && <p className="muted">{p.desc}</p>}
      <div className="row gap wrap">
        {isNow && (
          <button className="btn primary" onClick={() => (onClose(), playLive(app, ch, list))} data-autofocus>
            <Icon n="play" fill s={16} /> Watch Live
          </button>
        )}
        {future && (
          <button
            className="btn primary"
            onClick={() => (app.addReminder({ channelId: ch.id, channelName: ch.name, title: p.title, start: p.start + app.settings.epgOffset * 36e5 }), onClose())}
          >
            <Icon n="bell" s={16} /> Remind Me
          </button>
        )}
        {!isNow && !future && ch.archive && app.active?.type === 'xtream' && (
          <button className="btn primary" onClick={() => setCatchup(true)}>
            <Icon n="catchup" s={16} /> Catch-Up
          </button>
        )}
        <button className="btn" onClick={() => (onClose(), playLive(app, ch, list))}>
          Open Channel
        </button>
      </div>
    </Modal>
  )
}
