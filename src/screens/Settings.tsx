import React, { useState } from 'react'
import { useApp } from '../store'
import { Icon, Modal, PinPad, Segmented, Toggle } from '../ui'
import { Header } from './common'
import { deviceId, DEFAULTS } from '../lib/settings'
import { deviceKey, resetDeviceKey } from '../lib/cloud'
import { SITE_LABEL } from '../config'
import { idbDel } from '../lib/idb'
import { loadEpg } from '../lib/epg'
import type { Kind } from '../lib/types'
import { canPro } from '../lib/pro'

const ACCENTS = ['#FF2D3A', '#0A84FF', '#5E5CE6', '#BF5AF2', '#FF375F', '#FF9F0A', '#30D158', '#FFFFFF']
export const VERSION = '1.0.0'

function Row({ icon, label, sub, children, onClick }: { icon?: string; label: string; sub?: string; children?: React.ReactNode; onClick?: () => void }) {
  const Tag: any = onClick ? 'button' : 'div'
  return (
    <Tag className={'set-row ' + (onClick ? 'nav' : '')} onClick={onClick}>
      {icon && (
        <span className="set-ic">
          <Icon n={icon} s={18} />
        </span>
      )}
      <span className="grow">
        <span className="block">{label}</span>
        {sub && <span className="small muted">{sub}</span>}
      </span>
      {children}
      {onClick && !children && <Icon n="chevron" s={18} className="muted" />}
    </Tag>
  )
}
function Group({ title, children, foot }: { title: string; children: React.ReactNode; foot?: string }) {
  return (
    <section className="set-group">
      <h3 className="set-title">{title}</h3>
      <div className="list-card">{children}</div>
      {foot && <p className="tiny muted set-foot">{foot}</p>}
    </section>
  )
}

export function Settings() {
  const app = useApp()
  const s = app.settings
  const set = app.setSettings
  const [pinStep, setPinStep] = useState<null | 'verify' | 'new' | 'parental'>(null)
  const [cats, setCats] = useState<null | 'lock' | 'hide'>(null)
  const [epgBusy, setEpgBusy] = useState(false)

  const exportBackup = () => {
    const data: any = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (k.startsWith('ip.')) data[k] = localStorage.getItem(k)
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }))
    a.download = `iptv-player-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  const importBackup = (f: File) =>
    f.text().then((t) => {
      try {
        const d = JSON.parse(t)
        Object.entries(d).forEach(([k, v]) => k.startsWith('ip.') && localStorage.setItem(k, String(v)))
        app.toast('Backup restored — reloading…')
        setTimeout(() => location.reload(), 900)
      } catch {
        app.toast('That backup file is not valid')
      }
    })

  return (
    <div className="page narrow settings">
      <Header title="Settings" back={app.stack.length > 1} />

      <Group title="Playlist">
        <Row icon="list" label="Playlists" sub={`${app.playlists.length} added · Active: ${app.active?.name || '—'}`} onClick={() => app.nav.push('playlists')} />
        <Row icon="refresh" label="Update playlist now" sub={app.catalog ? 'Last updated ' + new Date(app.catalog.fetchedAt).toLocaleString() : undefined} onClick={() => app.load(app.active, true)} />
        {app.active?.type === 'xtream' && <Row icon="user" label="Account info" onClick={() => app.nav.push('account')} />}
      </Group>

      <Group title="Device activation" foot={`Open ${SITE_LABEL}/activate on your phone and enter these codes to add playlists to this device.`}>
        <Row icon="tv" label="MAC Address" sub={deviceId()} />
        <Row icon="lock" label="Device Key" sub={deviceKey()} />
        <Row icon="refresh" label={app.syncing ? 'Syncing…' : 'Sync playlists from website'} sub={app.lastSync ? 'Last sync ' + new Date(app.lastSync).toLocaleTimeString() : undefined} onClick={() => app.syncCloud(true)} />
        <Row
          icon="edit"
          label="Reset Device Key"
          sub="Disconnects this device from the website until you activate it again"
          onClick={() => {
            resetDeviceKey()
            app.toast('New Device Key created')
            app.syncCloud(true)
          }}
        />
      </Group>

      <Group title="Player">
        {canPro() && (
          <Row icon="tv" label="Player engine" sub="Pro = VLC engine: every picture & sound format (best for Firestick / old TVs)">
            <Segmented value={s.engine || 'auto'} onChange={(v) => set({ engine: v })} options={[{ v: 'auto', l: 'Auto' }, { v: 'pro', l: 'Pro' }, { v: 'builtin', l: 'Built-in' }]} />
          </Row>
        )}
        <Row icon="live" label="Live stream format" sub="MPEG-TS is lower latency; HLS works on more devices">
          <Segmented value={s.liveFormat} onChange={(v) => set({ liveFormat: v })} options={[{ v: 'ts', l: 'MPEG-TS' }, { v: 'm3u8', l: 'HLS' }]} />
        </Row>
        <Row icon="speed" label="Buffer size" sub="Higher buffer = fewer freezes on slow internet">
          <Segmented value={s.buffer} onChange={(v) => set({ buffer: v })} options={[{ v: 'low', l: 'Low' }, { v: 'normal', l: 'Normal' }, { v: 'high', l: 'High' }]} />
        </Row>
        <Row icon="aspect" label="Default aspect ratio">
          <select className="select" value={s.aspect} onChange={(e) => set({ aspect: e.target.value as any })}>
            <option value="contain">Fit</option>
            <option value="cover">Zoom / Fill</option>
            <option value="fill">Stretch</option>
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
          </select>
        </Row>
        <Row icon="next" label="Auto-play next episode">
          <Toggle on={s.autoplayNext} onChange={(v) => set({ autoplayNext: v })} />
        </Row>
        <Row icon="tv" label="Start with last channel" sub="Opens the last live channel when the app starts">
          <Toggle on={s.autostartLast} onChange={(v) => set({ autostartLast: v })} />
        </Row>
        <Row icon="sub" label="Subtitle size">
          <Segmented value={s.subSize} onChange={(v) => set({ subSize: v })} options={[{ v: 's', l: 'S' }, { v: 'm', l: 'M' }, { v: 'l', l: 'L' }]} />
        </Row>
        <Row icon="sub" label="Subtitle background">
          <Toggle on={s.subBg} onChange={(v) => set({ subBg: v })} />
        </Row>
      </Group>

      <Group title="TV Guide" foot="Leave empty to use the guide supplied by your playlist.">
        <div className="set-row column">
          <span className="block">Custom EPG (XMLTV) URL</span>
          <input className="input" value={s.epgUrl} onChange={(e) => set({ epgUrl: e.target.value })} placeholder="https://example.com/epg.xml" inputMode="url" autoCapitalize="off" />
        </div>
        <Row icon="timer" label="EPG time shift" sub="Fix guides that show the wrong time">
          <select className="select" value={s.epgOffset} onChange={(e) => set({ epgOffset: Number(e.target.value) })}>
            {Array.from({ length: 25 }, (_, i) => i - 12).map((h) => (
              <option key={h} value={h}>
                {h > 0 ? '+' : ''}
                {h} h
              </option>
            ))}
          </select>
        </Row>
        <Row
          icon="refresh"
          label={epgBusy ? 'Loading TV Guide…' : 'Reload TV Guide'}
          onClick={() => {
            const url = s.epgUrl || app.active?.epgUrl || app.catalog?.epgUrl
            if (!url || !app.active) return app.toast('No TV Guide source')
            setEpgBusy(true)
            loadEpg(app.active.id, url, true)
              .then(() => app.toast('TV Guide updated'))
              .catch((e) => app.toast(e.message))
              .finally(() => setEpgBusy(false))
          }}
        />
      </Group>

      <Group title="Appearance">
        <Row icon="tv" label="Theme">
          <Segmented value={s.theme} onChange={(v) => set({ theme: v })} options={[{ v: 'dark', l: 'Dark' }, { v: 'light', l: 'Light' }, { v: 'auto', l: 'Auto' }]} />
        </Row>
        <Row icon="star" label="Accent color">
          <div className="swatches">
            {ACCENTS.map((c) => (
              <button key={c} className={'swatch ' + (s.accent === c ? 'on' : '')} style={{ background: c }} onClick={() => set({ accent: c })} aria-label={'Accent ' + c} />
            ))}
          </div>
        </Row>
        <Row icon="timer" label="Time format">
          <Segmented value={s.timeFormat} onChange={(v) => set({ timeFormat: v })} options={[{ v: '24', l: '24-hour' }, { v: '12', l: '12-hour' }]} />
        </Row>
        <Row icon="list" label="Show channel numbers">
          <Toggle on={s.showNumbers} onChange={(v) => set({ showNumbers: v })} />
        </Row>
      </Group>

      <Group title="Parental Control">
        <Row icon="lock" label="Lock adult categories automatically">
          <Toggle on={s.hideAdult} onChange={(v) => set({ hideAdult: v })} />
        </Row>
        <Row icon="lock" label="Locked categories" sub="Need the PIN to open" onClick={() => setPinStep('parental')} />
        <Row icon="eyeoff" label="Hidden categories" sub="Remove categories you never watch" onClick={() => setCats('hide')} />
        <Row icon="edit" label="Change PIN" onClick={() => setPinStep('verify')} />
        {app.unlocked && <Row icon="unlock" label="Lock again now" onClick={() => (app.setUnlocked(false), app.toast('Locked'))} />}
      </Group>

      <Group title="Network" foot="Web browsers block many IPTV servers (CORS / http). On a website, enter a proxy like https://your-proxy.com/?url={url}. The installed apps (Android, iOS, TV) don’t need it.">
        <div className="set-row column">
          <span className="block">Proxy URL</span>
          <input className="input" value={s.proxy} onChange={(e) => set({ proxy: e.target.value })} placeholder="https://proxy.example.com/?url={url}" autoCapitalize="off" />
        </div>
        <Row icon="live" label="Send video streams through proxy too">
          <Toggle on={s.proxyStreams} onChange={(v) => set({ proxyStreams: v })} />
        </Row>
      </Group>

      <Group title="Data">
        <Row icon="upload" label="Export backup" sub="Playlists, favorites, history and settings" onClick={exportBackup} />
        <label className="set-row nav">
          <span className="set-ic">
            <Icon n="refresh" s={18} />
          </span>
          <span className="grow">Restore backup</span>
          <input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
        </label>
        <Row
          icon="trash"
          label="Clear cache"
          sub="Re-downloads channels and TV guide"
          onClick={async () => {
            await idbDel('cat.')
            await idbDel('epg.')
            app.load(app.active, true)
          }}
        />
        <Row icon="refresh" label="Reset settings" onClick={() => (set({ ...DEFAULTS, pin: s.pin }), app.toast('Settings reset'))} />
      </Group>

      <Group title="About">
        <Row icon="info" label="IPTV PLAYER" sub={`Version ${VERSION}`} />
        <p className="tiny muted pad">IPTV PLAYER is a media player. It does not include or sell any channels or content — add a playlist from your own provider.</p>
      </Group>

      {pinStep === 'verify' && (
        <PinPad title="Enter current PIN" onClose={() => setPinStep(null)} onDone={(p) => (p === s.pin ? setPinStep('new') : false)} />
      )}
      {pinStep === 'new' && (
        <PinPad
          title="Choose a new PIN"
          onClose={() => setPinStep(null)}
          onDone={(p) => {
            set({ pin: p })
            setPinStep(null)
            app.toast('PIN changed')
          }}
        />
      )}
      {pinStep === 'parental' && (
        <PinPad title="Enter PIN" onClose={() => setPinStep(null)} onDone={(p) => (p === s.pin ? (setPinStep(null), setCats('lock')) : false)} />
      )}
      {cats && <CategoryManager mode={cats} onClose={() => setCats(null)} />}
    </div>
  )
}

function CategoryManager({ mode, onClose }: { mode: 'lock' | 'hide'; onClose: () => void }) {
  const app = useApp()
  const [kind, setKind] = useState<Kind>('live')
  const list = app.catalog?.[kind].cats || []
  const isOn = (id: string, adult?: boolean) =>
    mode === 'hide' ? app.hidden.includes(id) : app.locked.includes(id) || (app.settings.hideAdult && !!adult && !app.locked.includes('!' + id))
  const flip = (id: string, adult?: boolean) => {
    if (mode === 'hide') return app.toggleHide(id)
    if (adult && app.settings.hideAdult) return app.toggleLock('!' + id) // exempt/unexempt auto-locked adult category
    app.toggleLock(id)
  }
  return (
    <Modal title={mode === 'lock' ? 'Locked Categories' : 'Hidden Categories'} onClose={onClose} wide>
      <Segmented value={kind} onChange={setKind} options={[{ v: 'live', l: 'Live TV' }, { v: 'movie', l: 'Movies' }, { v: 'series', l: 'Series' }]} />
      <div className="list-card scroll-60">
        {list.map((c) => (
          <div key={c.id} className="set-row">
            <span className="grow ellip">
              {c.name} <span className="muted small">({c.count})</span>
            </span>
            <Toggle on={isOn(c.id, c.adult)} onChange={() => flip(c.id, c.adult)} label={c.name} />
          </div>
        ))}
        {!list.length && <div className="pad muted">No categories</div>}
      </div>
    </Modal>
  )
}
