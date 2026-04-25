const { contextBridge, ipcRenderer } = require('electron');

try {
  const sendNdiAudioDebug = (message) => {
    try { ipcRenderer.send('ndi:audio-debug', { message }); } catch (_) { /* noop */ }
  };
  const isNdiCaptureWindow = Array.isArray(process?.argv)
    && process.argv.some((a) => typeof a === 'string' && a.indexOf('--lumina-ndi-capture=1') !== -1);
  if (typeof window !== 'undefined' && isNdiCaptureWindow) {
    try { console.log('[NDI-AUDIO] preload detected NDI capture window (argv flag)'); } catch (_) { /* noop */ }
    sendNdiAudioDebug('preload detected NDI capture window (argv flag)');
    const { installNdiAudioCapture } = require('./ndiAudioCapture.cjs');
    const boot = () => {
      installNdiAudioCapture({ ipcRenderer }).catch((err) => {
        sendNdiAudioDebug('install failed: ' + (err && err.message ? err.message : String(err)));
        try { console.log('[NDI-AUDIO] install failed: ' + (err && err.message ? err.message : String(err))); } catch (_) { /* noop */ }
      });
    };
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
} catch (err) {
  try { ipcRenderer.send('ndi:audio-debug', { message: 'preload capture setup skipped: ' + (err && err.message ? err.message : String(err)) }); } catch (_) { /* noop */ }
  try { console.log('[NDI-AUDIO] preload capture setup skipped: ' + (err && err.message ? err.message : String(err))); } catch (_) { /* noop */ }
}

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
  ndi: {
    start: (payload) => ipcRenderer.invoke('ndi:start', payload),
    stop: () => ipcRenderer.invoke('ndi:stop'),
    getStatus: () => ipcRenderer.invoke('ndi:get-status'),
    onState: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('ndi:state', listener);
      return () => ipcRenderer.removeListener('ndi:state', listener);
    },
    sendAudioFrame: (payload) => ipcRenderer.send('ndi:audio-frame', payload),
    sendAudioWarning: (payload) => ipcRenderer.send('ndi:audio-warning', payload),
    onAudioWarning: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('ndi:audio-warning', listener);
      return () => ipcRenderer.removeListener('ndi:audio-warning', listener);
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
  lyricClipboard: {
    arm: (url) => ipcRenderer.invoke('lyric-clipboard:arm', { url }),
    disarm: () => ipcRenderer.invoke('lyric-clipboard:disarm'),
    onCaptured: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('lyric-clipboard:captured', listener);
      return () => ipcRenderer.removeListener('lyric-clipboard:captured', listener);
    },
  },
  tools: {
    getSettings: () => ipcRenderer.invoke('tools:get-settings'),
    setSettings: (patch) => ipcRenderer.invoke('tools:set-settings', patch),
    onState: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('tools:state', listener);
      return () => ipcRenderer.removeListener('tools:state', listener);
    },
    setNdiMenuState: (payload) => ipcRenderer.send('tools:set-ndi-menu-state', payload),
    setAppMenuState: (payload) => ipcRenderer.send('tools:set-app-menu-state', payload),
    onCommand: (callback) => {
      const listener = (_event, cmd) => callback(cmd);
      ipcRenderer.on('tools:command', listener);
      return () => ipcRenderer.removeListener('tools:command', listener);
    },
  },
});
