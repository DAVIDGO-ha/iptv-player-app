// Desktop app (Windows / macOS / Linux). Usage:
//   npm i -D electron electron-builder && npm run build
//   npx electron platforms/electron/main.cjs
const { app, BrowserWindow } = require('electron')
const path = require('path')
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1400, height: 880, backgroundColor: '#000000', title: 'IPTV PLAYER', autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { webSecurity: false } // lets the player reach any IPTV server without a proxy
  })
  win.loadFile(path.join(__dirname, '../../dist/index.html'))
})
app.on('window-all-closed', () => app.quit())
