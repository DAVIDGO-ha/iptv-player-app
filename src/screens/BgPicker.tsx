import React from 'react'
import { useApp } from '../store'
import { BG_COLORS, BG_IMAGES, isColor } from '../lib/bgpick'
import { t } from '../lib/i18n'

/** Settings › Background: default picture, 4 pictures, colours, or any colour (picker). */
export function BgPicker({ defaultStyle }: { defaultStyle: React.CSSProperties }) {
  const app = useApp()
  const v = String((app.settings as any).bg || 'default')
  const pick = (bg: string) => app.setSettings({ bg } as any)
  const custom = isColor(v) && !BG_COLORS.includes(v.toUpperCase())
  return (
    <div className="bg-pick">
      <button className={'bg-opt ' + (v === 'default' ? 'on' : '')} style={defaultStyle} onClick={() => pick('default')}>
        <span>{t('Default')}</span>
      </button>
      {BG_IMAGES.map((i) => (
        <button key={i.id} className={'bg-opt ' + (v === i.id ? 'on' : '')} style={{ backgroundImage: `url(./bg/${i.id}.jpg)` }} onClick={() => pick(i.id)}>
          <span>{t(i.name)}</span>
        </button>
      ))}
      <div className="bg-colors">
        {BG_COLORS.map((c) => (
          <button key={c} className={'bg-sw ' + (v.toUpperCase() === c ? 'on' : '')} style={{ background: c }} onClick={() => pick(c)} aria-label={'Colour ' + c} />
        ))}
        <label className={'bg-sw bg-custom ' + (custom ? 'on' : '')} title={t('Custom colour')} style={custom ? { background: v } : undefined}>
          <input type="color" value={isColor(v) ? v : '#1e1b4b'} onChange={(e) => pick(e.target.value)} aria-label={t('Custom colour')} />
          {!custom && <span>+</span>}
        </label>
      </div>
    </div>
  )
}
