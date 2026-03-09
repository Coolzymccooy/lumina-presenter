const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  copyText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  updates: {
    getStatus: () => ipcRenderer.invoke('app-update:get-status'),
    checkNow: () => ipcRenderer.invoke('app-update:check-now'),
    installNow: () => ipcRenderer.invoke('app-update:install-now'),
    openReleases: () => ipcRenderer.invoke('app-update:open-releases'),
    onStatus: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('app-update:status', listener);
      return () => ipcRenderer.removeListener('app-update:status', listener);
    },
  },
});
