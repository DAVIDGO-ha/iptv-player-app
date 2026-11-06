import React from 'react'

// Neon category tiles (Home) — original vector art
type T = { id: string; label: string; sub?: string; color: string; art: React.ReactNode; onClick: () => void; autofocus?: boolean }

export function NeonTiles({ tiles }: { tiles: T[] }) {
  return (
    <div className="neon-tiles">
      {tiles.map((t) => (
        <button key={t.id} className={'neon-tile nt-' + t.id} style={{ '--c': t.color } as any} onClick={t.onClick} data-autofocus={t.autofocus || undefined}>
          <span className="nt-bg" />
          <span className="nt-art">{t.art}</span>
          <span className="nt-label">{t.label}</span>
          {t.sub && <span className="nt-sub">{t.sub}</span>}
        </button>
      ))}
    </div>
  )
}

export const ArtTV = () => (
  <svg viewBox="0 0 120 100" aria-hidden>
    <defs>
      <linearGradient id="tvA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff5a5f" />
        <stop offset="1" stopColor="#c3071a" />
      </linearGradient>
      <linearGradient id="tvS" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3a0a10" />
        <stop offset="1" stopColor="#12030a" />
      </linearGradient>
    </defs>
    <path d="M45 18 33 6M75 18 87 6" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    <circle cx="33" cy="6" r="4" fill="#fff" />
    <circle cx="87" cy="6" r="4" fill="#fff" />
    <rect x="8" y="18" width="104" height="70" rx="14" fill="url(#tvA)" />
    <rect x="16" y="26" width="88" height="54" rx="8" fill="url(#tvS)" />
    <path d="M51 39v28l24-14z" fill="#fff" />
    <rect x="40" y="90" width="40" height="6" rx="3" fill="#ff5a5f" />
  </svg>
)

export const ArtReel = () => (
  <svg viewBox="0 0 120 100" aria-hidden>
    <defs>
      <radialGradient id="rlG" cx=".35" cy=".3" r=".8">
        <stop offset="0" stopColor="#fff3c4" />
        <stop offset=".45" stopColor="#f5b82e" />
        <stop offset="1" stopColor="#9a5b06" />
      </radialGradient>
    </defs>
    <path d="M70 72c18 6 34 4 46-6l-2 18c-14 8-30 9-48 2z" fill="#2b1a05" stroke="#f5b82e" strokeWidth="2.5" />
    {[0, 1, 2, 3, 4].map((i) => (
      <rect key={i} x={76 + i * 8} y={78 + (i > 2 ? -1 : 0)} width="4" height="4" rx="1" fill="#f5b82e" />
    ))}
    <circle cx="48" cy="48" r="40" fill="url(#rlG)" />
    <circle cx="48" cy="48" r="40" fill="none" stroke="#7a4300" strokeWidth="3" />
    {[0, 72, 144, 216, 288].map((a) => {
      const r = (a * Math.PI) / 180
      return <circle key={a} cx={48 + Math.cos(r) * 22} cy={48 + Math.sin(r) * 22} r="9.5" fill="#3b2003" />
    })}
    <circle cx="48" cy="48" r="7" fill="#3b2003" />
    <circle cx="48" cy="48" r="3" fill="#f5b82e" />
  </svg>
)

export const ArtClap = () => (
  <svg viewBox="0 0 120 100" aria-hidden>
    <defs>
      <linearGradient id="clB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3b2a63" />
        <stop offset="1" stopColor="#140a2a" />
      </linearGradient>
    </defs>
    <g transform="rotate(-12 14 34)">
      <rect x="12" y="20" width="96" height="16" rx="3" fill="#f2f2f7" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${18 + i * 19} 20h10l-8 16h-10z`} fill="#16101f" />
      ))}
    </g>
    <rect x="12" y="38" width="96" height="16" rx="3" fill="#f2f2f7" />
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={i} d={`M${20 + i * 19} 38h10l-8 16h-10z`} fill="#16101f" />
    ))}
    <rect x="12" y="54" width="96" height="40" rx="5" fill="url(#clB)" stroke="#b37bff" strokeWidth="2.5" />
    <path d="M52 64v22l19-11z" fill="#d6b4ff" />
  </svg>
)

export const ArtBall = () => {
  // classic football: centre pentagon + 5 edge patches, clipped to the ball
  const pent = (cx: number, cy: number, r: number, rot: number) =>
    Array.from({ length: 5 }, (_, i) => {
      const a = ((rot + i * 72 - 90) * Math.PI) / 180
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`
    }).join(' ')
  return (
    <svg viewBox="0 0 120 100" aria-hidden>
      <defs>
        <radialGradient id="blG" cx=".38" cy=".32" r=".75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".7" stopColor="#e9ebf0" />
          <stop offset="1" stopColor="#8f96a3" />
        </radialGradient>
        <clipPath id="blC">
          <circle cx="60" cy="48" r="42" />
        </clipPath>
      </defs>
      <ellipse cx="60" cy="93" rx="34" ry="5" fill="#000" opacity=".45" />
      <circle cx="60" cy="48" r="42" fill="url(#blG)" />
      <g clipPath="url(#blC)" fill="#15161a" stroke="#15161a" strokeWidth="2" strokeLinejoin="round">
        <polygon points={pent(60, 48, 13, 0)} />
        {[0, 72, 144, 216, 288].map((a) => {
          const r = ((a - 90) * Math.PI) / 180
          const cx = 60 + Math.cos(r) * 40
          const cy = 48 + Math.sin(r) * 40
          const ix = 60 + Math.cos(r) * 13
          const iy = 48 + Math.sin(r) * 13
          const ox = 60 + Math.cos(r) * 29
          const oy = 48 + Math.sin(r) * 29
          return (
            <g key={a}>
              <polygon points={pent(cx, cy, 12, a + 36)} />
              <line x1={ix} y1={iy} x2={ox} y2={oy} strokeWidth="2.5" />
            </g>
          )
        })}
      </g>
      <circle cx="60" cy="48" r="42" fill="none" stroke="#5c6270" strokeWidth="1.5" />
      <ellipse cx="46" cy="30" rx="12" ry="7" fill="#fff" opacity=".45" />
    </svg>
  )
}
