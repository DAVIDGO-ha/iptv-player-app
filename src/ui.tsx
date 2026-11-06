import React, { useEffect, useRef, useState } from 'react'
import { getSettings } from './lib/settings'

// ——— Icons (original line set, 24px grid) ———
const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  live: 'M3 7h18v12H3zM8 3l4 4 4-4',
  guide: 'M3 5h18v15H3zM3 10h18M8 5v15',
  movie: 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v5M15 4v5M9 15v5M15 15v5',
  series: 'M3 6h14v12H3zM17 10l4-2v8l-4-2M7 3h6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  heart: 'M12 20s-7.5-4.6-9.3-9.2C1.6 7.6 3.6 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.4 0 5.4 3.1 4.3 6.3C19.5 15.4 12 20 12 20z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L14.8 21h-4l-.3-2.1a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.6 9.9l2-3.4 1.9.7a7 7 0 0 1 2-1.2L10.8 4h4l.3 2.1a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4z',
  more: 'M4 12a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0M16.8 12a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0',
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
  eyeoff: 'M3 3l18 18M10.6 6.1A9.5 9.5 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.7 3.2M6.5 7.6C4.3 9.1 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 4-1M9.9 10a3 3 0 0 0 4.1 4.1',
  refresh: 'M20 11a8 8 0 0 0-14.3-4.3L4 9M4 4v5h5M4 13a8 8 0 0 0 14.3 4.3L20 15M20 20v-5h-5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  fwd: 'M13 6l6 6-6 6M5 6l6 6-6 6',
  rew: 'M11 6l-6 6 6 6M19 6l-6 6 6 6',
  skipf: 'M12 5a7 7 0 1 1-7 7M12 5V2l4 3-4 3',
  skipb: 'M12 5a7 7 0 1 0 7 7M12 5V2L8 5l4 3',
  next: 'M5 5l10 7-10 7zM18 5v14',
  prev: 'M19 5 9 12l10 7zM6 5v14',
  audio: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6',
  sub: 'M3 5h18v14H3zM7 12h4M7 15h7M14 12h3',
  aspect: 'M3 6h18v12H3zM7 10V9h2M17 14v1h-2',
  speed: 'M12 20a8 8 0 1 1 8-8M12 12l4-3',
  pip: 'M3 5h18v14H3zM12 12h7v5h-7z',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  exitfull: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  timer: 'M12 8v4l3 2M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9 2h6',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  catchup: 'M12 21a9 9 0 1 0-9-9M3 12l-1.5-2M3 12l2-1.5M12 7v5h4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  quality: 'M3 6h18v12H3zM7 10v4M7 12h3M10 10v4M14 10h2.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5H14z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  server: 'M4 4h16v7H4zM4 13h16v7H4zM8 7.5h.01M8 16.5h.01',
  cast: 'M3 17a4 4 0 0 1 4 4M3 13a8 8 0 0 1 8 8M3 9V5h18v14h-6',
  tv: 'M3 5h18v12H3zM8 21h8',
}
export function Icon({ n, s = 22, fill = false, className = '' }: { n: string; s?: number; fill?: boolean; className?: string }) {
  return (
    <svg className={'ic ' + className} width={s} height={s} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={fill ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[n] || P.info} />
    </svg>
  )
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="IPTV PLAYER">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="#7a0612" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#lg1)" />
      <rect x="12" y="17" width="40" height="28" rx="6" fill="none" stroke="#fff" strokeWidth="3.2" opacity=".95" />
      <path d="M28 24.5v13l11-6.5z" fill="#fff" />
      <path d="M24 51h16" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" opacity=".9" />
    </svg>
  )
}

// ——— Image with graceful fallback ———
export function Img({ src, alt, className = '', fallback }: { src?: string; alt: string; className?: string; fallback?: React.ReactNode }) {
  const [err, setErr] = useState(false)
  useEffect(() => setErr(false), [src])
  if (!src || err)
    return <div className={className + ' img-fallback'}>{fallback ?? <span>{initials(alt)}</span>}</div>
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setErr(true)} />
}
export const initials = (s: string) =>
  s
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'TV'

// ——— Generic pieces ———
export function Spinner({ size = 28 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} />
}
export function Empty({ icon = 'info', title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon n={icon} s={30} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }: { title?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement
    setTimeout(() => (document.querySelector('.modal [data-autofocus], .modal button, .modal input') as HTMLElement)?.focus(), 30)
    return () => prev?.focus?.()
  }, [])
  return (
    <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-back="modal">
      <div className={'modal glass ' + (wide ? 'wide' : '')} role="dialog" aria-modal>
        {title && (
          <div className="modal-head">
            <h3>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon n="close" />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function PinPad({ title = 'Enter PIN', onDone, onClose }: { title?: string; onDone: (pin: string) => boolean | void; onClose: () => void }) {
  const [v, setV] = useState('')
  const [bad, setBad] = useState(false)
  const press = (d: string) => {
    if (d === 'del') return setV((x) => x.slice(0, -1))
    const n = (v + d).slice(0, 4)
    setV(n)
    if (n.length === 4) {
      const ok = onDone(n)
      if (ok === false) {
        setBad(true)
        setTimeout(() => (setBad(false), setV('')), 600)
      }
    }
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      if (e.key === 'Backspace') {
        e.stopPropagation()
        press('del')
      }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  })
  return (
    <Modal title={title} onClose={onClose}>
      <div className={'pin-dots ' + (bad ? 'shake' : '')}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < v.length ? 'on' : ''} />
        ))}
      </div>
      <div className="pin-grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((d, i) =>
          d ? (
            <button key={i} className="pin-key" onClick={() => press(d)}>
              {d === 'del' ? <Icon n="back" /> : d}
            </button>
          ) : (
            <span key={i} />
          )
        )}
      </div>
      <p className="muted center small">Default PIN is 0000 — change it in Settings › Parental Control.</p>
    </Modal>
  )
}

// Render big lists progressively
export function useProgressive<T>(list: T[], step = 60) {
  const [n, setN] = useState(step)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => setN(step), [list])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setN((x) => Math.min(list.length, x + step * 2)), { rootMargin: '1200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [list, n])
  return { shown: list.slice(0, n), sentinel: n < list.length ? <div ref={ref} className="sentinel" /> : null }
}

export function Chips({ items, value, onChange }: { items: { id: string; label: string; count?: number; locked?: boolean }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="chips hscroll">
      {items.map((c) => (
        <button key={c.id} className={'chip ' + (c.id === value ? 'on' : '')} onClick={() => onChange(c.id)}>
          {c.locked && <Icon n="lock" s={13} />}
          {c.label}
          {c.count != null && <span className="chip-n">{c.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button className={'toggle ' + (on ? 'on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

// ——— Time helpers ———
export function fmtTime(ms: number) {
  const d = new Date(ms + getSettings().epgOffset * 36e5)
  const h12 = getSettings().timeFormat === '12'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: h12 })
}
export function fmtDur(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0')
}
export const progressOf = (start: number, stop: number) => {
  const t = Date.now() - getSettings().epgOffset * 36e5
  return Math.max(0, Math.min(1, (t - start) / (stop - start)))
}

// ——— TV remote / keyboard spatial navigation ———
const FOCUSABLE = 'button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]'
export type Dir = 'u' | 'd' | 'l' | 'r'
export const keyDir = (e: KeyboardEvent): Dir | undefined => ({ ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r' } as any)[e.key]

export function moveFocus(dir: Dir, scope: ParentNode = document): boolean {
  const cur = document.activeElement as HTMLElement | null
  const els = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"]')
  })
  if (!els.length) return false
  if (!cur || cur === document.body || !els.includes(cur)) {
    const first = (scope.querySelector('[data-autofocus]') as HTMLElement) || els.find((x) => x.closest('.main')) || els[0]
    first.focus()
    return true
  }
  const a = cur.getBoundingClientRect()
  const ax = a.left + a.width / 2
  const ay = a.top + a.height / 2
  let best: HTMLElement | null = null
  let bestScore = Infinity
  for (const el of els) {
    if (el === cur) continue
    const b = el.getBoundingClientRect()
    const dx = b.left + b.width / 2 - ax
    const dy = b.top + b.height / 2 - ay
    let main = 0
    let cross = 0
    if (dir === 'r') (main = b.left - a.right + 1), (cross = dy)
    if (dir === 'l') (main = a.left - b.right + 1), (cross = dy)
    if (dir === 'd') (main = b.top - a.bottom + 1), (cross = dx)
    if (dir === 'u') (main = a.top - b.bottom + 1), (cross = dx)
    if (main < -4) continue
    if ((dir === 'l' || dir === 'r') && (dir === 'r' ? dx : -dx) < 2) continue
    if ((dir === 'u' || dir === 'd') && (dir === 'd' ? dy : -dy) < 2) continue
    const score = Math.max(0, main) + Math.abs(cross) * 2.2
    if (score < bestScore) (bestScore = score), (best = el)
  }
  if (!best) return false
  best.focus({ preventScroll: true })
  best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  return true
}

export function initSpatialNav() {
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return
    const dir = keyDir(e)
    if (!dir) return
    if (document.querySelector('.player-root')) return // player handles its own keys
    const cur = document.activeElement as HTMLElement | null
    if (cur && (cur.tagName === 'INPUT' || cur.tagName === 'TEXTAREA') && (dir === 'l' || dir === 'r')) return
    if (cur && cur.tagName === 'SELECT' && (dir === 'u' || dir === 'd')) return
    const modals = document.querySelectorAll('.modal-wrap')
    const scope: ParentNode = modals.length ? modals[modals.length - 1] : document
    if (moveFocus(dir, scope)) e.preventDefault()
  })
}
