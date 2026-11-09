// Lets the app open a stream in VLC (plays Dolby AC3 / DTS sound that the built-in engine can't).
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('desktop', {
  openVlc: (url, title) => ipcRenderer.invoke('open-vlc', url, title),
  hasVlc: () => ipcRenderer.invoke('has-vlc'),
  mac: () => ipcRenderer.invoke('mac'),
  txBase: () => ipcRenderer.invoke('tx-base'),
  probe: (url) => ipcRenderer.invoke('probe', url),
  recStart: (url, name, live) => ipcRenderer.invoke('rec-start', url, name, live),
  recStop: (id) => ipcRenderer.invoke('rec-stop', id),
  recList: () => ipcRenderer.invoke('rec-list'),
  recDelete: (file) => ipcRenderer.invoke('rec-delete', file),
  recOpen: () => ipcRenderer.invoke('rec-open'),
})
