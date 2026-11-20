import { useEffect, useRef, useState } from 'react'
import { embedPlay, embedRect, embedState, embedStop, isProOpen, onProOpen, type Box } from '../lib/pro'
import { dropRoute, unrouted } from '../lib/net'

// Android app: the small player next to the list is the VLC engine (same as Hot Player / IBO Player), not the web
// engine. The picture is a native view placed exactly on top of the preview box of the page, so the list, the
// categories and the remote keep working as before.
const HIDDEN: Box = { x: 0, y: 0, w: 0, h: 0 }
function boxOf(el: HTMLElement | null): Box {
  if (!el || document.querySelector('.modal-wrap')) return HIDDEN // a window is open on top → hide the picture
  const r = el.getBoundingClientRect()
  const W = window.innerWidth
  const H = window.innerHeight
  if (!W || !H || r.width < 8 || r.height < 8 || r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) return HIDDEN
  return { x: r.left / W, y: r.top / H, w: r.width / W, h: r.height / H }
}

export type EmbedState = 'idle' | 'loading' | 'playing' | 'error'

export function useVlcEmbed(boxRef: React.RefObject<HTMLElement>, wantUrl: string, live = true) {
  // Full-screen Pro player open → this small player lets go of the stream (one connection per line)
  const [proOn, setProOn] = useState(isProOpen())
  const proClosedAt = useRef(0)
  useEffect(
    () =>
      onProOpen((v) => {
        if (!v) proClosedAt.current = Date.now()
        setProOn(v)
      }),
    []
  )
  const [state, setState] = useState<EmbedState>('idle')
  const [attempt, setAttempt] = useState(0)
  // Link switched to the server's address (anti-block) that does not play → the server's own name instead
  const [plain, setPlain] = useState('')
  useEffect(() => setPlain(''), [wantUrl])
  const url = proOn ? '' : plain || wantUrl

  useEffect(() => {
    if (!url) return setState('idle')
    let dead = false
    let last = ''
    let cur: EmbedState = 'loading'
    setState('loading')
    const box = () => (cur === 'error' ? HIDDEN : boxOf(boxRef.current)) // error → show the page's message instead of a black box
    let tick: any = 0
    let poll: any = 0
    // Just back from the full-screen player: give the server a moment to free the connection
    const wait = Date.now() - proClosedAt.current < 1500 ? 1200 : 0
    const start = setTimeout(() => {
      if (dead) return
      const b = box()
      last = JSON.stringify(b)
      embedPlay(url, live, b).catch(() => {
        if (dead) return
        cur = 'error'
        setState('error')
      })
      tick = setInterval(() => {
        const nb = box()
        const k = JSON.stringify(nb)
        if (k === last) return
        last = k
        embedRect(nb)
      }, 300)
      poll = setInterval(async () => {
        const s = await embedState()
        if (dead || !s?.state || s.state === 'idle') return
        const st = s.state as EmbedState
        if (st === cur) return
        cur = st
        if (st === 'playing' && plain) dropRoute(plain) // the name works, the address did not → stop switching
        if (st === 'error' && !plain) {
          const p = unrouted(wantUrl)
          if (p) return setPlain(p)
        }
        setState(st)
      }, 1000)
    }, wait)
    return () => {
      dead = true
      clearTimeout(start)
      clearInterval(tick)
      clearInterval(poll)
      embedStop()
    }
  }, [url, live, attempt])

  return { state, retry: () => setAttempt((a) => a + 1) }
}
