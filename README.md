# IPTV PLAYER

A premium, Apple-style IPTV player built from one codebase for every screen. It does **not** include any content: users add their own playlist.

## Features

- **Playlists:** Xtream Codes login, M3U URL or M3U file. You can add several playlists and switch between them. Pasting a `get.php` link fills in the server, username and password automatically.
- **Live TV:** categories, search, sort, favorites and recently watched. On wide screens there's a live preview. Each channel shows now/next EPG with a progress bar. You can type a channel number, and zap with up/down or the CH+/CH− keys. The full-screen player has a channel list.
- **TV Guide:** full EPG grid (XMLTV) with a "now" line, programme info and reminders. There's an EPG time-shift setting and a custom EPG URL.
- **Catch-up / timeshift:** browse past programmes by day (Xtream servers with archive).
- **Movies & Series:** poster grids, category chips, sorting (newest, top rated, A–Z) and My List. Detail pages show the backdrop, plot, cast, director, rating, 4K badge and trailer. Series have season tabs and episode thumbnails.
- **Pro player:**
  - Plays HLS (hls.js), MPEG-TS/FLV (mpegts.js) and MP4/MKV/WebM natively, with automatic fallback between formats.
  - Track and picture controls: audio tracks, subtitles (embedded or your own .srt/.vtt file), quality levels, 5 aspect modes, speed and sleep timer.
  - Viewing tools: Picture-in-Picture, AirPlay (Safari), full screen and screen rotation.
  - Playback memory: resume, Continue Watching, and next-episode autoplay with a countdown.
  - "Open in external player" (VLC) and copy-link options.
- **Multi-View:** 2 or 4 live channels at once, with an audio focus.
- **Parental control:** PIN lock (default 0000). Adult categories lock automatically, and you can choose which categories to lock or hide.
- **Settings:**
  - Live format (TS/HLS) and buffer size
  - Dark/light/auto theme with 8 accent colors
  - 12/24h time format
  - Subtitle size and background
  - Proxy
  - Backup export/restore
  - Clear cache
  - Account info (expiry, connections)
  - Device ID
- **TV remote ready:** D-pad spatial navigation, a tvOS-style focus effect, and Back/Media/Channel keys (Samsung, LG and Fire TV). Big screens get a larger 10-foot UI.
- **PWA:** can be installed from the browser (offline app shell).

## Build

```bash
npm install
npm run build      # → dist/   (static files, host anywhere)
npm run dev        # dev server at http://localhost:5173
npm run mock -- path/to/video.mp4   # demo Xtream server: http://localhost:8088  demo / demo
```

## Install on every device

| Device | How |
|---|---|
| **Website / any browser** | Upload `dist/` to your hosting. Browsers block many IPTV servers (CORS, or http on an https site). Run `tools/proxy-server.mjs` on your server and set it in Settings › Network. |
| **Android phone, Android TV, Fire TV** | `npm i @capacitor/core @capacitor/cli @capacitor/android` → `npx cap add android` → `npx cap sync` → open in Android Studio → build the APK/AAB. `capacitor.config.json` is ready (no proxy needed). For TV, add the `LEANBACK_LAUNCHER` intent and a banner in AndroidManifest. |
| **iPhone / iPad** | `npm i @capacitor/ios` → `npx cap add ios` → open in Xcode. Add `NSAppTransportSecurity › NSAllowsArbitraryLoads = YES` to Info.plist (needed for http streams). |
| **Apple TV** | tvOS has no web view, so it needs a native SwiftUI app (AVPlayer). Until then, use AirPlay from iPhone/iPad/Mac. |
| **Samsung TV (Tizen)** | Copy `platforms/tizen/config.xml` into `dist/`, then package `dist/` in Tizen Studio (.wgt). |
| **LG TV (webOS)** | Copy `platforms/webos/appinfo.json` into `dist/` → `ares-package dist` (.ipk). |
| **Windows / macOS / Linux** | Install as a PWA from Chrome/Edge, or use `platforms/electron/main.cjs` with Electron (no proxy needed). |

## Store rules (important)

- App stores only accept a **player with no built-in content**. Never put channels, your panel URL or anything that says "IPTV subscription" in the app or its store listing.
- Use your own name, icons and screenshots. Don't use other players' names or logos.

## Get the APK automatically (phone, Android TV, Firestick)

Every upload to GitHub runs **Actions › Build Android APK**. When it finishes (about 5–8 min):
- Download it from the repo's **Releases › latest › IPTV-PLAYER.apk**, or
- On a Firestick, use the **Downloader** app with this link:
  `https://github.com/<your-username>/<repo>/releases/latest/download/IPTV-PLAYER.apk`
  (the repo must be **public** for this link to work)
