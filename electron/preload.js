const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  copyText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
});
