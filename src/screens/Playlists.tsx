import React, { useRef, useState } from 'react'
import { useApp } from '../store'
import { Icon, Logo, Modal, Segmented, Spinner } from '../ui'
import { xtLogin } from '../lib/xtream'
import { parseM3U } from '../lib/m3u'
import { fetchText, fixProto } from '../lib/net'
import { deviceId } from '../lib/settings'
import { activateUrl, deviceKey } from '../lib/cloud'
import { SITE_LABEL } from '../config'
import { Header } from './common'
import type { Playlist } from '../lib/types'

export function Welcome() {
  const app = useApp()
  return (
    <div className="welcome">
      <div className="welcome-glow" />
      <div className="welcome-card">
        <Logo size={72} />
        <h1 className="hero-title">IPTV PLAYER</h1>
        <p className="muted lead">Live TV, movies and series from your own playlist — beautifully, on every screen.</p>
        <ActivationCard />
        <button className="btn glass-btn xl" onClick={() => app.nav.push('add')} data-autofocus>
          <Icon n="plus" s={20} /> Add playlist on this device
        </button>
        <div className="feature-row">
          {['Xtream Codes', 'M3U / M3U8', 'XMLTV EPG', 'Catch-Up', 'Multi-View', '4K HDR'].map((f) => (
            <span key={f} className="feature">
              <Icon n="check" s={14} /> {f}
            </span>
          ))}
        </div>
        <p className="tiny muted">IPTV PLAYER does not provide any content. Add a playlist from your own provider.</p>
      </div>
    </div>
  )
}

export function AddPlaylist({ edit }: { edit?: Playlist }) {
  const app = useApp()
  const [type, setType] = useState<'xtream' | 'm3u' | 'file'>(edit ? (edit.file ? 'file' : edit.type) : 'xtream')
  const [name, setName] = useState(edit?.name || '')
  const [server, setServer] = useState(edit?.server || '')
  const [user, setUser] = useState(edit?.username || '')
  const [pass, setPass] = useState(edit?.password || '')
  const [url, setUrl] = useState(edit?.url || '')
  const [epg, setEpg] = useState(edit?.epgUrl || '')
  const [fileText, setFileText] = useState<string>('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Paste a full Xtream M3U link → auto-detect credentials
  const smartUrl = (v: string) => {
    setUrl(v)
    const m = v.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/i)
    if (m) {
      setType('xtream')
      setServer(m[1])
      setUser(decodeURIComponent(m[2]))
      setPass(decodeURIComponent(m[3]))
      app.toast('Xtream Codes details detected')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      // An Xtream "get.php" M3U link → use the Xtream API instead (faster, and many panels block the M3U download)
      const xt = (type === 'm3u' ? url : server).trim().match(/^(https?:\/\/[^/]+)\/get\.php\?(.*)$/i)
      const xq = xt ? new URLSearchParams(xt[2]) : null
      const isXt = type === 'xtream' || !!(xq?.get('username') && xq?.get('password'))
      if (isXt) {
        const sv = xq?.get('username') ? xt![1] : server.trim()
        const us = xq?.get('username') || user.trim()
        const pw = xq?.get('password') || pass.trim()
        if (!sv || !us || !pw) throw new Error('Please fill in server, username and password.')
        const p = { type: 'xtream' as const, name: name || hostOf(sv), server: sv, username: us, password: pw, epgUrl: epg }
        await xtLogin({ ...p, id: '', addedAt: 0 })
        p.server = fixProto(sv) // use http/https — whichever the server actually answered on
        await app.addPlaylist(p, undefined, edit?.id)
      } else if (type === 'm3u') {
        if (!/^https?:\/\//i.test(url)) throw new Error('Please enter a valid playlist URL (http:// or https://).')
        const text = await fetchText(url, 120000)
        parseM3U(text)
        await app.addPlaylist({ type: 'm3u', name: name || hostOf(url), url: fixProto(url.trim()), epgUrl: epg }, undefined, edit?.id)
      } else {
        if (!fileText && !edit) throw new Error('Choose an .m3u file first.')
        if (fileText) parseM3U(fileText)
        await app.addPlaylist({ type: 'm3u', name: name || fileName || 'My Playlist', epgUrl: epg, file: true }, fileText || undefined, edit?.id)
      }
      app.toast(edit ? 'Playlist saved' : 'Playlist added')
      app.nav.tab('home')
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <Header title={edit ? 'Edit Playlist' : 'Add Playlist'} back={app.stack.length > 1} />
      <form className="card form" onSubmit={submit}>
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { v: 'xtream', l: 'Xtream Codes' },
            { v: 'm3u', l: 'M3U URL' },
            { v: 'file', l: 'M3U File' },
          ]}
        />
        <label className="field">
          <span>Playlist name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My TV" />
        </label>
        {type === 'xtream' && (
          <>
            <label className="field">
              <span>Server URL</span>
              <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="http://example.com:8080" inputMode="url" autoCapitalize="off" autoCorrect="off" data-autofocus />
            </label>
            <div className="grid2">
              <label className="field">
                <span>Username</span>
                <input value={user} onChange={(e) => setUser(e.target.value)} autoCapitalize="off" autoCorrect="off" />
              </label>
              <label className="field">
                <span>Password</span>
                <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" autoCapitalize="off" />
              </label>
            </div>
            <p className="tiny muted">Tip: paste a full “get.php?username=…” link in the M3U URL tab — it will be converted automatically.</p>
          </>
        )}
        {type === 'm3u' && (
          <label className="field">
            <span>Playlist URL</span>
            <input value={url} onChange={(e) => smartUrl(e.target.value)} placeholder="https://provider.com/playlist.m3u" inputMode="url" autoCapitalize="off" data-autofocus />
          </label>
        )}
        {type === 'file' && (
          <div className="field">
            <span>Playlist file</span>
            <button type="button" className="btn wide" onClick={() => fileRef.current?.click()}>
              <Icon n="upload" s={18} /> {fileName || (edit ? 'Replace file (optional)' : 'Choose .m3u / .m3u8 file')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".m3u,.m3u8,audio/x-mpegurl,application/x-mpegurl,text/plain"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setFileName(f.name.replace(/\.m3u8?$/i, ''))
                setFileText(await f.text())
              }}
            />
          </div>
        )}
        <label className="field">
          <span>EPG URL (optional)</span>
          <input value={epg} onChange={(e) => setEpg(e.target.value)} placeholder="Auto-detected when available" inputMode="url" autoCapitalize="off" />
        </label>
        {err && (
          <div className="alert">
            <Icon n="info" s={18} /> {err}
          </div>
        )}
        <button className="btn primary xl" disabled={busy}>
          {busy ? <Spinner size={18} /> : <Icon n="check" s={20} />} {edit ? 'Save' : 'Add Playlist'}
        </button>
      </form>
    </div>
  )
}

const hostOf = (u: string) => {
  try {
    return new URL(/^https?:/i.test(u) ? u : 'http://' + u).hostname
  } catch {
    return 'Playlist'
  }
}

export function Playlists() {
  const app = useApp()
  const [del, setDel] = useState<Playlist | null>(null)
  return (
    <div className="page narrow">
      <Header title="Playlists" back={app.stack.length > 1}>
        <button className="btn" onClick={() => app.syncCloud(true)}>
          <Icon n="refresh" s={18} /> Sync
        </button>
        <button className="btn primary" onClick={() => app.nav.push('add')}>
          <Icon n="plus" s={18} /> Add
        </button>
      </Header>
      <ActivationCard compact />
      <div className="list-card">
        {app.playlists.map((p) => (
          <div key={p.id} className={'pl-row ' + (p.id === app.active?.id ? 'on' : '')}>
            <button className="pl-main" onClick={() => (app.selectPlaylist(p.id), app.nav.tab('home'))}>
              <span className="pl-ic">
                <Icon n={p.type === 'xtream' ? 'server' : p.file ? 'upload' : 'link'} />
              </span>
              <span>
                <span className="strong block">{p.name}</span>
                <span className="small muted">
                  {p.cloud ? 'Added from website · ' : ''}
                  {p.type === 'xtream' ? `Xtream · ${p.username}` : p.file ? 'M3U file' : 'M3U URL'}
                </span>
              </span>
              {p.id === app.active?.id && <Icon n="check" className="accent" />}
            </button>
            <button className="icon-btn" aria-label="Refresh" onClick={() => (app.selectPlaylist(p.id), app.load(p, true))}>
              <Icon n="refresh" s={20} />
            </button>
            <button className="icon-btn" aria-label="Edit" onClick={() => (p.cloud ? app.toast('Edit this playlist on the website') : app.nav.push('edit', { id: p.id }))}>
              <Icon n="edit" s={20} />
            </button>
            <button
              className="icon-btn danger"
              aria-label="Delete"
              onClick={() => (p.cloud ? app.toast('Remove this playlist on the website') : setDel(p))}
            >
              <Icon n="trash" s={20} />
            </button>
          </div>
        ))}
      </div>
      {del && (
        <Modal title="Delete playlist?" onClose={() => setDel(null)}>
          <p className="muted">“{del.name}” and its favorites and history will be removed from this device.</p>
          <div className="row gap">
            <button className="btn" onClick={() => setDel(null)} data-autofocus>
              Cancel
            </button>
            <button className="btn primary" style={{ background: '#ff453a' }} onClick={() => (app.removePlaylist(del.id), setDel(null))}>
              <Icon n="trash" s={18} /> Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Shown when the device is blocked from the admin dashboard
export function Blocked() {
  const app = useApp()
  return (
    <div className="welcome blocked-screen">
      <div className="welcome-glow" />
      <div className="welcome-card">
        <div className="blocked-badge">
          <Icon n="lock" s={34} />
        </div>
        <h1 className="hero-title">Device blocked</h1>
        <p className="muted lead">To unblock your device, contact us:</p>
        <div className="blocked-contact">
          <div>
            <Icon n="tv" s={20} /> <b>{SITE_LABEL.replace(/^www\./, 'www.')}</b>
          </div>
          <div>
            <Icon n="info" s={20} /> WhatsApp <b>+44 7473 966835</b>
          </div>
        </div>
        <p className="small muted">Give us your MAC Address and Device Key:</p>
        <div className="dev-codes">
          <div>
            <span className="muted small">MAC Address</span>
            <b>{deviceId()}</b>
          </div>
          <div>
            <span className="muted small">Device Key</span>
            <b>{deviceKey()}</b>
          </div>
        </div>
        <button className="btn glass-btn xl" onClick={() => app.syncCloud(true)} data-autofocus>
          {app.syncing ? <Spinner size={18} /> : <Icon n="refresh" s={20} />} Check again
        </button>
      </div>
    </div>
  )
}

// Shown on the TV: scan the QR / open the website on a phone, enter Device ID + Key, add a playlist.
export function ActivationCard({ compact = false }: { compact?: boolean }) {
  const app = useApp()
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(activateUrl())}`
  return (
    <div className={'activate-card glass ' + (compact ? 'compact' : '')}>
      <img className="qr" src={qr} alt="" referrerPolicy="no-referrer" onError={(e) => e.currentTarget.setAttribute('data-err', '1')} />
      <div className="activate-text">
        <div className="eyebrow">Add your playlist from your phone</div>
        <ol>
          <li>
            Scan the code or open <b className="accent">{SITE_LABEL}/activate</b>
          </li>
          <li>Enter your MAC Address and Device Key</li>
          <li>Add your M3U link or Xtream login — it appears here automatically</li>
        </ol>
        <div className="dev-codes">
          <div>
            <span className="muted small">MAC Address</span>
            <b>{deviceId()}</b>
          </div>
          <div>
            <span className="muted small">Device Key</span>
            <b>{deviceKey()}</b>
          </div>
        </div>
        <div className="small muted row gap">
          {app.syncing ? <Spinner size={14} /> : <span className="live-pulse" />} Waiting for your playlist…
          <button className="link" onClick={() => app.syncCloud(true)}>
            Check now
          </button>
        </div>
      </div>
    </div>
  )
}
