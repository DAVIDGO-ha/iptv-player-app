// Tiny IndexedDB key/value store for large data (catalogs, EPG).
const DB = 'iptv-player'
const STORE = 'kv'
let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1)
      r.onupgradeneeded = () => r.result.createObjectStore(STORE)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  return dbp
}

export async function idbGet<T = any>(key: string): Promise<T | undefined> {
  try {
    const db = await open()
    return await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key)
      q.onsuccess = () => res(q.result)
      q.onerror = () => res(undefined)
    })
  } catch {
    return undefined
  }
}

export async function idbSet(key: string, value: any): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => res()
      tx.onerror = () => res()
    })
  } catch {}
}

export async function idbDel(prefix: string): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite')
      const st = tx.objectStore(STORE)
      const q = st.openCursor()
      q.onsuccess = () => {
        const c = q.result
        if (!c) return
        if (String(c.key).startsWith(prefix)) c.delete()
        c.continue()
      }
      tx.oncomplete = () => res()
      tx.onerror = () => res()
    })
  } catch {}
}
