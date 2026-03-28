const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  copyText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  machine: {
    listDisplays: () => ipcRenderer.invoke('machine:list-displays'),
    testDisplay: (displayId) => ipcRenderer.invoke('machine:test-display', displayId),
    identifyAllDisplays: () => ipcRenderer.invoke('machine:identify-all-displays'),
    startService: (payload) => ipcRenderer.invoke('machine:start-service', payload),
    openRoleWindow: (payload) => ipcRenderer.invoke('machine:open-role-window', payload),
    closeRoleWindow: (role) => ipcRenderer.invoke('machine:close-role-window', role),
    getServiceState: () => ipcRenderer.invoke('machine:get-service-state'),
    onDisplaysChanged: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('machine:displays-changed', listener);
      return () => ipcRenderer.removeListener('machine:displays-changed', listener);
    },
    onServiceState: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('machine:service-state', listener);
      return () => ipcRenderer.removeListener('machine:service-state', listener);
    },
  },
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
