import React, { useEffect, useState } from 'react'
import { useApp } from '../store'
import { Empty, Icon, Spinner } from '../ui'
import { Header } from './common'
import { canRecord, deleteRec, listRecs, openRecFolder, recFor, recUrl, startRec, stopRec, useRecs, type RecFile } from '../lib/rec'
import { hasDesktopPro, hasNativePro, playPro } from '../lib/pro'

/** Record / Stop button (only shown in the Android and computer apps). */
export function RecButton({ url, title, live = true, className = 'btn', iconOnly = false }: { url: string; title: string; live?: boolean; className?: string; iconOnly?: boolean }) {
  const app = useApp()
  useRecs()
  const [busy, setBusy] = useState(false)
  if (!url || !canRecord()) return null
  const r = recFor(url)
  const click = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (r) {
        await stopRec(r.id)
        app.toast('Recording saved — open Recordings to watch it')
      } else {
        await startRec(url, title, live)
        app.toast('Recording started. It uses one more connection of the line.')
      }
    } catch (e: any) {
      app.toast(e?.message || 'Could not record this channel')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button className={className + (r ? ' rec-on' : '')} onClick={click} aria-label={r ? 'Stop recording' : 'Record'} title={r ? 'Stop recording' : 'Record'}>
      <Icon n="rec" s={iconOnly ? 22 : 18} fill={!!r} />
      {!iconOnly && <span>{r ? 'Stop recording' : 'Record'}</span>}
    </button>
  )
}

const size = (b: number) => (b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB')
const when = (t: number) => (t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '')
const mins = (t: number) => Math.max(0, Math.floor((Date.now() - t) / 60000))

/** More › Recordings */
export function Recordings() {
  const app = useApp()
  const running = useRecs()
  const [files, setFiles] = useState<RecFile[] | null>(null)
  const [del, setDel] = useState('')
  const [, tick] = useState(0)
  const load = () => listRecs().then(setFiles)
  useEffect(() => {
    load()
    const id = setInterval(() => (tick((x) => x + 1), load()), 15000)
    return () => clearInterval(id)
  }, [running.length])

  const play = async (f: RecFile) => {
    const url = recUrl(f.file)
    if (hasNativePro()) return void playPro({ url, title: f.name })
    // computer app: MP4 recordings play in the app; other files open in VLC when installed
    if (!/\.mp4$/i.test(f.file) && hasDesktopPro() && (await (window as any).desktop.hasVlc?.())) return void playPro({ url: f.file, title: f.name })
    app.play({ kind: 'movie', title: f.name, url })
  }
  const remove = async (f: RecFile) => {
    if (del !== f.file) return setDel(f.file)
    setDel('')
    try {
      await deleteRec(f.file)
    } catch {}
    load()
  }

  if (!canRecord()) return <Empty icon="rec" title="Recordings" text="Recording is available in the Android, Firestick and computer apps." />
  return (
    <div className="page narrow">
      <Header title="Recordings" />
      {running.length > 0 && (
        <div className="list-card">
          {running.map((r) => (
            <div key={r.id} className="set-row">
              <span className="set-ic rec-dot">
                <Icon n="rec" s={18} fill />
              </span>
              <span className="grow">
                <b>{r.name}</b>
                <div className="small muted">Recording… {mins(r.started)} min</div>
              </span>
              <button className="btn" onClick={() => stopRec(r.id).then(load)}>
                <Icon n="pause" s={16} fill /> Stop
              </button>
            </div>
          ))}
        </div>
      )}
      {hasDesktopPro() && (
        <button className="btn" onClick={openRecFolder} style={{ marginBottom: 12 }}>
          <Icon n="list" s={18} /> Open folder
        </button>
      )}
      {files === null ? (
        <Spinner />
      ) : !files.length ? (
        <Empty icon="rec" title="No recordings yet" text="Open a live channel and press Record." />
      ) : (
        <div className="list-card">
          {files.map((f) => (
            <div key={f.file} className="set-row">
              <span className="set-ic">
                <Icon n="play" s={18} fill />
              </span>
              <span className="grow">
                <b className="ellip">{f.name}</b>
                <div className="small muted">
                  {when(f.date)} · {size(f.size)}
                </div>
              </span>
              <button className="btn primary" onClick={() => play(f)}>
                <Icon n="play" s={16} fill /> Play
              </button>
              <button className="btn" onClick={() => remove(f)}>
                <Icon n="trash" s={16} /> {del === f.file ? 'Sure?' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
