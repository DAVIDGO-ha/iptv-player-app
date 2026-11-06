import React from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store'
import { App } from './App'
import { initSpatialNav } from './ui'
import './styles.css'

// Samsung Tizen: register remote media / colour keys
try {
  const t = (window as any).tizen
  if (t?.tvinputdevice)
    ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'ChannelUp', 'ChannelDown', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((k) => {
      try {
        t.tvinputdevice.registerKey(k)
      } catch {}
    })
} catch {}

// TV / big screen detection → larger UI
const ua = navigator.userAgent
if (/SMART-TV|Tizen|Web0S|webOS|NetCast|AFT|BRAVIA|Android TV|GoogleTV|CrKey|HbbTV|VIDAA/i.test(ua)) document.documentElement.classList.add('tv')

initSpatialNav()

// Android / Fire TV back button → same as Escape (closes player, menus, goes back)
try {
  const App = (window as any).Capacitor?.Plugins?.App
  App?.addListener('backButton', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
} catch {}

createRoot(document.getElementById('root')!).render(
  <StoreProvider>
    <App />
  </StoreProvider>
)

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {})
