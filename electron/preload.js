const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    isElectron: true,
    // Add any specific native functions here if needed
});
