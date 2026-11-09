// Desktop app for Windows / macOS / Linux (built automatically by GitHub Actions with electron-builder)
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn, execSync } = require('child_process')

// "Pro player" for Dolby / DTS sound: open the stream in VLC if it is installed
function findVlc() {
  const c =
    process.platform === 'win32'
      ? [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'VideoLAN\\VLC\\vlc.exe'), path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'VideoLAN\\VLC\\vlc.exe')]
      : process.platform === 'darwin'
        ? ['/Applications/VLC.app/Contents/MacOS/VLC']
        : ['/usr/bin/vlc', '/snap/bin/vlc', '/usr/local/bin/vlc']
  for (const p of c) if (fs.existsSync(p)) return p
  try {
    return execSync(process.platform === 'win32' ? 'where vlc' : 'which vlc').toString().split(/\r?\n/)[0].trim() || null
  } catch {
    return null
  }
}
ipcMain.handle('has-vlc', () => !!findVlc())
// Real network MAC address of this computer → stable MAC Address / free trial per PC
ipcMain.handle('mac', () => {
  const nets = require('os').networkInterfaces()
  const all = Object.values(nets).flat().filter((n) => n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00')
  return (all.find((n) => n.family === 'IPv4') || all[0])?.mac?.toUpperCase() || ''
})
ipcMain.handle('open-vlc', (_e, url, title) => {
  const vlc = findVlc()
  if (!vlc) {
    shell.openExternal('https://www.videolan.org/vlc/')
    return false
  }
  spawn(vlc, ['--fullscreen', '--http-user-agent=IPTVSmartersPlayer', '--meta-title=' + (title || 'IPTV PLAYER'), url], { detached: true, stdio: 'ignore' }).unref()
  return true
})

// Built-in "Pro sound": ffmpeg (shipped with the app) turns Dolby AC3 / E-AC3 / DTS sound into AAC on the fly,
// so series and movies play with sound in the normal player — no VLC needed.
const http = require('http')
const UA = 'IPTVSmartersPlayer'
function findFfmpeg() {
  const n = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const c = [path.join(process.resourcesPath || '', 'bin', n), path.join(__dirname, 'bin', n)]
  for (const p of c) if (fs.existsSync(p)) return p
  try {
    return execSync(process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg').toString().split(/\r?\n/)[0].trim() || null
  } catch {
    return null
  }
}
const FF = findFfmpeg()
let txBase = null
const txReady = new Promise((resolve) => {
  if (!FF) return resolve(null)
  const srv = http.createServer((req, res) => {
    const q = new URL(req.url, 'http://x').searchParams
    const u = q.get('u')
    if (!u || !/^https?:\/\//i.test(u)) return res.writeHead(400), res.end()
    const ss = Math.max(0, Number(q.get('ss')) || 0)
    const vcopy = q.get('vc') !== '0'
    const args = ['-hide_banner', '-loglevel', 'error', '-user_agent', UA, '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5']
    if (ss > 0) args.push('-ss', String(ss))
    args.push('-fflags', '+genpts', '-i', u, '-map', '0:v:0?', '-map', '0:a:0?', '-sn', '-dn')
    args.push(...(vcopy ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p']))
    args.push('-c:a', 'aac', '-ac', '2', '-b:a', '192k', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', 'pipe:1')
    const p = spawn(FF, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
    p.stdout.pipe(res)
    p.on('error', () => res.end())
    const kill = () => {
      try {
        p.kill('SIGKILL')
      } catch {}
    }
    req.on('close', kill)
    res.on('close', kill)
  })
  srv.on('error', () => resolve(null))
  srv.listen(0, '127.0.0.1', () => resolve((txBase = 'http://127.0.0.1:' + srv.address().port)))
})
ipcMain.handle('tx-base', () => txReady)
ipcMain.handle('probe', (_e, url) =>
  new Promise((resolve) => {
    if (!FF || !/^https?:\/\//i.test(url || '')) return resolve({ ok: false })
    let err = ''
    const p = spawn(FF, ['-hide_banner', '-probesize', '2000000', '-analyzeduration', '2000000', '-user_agent', UA, '-i', url], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
    const t = setTimeout(() => p.kill('SIGKILL'), 9000)
    p.stderr.on('data', (d) => {
      err += d
      if (/Stream #\d+:\d+.*Audio:/.test(err) && /Stream #\d+:\d+.*Video:/.test(err) && /\n\s*(Stream mapping|At least one output)/.test(err)) p.kill('SIGKILL')
    })
    p.on('error', () => (clearTimeout(t), resolve({ ok: false })))
    p.on('close', () => {
      clearTimeout(t)
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      const a = err.match(/Stream #\d+:\d+[^\n]*Audio:\s*([a-z0-9_]+)/i)
      const v = err.match(/Stream #\d+:\d+[^\n]*Video:\s*([a-z0-9_]+)/i)
      const ok = /Input #0/.test(err)
      resolve({ ok, audio: a ? a[1].toLowerCase() : 'none', video: v ? v[1].toLowerCase() : 'none', duration: m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0 })
    })
  })
)

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function create() {
  const win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#0a0c2a',
    title: 'IPTV PLAYER',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../dist/icons/icon-512.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { webSecurity: false, backgroundThrottling: false, preload: path.join(__dirname, 'preload.cjs') }, // reach any IPTV server without a proxy
  })
  Menu.setApplicationMenu(null)
  // Some IPTV panels (e.g. TREX) only answer real IPTV players: send the same player name as the TV app
  // for every request from the app window (playlists, channel lists, live TV, movies, series).
  win.webContents.session.setUserAgent(UA)
  win.webContents.setUserAgent(UA)
  win.loadFile(path.join(__dirname, '../../dist/index.html'))
  // F11 / F = fullscreen, external links open in the normal browser
  win.webContents.on('before-input-event', (_, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen())
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ——— Recording: live TV / catch-up → Videos › IPTV PLAYER (ffmpeg copies the stream, no quality loss) ———
const recDir = () => {
  const d = path.join(app.getPath('videos'), 'IPTV PLAYER')
  fs.mkdirSync(d, { recursive: true })
  return d
}
const recs = new Map()
ipcMain.handle('rec-start', (_e, url, name, live) => {
  if (!/^https?:\/\//i.test(url || '')) throw new Error('bad url')
  const id = String(Date.now())
  const base = path.join(recDir(), String(name || 'Recording').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 90) || 'Recording')
  const r = { stop: false, proc: null, req: null, file: '' }
  recs.set(id, r)
  if (FF) {
    // MP4 that stays playable even if the app closes during the recording
    r.file = base + '.mp4'
    const args = ['-hide_banner', '-loglevel', 'error', '-user_agent', UA, '-headers', 'X-Recorder: 1\r\n', '-reconnect', '1', '-reconnect_streamed', '1']
    if (live) args.push('-reconnect_at_eof', '1')
    args.push('-reconnect_delay_max', '10', '-i', url, '-map', '0:v:0?', '-map', '0:a?', '-c', 'copy', '-strict', '-2')
    const run = (mkv) => {
      const t0 = Date.now()
      r.proc = spawn(FF, [...args, ...(mkv ? ['-f', 'matroska'] : ['-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof']), '-y', r.file], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true })
      r.proc.on('exit', (code) => {
        // a sound / picture format MP4 can't hold → record as MKV instead (plays in VLC)
        if (!mkv && !r.stop && code && Date.now() - t0 < 15000) {
          try { fs.unlinkSync(r.file) } catch {}
          r.file = base + '.mkv'
          return run(true)
        }
        recs.delete(id)
      })
    }
    run(false)
  } else {
    // no ffmpeg (Mac): save the stream as it comes (.ts — plays in VLC)
    r.file = base + '.ts'
    const out = fs.createWriteStream(r.file, { flags: 'a' })
    const get = (u, hops = 0) => {
      if (r.stop) return out.end()
      const lib = u.startsWith('https') ? require('https') : http
      r.req = lib.get(u, { headers: { 'User-Agent': UA, 'X-Recorder': '1' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 5) return res.resume(), get(new URL(res.headers.location, u).toString(), hops + 1)
        res.pipe(out, { end: false })
        res.on('end', () => (live && !r.stop ? setTimeout(() => get(url), 1000) : (out.end(), recs.delete(id))))
      })
      r.req.on('error', () => (live && !r.stop ? setTimeout(() => get(url), 3000) : (out.end(), recs.delete(id))))
    }
    get(url)
  }
  return { id, file: r.file }
})
const stopOne = (id) => {
  const r = recs.get(id)
  if (!r) return
  r.stop = true
  try {
    if (r.proc) {
      r.proc.stdin.write('q') // let ffmpeg finish the file cleanly
      setTimeout(() => r.proc && !r.proc.killed && r.proc.kill(), 4000)
    }
    if (r.req) r.req.destroy()
  } catch {}
  recs.delete(id)
}
ipcMain.handle('rec-stop', (_e, id) => stopOne(id))
ipcMain.handle('rec-list', () =>
  fs
    .readdirSync(recDir())
    .filter((n) => /\.(mp4|ts|mkv)$/i.test(n))
    .map((n) => {
      const f = path.join(recDir(), n)
      const st = fs.statSync(f)
      return { name: n.replace(/\.(mp4|ts|mkv)$/i, ''), file: f, size: st.size, date: st.mtimeMs }
    })
)
ipcMain.handle('rec-delete', (_e, file) => {
  const f = path.resolve(String(file || ''))
  if (f.startsWith(recDir() + path.sep)) fs.unlinkSync(f)
})
ipcMain.handle('rec-open', () => shell.openPath(recDir()))
app.on('before-quit', () => [...recs.keys()].forEach(stopOne))

app.whenReady().then(create)
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && create())
app.on('window-all-closed', () => app.quit())
