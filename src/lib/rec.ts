// Recording: saves a live channel (or catch-up) to a file on this device.
// Windows / Mac / Linux app → Videos › IPTV PLAYER.  Android / Firestick app → the app's own Movies folder.
// Recordings can be played back from More › Recordings.
import { useEffect, useState } from 'react'
import { routed } from './net'

const W = window as any
const D = () => W.desktop
const native = () => !!W.Capacitor?.isNativePlatform?.()
const call = async (method: string, args: any = {}) => {
  const C = W.Capacitor
  return C.nativePromise ? C.nativePromise('VlcPlayer', method, args) : C.Plugins?.VlcPlayer?.[method](args)
}

export const canRecord = () => !!D()?.recStart || native()

export type ActiveRec = { id: string; name: string; url: string; file: string; started: number }
export type RecFile = { name: string; file: string; size: number; date: number }

let active: ActiveRec[] = []
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}h${pad(d.getMinutes())}`
const clean = (s: string) => (s || 'Recording').replace(/[\\/:*?"<>|#%&{}$!'@+`=]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Recording'

export async function startRec(url: string, name: string, live = true): Promise<ActiveRec> {
  const fname = `${clean(name)} ${stamp()}`
  const u = routed(url) // same anti-block route as the player
  const r = D() ? await D().recStart(u, fname, live) : await call('recStart', { url: u, name: fname, live })
  if (!r?.id) throw new Error('Could not start the recording')
  const rec = { id: String(r.id), name, url, file: r.file || '', started: Date.now() }
  active = [...active, rec]
  emit()
  return rec
}

export async function stopRec(id: string) {
  try {
    if (D()) await D().recStop(id)
    else await call('recStop', { id })
  } finally {
    active = active.filter((r) => r.id !== id)
    emit()
  }
}

export async function listRecs(): Promise<RecFile[]> {
  try {
    const r = D() ? await D().recList() : (await call('recList'))?.files
    return (Array.isArray(r) ? r : []).map((x: any) => ({ name: String(x.name), file: String(x.file), size: Number(x.size) || 0, date: Number(x.date) || 0 })).sort((a, b) => b.date - a.date)
  } catch {
    return []
  }
}

export async function deleteRec(file: string) {
  if (D()) await D().recDelete(file)
  else await call('recDelete', { file })
}

export const openRecFolder = () => D()?.recOpen?.()

/** file path → URL a player can open */
export const recUrl = (file: string) => (/^[a-z]+:\/\//i.test(file) ? file : 'file://' + encodeURI((file.startsWith('/') ? '' : '/') + file.replace(/\\/g, '/')).replace(/#/g, '%23').replace(/\?/g, '%3F'))

/** Live list of running recordings (re-renders when one starts / stops). */
export function useRecs() {
  const [, set] = useState(0)
  useEffect(() => {
    const f = () => set((x) => x + 1)
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  }, [])
  return active
}

export const recFor = (url: string) => active.find((r) => r.url === url)
