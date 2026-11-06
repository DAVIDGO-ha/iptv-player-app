// Lets the app open a stream in VLC (plays Dolby AC3 / DTS sound that the built-in engine can't).
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('desktop', {
  openVlc: (url, title) => ipcRenderer.invoke('open-vlc', url, title),
  hasVlc: () => ipcRenderer.invoke('has-vlc'),
  txBase: () => ipcRenderer.invoke('tx-base'),
  probe: (url) => ipcRenderer.invoke('probe', url),
})
