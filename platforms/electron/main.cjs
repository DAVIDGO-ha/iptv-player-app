// Desktop app for Windows / macOS / Linux (built automatically by GitHub Actions with electron-builder)
const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('path')

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
    webPreferences: { webSecurity: false, backgroundThrottling: false }, // reach any IPTV server without a proxy
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
