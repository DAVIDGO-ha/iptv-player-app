import React from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store'
import { App } from './App'
import { initSpatialNav } from './ui'
import './styles.css'
import { initCountryBackground } from './lib/bgflag'
import { initDeviceId } from './lib/settings'

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
const tvUA = /SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|AFT|BRAVIA|Android TV|GoogleTV|CrKey|HbbTV|VIDAA|Hisense|Philips|TCL|Roku|Vizio|Panasonic|Viera|Opera TV|AQUOS|MiBOX|SHIELD|Chromecast/i.test(ua)
// Android TV boxes of any brand: Android, big screen, no touch screen
const tvBox = /Android/i.test(ua) && navigator.maxTouchPoints === 0 && Math.max(screen.width, screen.height) >= 960
if (tvUA || tvBox) document.documentElement.classList.add('tv')

// Phone app: always landscape (set in the Android manifest) and the same layout as the laptop app,
// just smaller — like IBO Player / IPTV Smarters.
const native = !!(window as any).Capacitor?.isNativePlatform?.()
const phone = native && !tvUA && !tvBox && navigator.maxTouchPoints > 0 && Math.max(screen.width, screen.height) < 1100
if (phone) {
  document.documentElement.classList.add('phone-land')
  document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=1024, viewport-fit=cover')
  try {
    ;(screen.orientation as any)?.lock?.('landscape').catch(() => {})
  } catch {}
}

initSpatialNav()

// Android / Fire TV back button → same as Escape (closes player, menus, goes back)
try {
  const App = (window as any).Capacitor?.Plugins?.App
  App?.addListener('backButton', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
} catch {}

// Hardware MAC / device ID first (max 1.5 s), then start the app
Promise.race([initDeviceId(), new Promise((r) => setTimeout(r, 1500))]).finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StoreProvider>
      <App />
    </StoreProvider>
  )
)

initCountryBackground() // UK flag for the UK, German flag for Germany

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {})
