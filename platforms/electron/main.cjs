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
ipcMain.handle('open-vlc', (_e, url, title) => {
  const vlc = findVlc()
  if (!vlc) {
    shell.openExternal('https://www.videolan.org/vlc/')
    return false
  }
  spawn(vlc, ['--fullscreen', '--http-user-agent=IPTVSmartersPlayer', '--meta-title=' + (title || 'IPTV PLAYER'), url], { detached: true, stdio: 'ignore' }).unref()
  return true
})

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

app.whenReady().then(create)
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && create())
app.on('window-all-closed', () => app.quit())
