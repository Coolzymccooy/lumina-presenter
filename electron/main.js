import { app, BrowserWindow, screen, session, Menu, shell, ipcMain, clipboard, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_INDEX_PATH = path.join(__dirname, '../dist/index.html');
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';
const SHOULD_OPEN_DEVTOOLS = process.env.LUMINA_OPEN_DEVTOOLS === '1';
const RELEASES_URL = 'https://github.com/Coolzymccooy/lumina-presenter/releases';
const TRUSTED_DEV_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
const MEDIA_PERMISSIONS = new Set(['media', 'microphone', 'camera']);
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 4;

let mainWindowRef = null;
let autoUpdaterRef = null;
let updateCheckTimer = null;
let updaterInitialized = false;
let updatePromptActive = false;
let lastUpdateCheckWasManual = false;
let updateStatus = {
  state: 'idle',
  version: null,
  progress: 0,
  message: 'Idle',
  releaseName: null,
};
let outputWindowRef = null;
let stageWindowRef = null;
let displayTestTimers = new Map();
let displayTestWindows = new Map();
let machineServiceState = {
  controlDisplayId: null,
  audienceDisplayId: null,
  stageDisplayId: null,
  outputOpen: false,
  stageOpen: false,
};

// Content Security Policy â€” allows Firebase, Google APIs, and the Lumina API.
const CSP = [
  "default-src 'self' blob: data:",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: data: https:",
  "connect-src 'self' https: wss: ws:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
].join('; ');

function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    if (value.startsWith('file://')) return 'file://';
    return new URL(value).origin.toLowerCase();
  } catch {
    return '';
  }
}

function isTrustedRendererOrigin(value) {
  const origin = normalizeOrigin(value);
  if (!origin) return false;
  if (origin === 'file://') return true;
  return TRUSTED_DEV_ORIGINS.has(origin);
}

function installMediaPermissionHandlers() {
  const ses = session.defaultSession;
  if (!ses) return;

  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    if (!MEDIA_PERMISSIONS.has(String(permission))) return false;
    return isTrustedRendererOrigin(String(requestingOrigin || ''));
  });

  ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (!MEDIA_PERMISSIONS.has(String(permission))) {
      callback(false);
      return;
    }

    const requestingUrl = String(details?.requestingUrl || details?.embeddingOrigin || '');
    callback(isTrustedRendererOrigin(requestingUrl));
  });
}

function installClipboardHandlers() {
  ipcMain.handle('clipboard:write-text', (event, text) => {
    if (!isTrustedRendererOrigin(String(event?.senderFrame?.url || ''))) {
      return false;
    }
    const value = String(text || '');
    if (!value) return false;
    try {
      clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  });
}

function getDisplayLabel(display, index = 0) {
  const label = String(display?.label || '').trim();
  if (label) return label;
  return `Display ${index + 1}`;
}

function buildDisplayKey(display, index = 0) {
  const label = getDisplayLabel(display, index).toLowerCase().replace(/\s+/g, '-');
  const bounds = display?.bounds || { width: 0, height: 0 };
  const workArea = display?.workArea || bounds;
  const scale = Number.isFinite(display?.scaleFactor) ? display.scaleFactor : 1;
  return [
    String(display?.id ?? `idx-${index}`),
    label || `display-${index + 1}`,
    `${bounds.width}x${bounds.height}`,
    `${workArea.width}x${workArea.height}`,
    scale.toFixed(2),
    display?.internal ? 'internal' : 'external',
  ].join('|');
}

function toDisplayDescriptor(display, index = 0) {
  const bounds = display?.bounds || { x: 0, y: 0, width: 0, height: 0 };
  const workArea = display?.workArea || bounds;
  return {
    id: Number(display?.id || 0),
    key: buildDisplayKey(display, index),
    name: getDisplayLabel(display, index),
    isPrimary: !!display?.primary,
    isInternal: !!display?.internal,
    scaleFactor: Number.isFinite(display?.scaleFactor) ? display.scaleFactor : 1,
    rotation: Number.isFinite(display?.rotation) ? display.rotation : 0,
    bounds: {
      x: bounds.x || 0,
      y: bounds.y || 0,
      width: bounds.width || 0,
      height: bounds.height || 0,
    },
    workArea: {
      x: workArea.x || 0,
      y: workArea.y || 0,
      width: workArea.width || 0,
      height: workArea.height || 0,
    },
  };
}

function listDisplayDescriptors() {
  return screen.getAllDisplays().map((display, index) => toDisplayDescriptor(display, index));
}

function emitMachineServiceState() {
  machineServiceState = {
    ...machineServiceState,
    outputOpen: !!(outputWindowRef && !outputWindowRef.isDestroyed()),
    stageOpen: !!(stageWindowRef && !stageWindowRef.isDestroyed()),
  };
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
  mainWindowRef.webContents.send('machine:service-state', machineServiceState);
}

function emitMachineDisplaysChanged() {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
  mainWindowRef.webContents.send('machine:displays-changed', listDisplayDescriptors());
}

function findDisplayById(displayId) {
  const numericId = Number(displayId);
  if (!Number.isFinite(numericId)) return null;
  return screen.getAllDisplays().find((entry) => Number(entry.id) === numericId) || null;
}

async function loadRendererRoute(targetWindow, route, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const hash = `/${route}${params.toString() ? `?${params.toString()}` : ''}`;
  if (!app.isPackaged) {
    await targetWindow.loadURL(`${DEV_SERVER_URL.replace(/\/$/, '')}/#${hash}`);
    return;
  }
  await targetWindow.loadFile(DIST_INDEX_PATH, { hash });
}

function attachManagedWindowLifecycle(kind, targetWindow) {
  targetWindow.on('closed', () => {
    if (kind === 'audience') {
      outputWindowRef = null;
      machineServiceState = {
        ...machineServiceState,
        outputOpen: false,
      };
    } else {
      stageWindowRef = null;
      machineServiceState = {
        ...machineServiceState,
        stageOpen: false,
      };
    }
    emitMachineServiceState();
  });
}

async function createManagedRoleWindow(kind, displayId, payload = {}) {
  const targetDisplay = findDisplayById(displayId) || screen.getPrimaryDisplay();
  const bounds = targetDisplay?.bounds || targetDisplay?.workArea || { x: 0, y: 0, width: 1280, height: 720 };
  const isAudience = kind === 'audience';
  let targetWindow = isAudience ? outputWindowRef : stageWindowRef;

  if (!targetWindow || targetWindow.isDestroyed()) {
    targetWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      show: false,
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      fullscreenable: true,
      frame: false,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
      title: isAudience ? 'Lumina Output (Projector)' : 'Lumina Stage Display',
    });
    attachManagedWindowLifecycle(kind, targetWindow);
    if (isAudience) {
      outputWindowRef = targetWindow;
    } else {
      stageWindowRef = targetWindow;
    }
  }

  try {
    if (targetWindow.isFullScreen()) {
      targetWindow.setFullScreen(false);
    }
  } catch {
    // ignore
  }

  targetWindow.setBounds(bounds);
  targetWindow.setMenuBarVisibility(false);
  await loadRendererRoute(targetWindow, isAudience ? 'output' : 'stage', {
    session: payload.sessionId || 'live',
    workspace: payload.workspaceId || 'default-workspace',
    fullscreen: isAudience ? '1' : undefined,
  });
  if (isAudience) {
    targetWindow.webContents.insertCSS('html,body,*{cursor:none !important;}').catch(() => {});
  }
  try {
    if (!targetWindow.isVisible()) {
      targetWindow.show();
    }
    targetWindow.setFullScreen(true);
    targetWindow.focus();
  } catch {
    // ignore
  }

  machineServiceState = {
    ...machineServiceState,
    audienceDisplayId: isAudience ? Number(targetDisplay.id) : machineServiceState.audienceDisplayId,
    stageDisplayId: !isAudience ? Number(targetDisplay.id) : machineServiceState.stageDisplayId,
    outputOpen: isAudience ? true : machineServiceState.outputOpen,
    stageOpen: !isAudience ? true : machineServiceState.stageOpen,
  };
  emitMachineServiceState();
  return machineServiceState;
}

function closeManagedRoleWindow(kind) {
  const targetWindow = kind === 'audience' ? outputWindowRef : stageWindowRef;
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.close();
  }
  if (kind === 'audience') {
    outputWindowRef = null;
    machineServiceState = {
      ...machineServiceState,
      outputOpen: false,
    };
  } else {
    stageWindowRef = null;
    machineServiceState = {
      ...machineServiceState,
      stageOpen: false,
    };
  }
  emitMachineServiceState();
  return machineServiceState;
}

function moveMainWindowToDisplay(displayId) {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return false;
  const targetDisplay = findDisplayById(displayId);
  if (!targetDisplay) return false;
  const workArea = targetDisplay.workArea || targetDisplay.bounds;
  try {
    if (mainWindowRef.isFullScreen()) {
      mainWindowRef.setFullScreen(false);
    }
    mainWindowRef.unmaximize();
  } catch {
    // ignore
  }
  mainWindowRef.setBounds(workArea);
  mainWindowRef.show();
  mainWindowRef.focus();
  try {
    mainWindowRef.maximize();
  } catch {
    // ignore
  }
  machineServiceState = {
    ...machineServiceState,
    controlDisplayId: Number(targetDisplay.id),
  };
  emitMachineServiceState();
  return true;
}

function closeDisplayTest(displayId) {
  const numericId = Number(displayId);
  const testWindow = displayTestWindows.get(numericId);
  if (testWindow && !testWindow.isDestroyed()) {
    testWindow.close();
  }
  const timer = displayTestTimers.get(numericId);
  if (timer) {
    clearTimeout(timer);
  }
  displayTestTimers.delete(numericId);
  displayTestWindows.delete(numericId);
}

async function showDisplayTest(displayId) {
  const targetDisplay = findDisplayById(displayId);
  if (!targetDisplay) return false;
  closeDisplayTest(displayId);
  const descriptor = toDisplayDescriptor(targetDisplay, 0);
  const testWindow = new BrowserWindow({
    x: descriptor.bounds.x,
    y: descriptor.bounds.y,
    width: descriptor.bounds.width,
    height: descriptor.bounds.height,
    show: false,
    frame: false,
    transparent: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreen: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
    },
  });
  testWindow.setMenuBarVisibility(false);
  testWindow.setIgnoreMouseEvents(true);
  await testWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;background:linear-gradient(135deg,#0f172a,#155e75);color:white;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div style="text-align:center;padding:24px 32px;border:1px solid rgba(255,255,255,0.18);border-radius:24px;background:rgba(0,0,0,0.28);box-shadow:0 20px 50px rgba(0,0,0,0.35)"><div style="font-size:16px;letter-spacing:0.38em;text-transform:uppercase;opacity:0.72;margin-bottom:14px">Lumina Test</div><div style="font-size:72px;font-weight:900;line-height:1">${descriptor.id}</div><div style="font-size:24px;font-weight:700;margin-top:10px">${descriptor.name}</div><div style="font-size:14px;opacity:0.78;margin-top:10px">${descriptor.bounds.width}x${descriptor.bounds.height}${descriptor.isPrimary ? ' · Primary' : ''}</div></div></body></html>`)}`);
  testWindow.showInactive();
  displayTestWindows.set(Number(displayId), testWindow);
  const timer = setTimeout(() => {
    closeDisplayTest(displayId);
  }, 1600);
  displayTestTimers.set(Number(displayId), timer);
  testWindow.on('closed', () => {
    closeDisplayTest(displayId);
  });
  return true;
}

function installMachineIpcHandlers() {
  ipcMain.handle('machine:list-displays', () => listDisplayDescriptors());
  ipcMain.handle('machine:test-display', async (_event, displayId) => showDisplayTest(displayId));
  ipcMain.handle('machine:identify-all-displays', async () => {
    const displays = screen.getAllDisplays();
    await Promise.all(displays.map((entry) => showDisplayTest(entry.id)));
    return true;
  });
  ipcMain.handle('machine:get-service-state', () => {
    emitMachineServiceState();
    return machineServiceState;
  });
  ipcMain.handle('machine:close-role-window', (_event, role) => {
    if (role !== 'audience' && role !== 'stage') return machineServiceState;
    return closeManagedRoleWindow(role);
  });
  ipcMain.handle('machine:open-role-window', async (_event, payload) => {
    const role = payload?.role === 'stage' ? 'stage' : 'audience';
    const displayId = Number(payload?.displayId || 0);
    if (!Number.isFinite(displayId) || displayId <= 0) {
      return { ok: false, error: 'DISPLAY_REQUIRED', state: machineServiceState };
    }
    const state = await createManagedRoleWindow(role, displayId, payload);
    return { ok: true, state };
  });
  ipcMain.handle('machine:start-service', async (_event, payload) => {
    const controlDisplayId = Number(payload?.controlDisplayId || 0) || null;
    const audienceDisplayId = Number(payload?.audienceDisplayId || 0) || null;
    const stageDisplayId = Number(payload?.stageDisplayId || 0) || null;

    if (controlDisplayId) {
      moveMainWindowToDisplay(controlDisplayId);
    }

    if (audienceDisplayId) {
      await createManagedRoleWindow('audience', audienceDisplayId, payload);
    } else {
      closeManagedRoleWindow('audience');
    }

    if (stageDisplayId) {
      await createManagedRoleWindow('stage', stageDisplayId, payload);
    } else {
      closeManagedRoleWindow('stage');
    }

    machineServiceState = {
      ...machineServiceState,
      controlDisplayId,
      audienceDisplayId,
      stageDisplayId,
    };
    emitMachineServiceState();
    return {
      ok: true,
      state: machineServiceState,
    };
  });
}

function setUpdateStatus(next) {
  updateStatus = {
    ...updateStatus,
    ...next,
  };
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
  mainWindowRef.webContents.send('app-update:status', updateStatus);
}

async function promptForDownloadedUpdate(info) {
  if (!mainWindowRef || mainWindowRef.isDestroyed() || !autoUpdaterRef || updatePromptActive) return;
  updatePromptActive = true;
  try {
    const detailParts = [];
    if (info?.version) detailParts.push(`Version ${info.version} is ready.`);
    detailParts.push('Restart Lumina Presenter to install the update now, or do it later.');
    const result = await dialog.showMessageBox(mainWindowRef, {
      type: 'info',
      buttons: ['Restart and Install', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'Update Ready',
      message: 'A new Lumina update has been downloaded.',
      detail: detailParts.join(' '),
    });
    if (result.response === 0) {
      autoUpdaterRef.quitAndInstall(false, true);
    }
  } catch (error) {
    console.warn('Failed to show update prompt:', error?.message || error);
  } finally {
    updatePromptActive = false;
  }
}

function scheduleUpdateChecks() {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
  }
  updateCheckTimer = setInterval(() => {
    void checkForUpdatesSafely();
  }, UPDATE_CHECK_INTERVAL_MS);
}

function installUpdaterIpcHandlers() {
  ipcMain.handle('app-update:get-status', () => updateStatus);
  ipcMain.handle('app-update:check-now', async () => {
    await checkForUpdatesSafely(true);
    return updateStatus;
  });
  ipcMain.handle('app-update:install-now', async () => {
    if (!autoUpdaterRef) return false;
    autoUpdaterRef.quitAndInstall(false, true);
    return true;
  });
  ipcMain.handle('app-update:open-releases', async () => {
    await shell.openExternal(RELEASES_URL);
    return true;
  });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  // app.isPackaged = true when running from the installed/portable build.
  // This replaces 'electron-is-dev' (a devDependency not bundled in the installer).
  const isProd = app.isPackaged;

  const mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    title: 'Lumina Presenter',
    backgroundColor: '#000000',
    show: false,
  });
  mainWindowRef = mainWindow;

  // Desktop UX: pressing Esc restores a maximized/fullscreen window back to normal.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'Escape') return;

    if (mainWindow.isFullScreen()) {
      event.preventDefault();
      mainWindow.setFullScreen(false);
      return;
    }

    if (mainWindow.isMaximized()) {
      event.preventDefault();
      mainWindow.unmaximize();
    }
  });

  // Apply CSP in production only â€” Vite dev server needs unsafe-inline for HMR.
  if (isProd) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP],
        },
      });
    });
  }

  void loadMainContent(mainWindow, isProd).catch((error) => {
    console.error('Failed to load renderer entry:', error);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Check for updates on launch
    if (isProd) {
      void checkForUpdatesSafely();
      scheduleUpdateChecks();
    }
  });
  mainWindow.on('closed', () => {
    mainWindowRef = null;
    app.quit();
  });
}

function installApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const isProd = app.isPackaged;
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { role: 'close' },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'togglefullscreen' },
        ...(isProd ? [] : [{ type: 'separator' }, { role: 'toggleDevTools' }]),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Lumina Releases',
          click: () => {
            void shell.openExternal(RELEASES_URL);
          },
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function loadMainContent(mainWindow, isProd) {
  if (!isProd) {
    try {
      await mainWindow.loadURL(DEV_SERVER_URL);
      if (SHOULD_OPEN_DEVTOOLS) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
      return;
    } catch (error) {
      console.warn('Dev server unavailable, falling back to dist build:', error);
    }
  }

  if (!fs.existsSync(DIST_INDEX_PATH)) {
    throw new Error(`Renderer build not found at ${DIST_INDEX_PATH}`);
  }
  await mainWindow.loadFile(DIST_INDEX_PATH, {
    hash: `?api=${encodeURIComponent('https://api.luminalive.co.uk')}`,
  });
}

function ensureAutoUpdaterInitialized() {
  if (updaterInitialized || !app.isPackaged) return;
  updaterInitialized = true;
}

// Best-effort update check. Works only in packaged builds with publish config.
async function checkForUpdatesSafely(isManual = false) {
  if (!app.isPackaged) return;
  lastUpdateCheckWasManual = isManual;
  try {
    const updaterMod = await import('electron-updater');
    const autoUpdater = updaterMod.autoUpdater ?? updaterMod.default?.autoUpdater ?? updaterMod.default;
    if (!autoUpdater || typeof autoUpdater.checkForUpdates !== 'function') {
      throw new Error('electron-updater did not export a valid autoUpdater instance');
    }
    autoUpdaterRef = autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    if (!updaterInitialized) {
      autoUpdater.on('checking-for-update', () => {
        setUpdateStatus({
          state: 'checking',
          message: 'Checking for updates...',
          progress: 0,
        });
      });
      autoUpdater.on('update-available', (info) => {
        setUpdateStatus({
          state: 'available',
          version: info?.version || null,
          releaseName: info?.releaseName || null,
          message: info?.version ? `Downloading ${info.version}...` : 'Downloading update...',
          progress: 0,
        });
      });
      autoUpdater.on('download-progress', (progress) => {
        const percent = Number.isFinite(progress?.percent) ? Math.max(0, Math.min(100, Math.round(progress.percent))) : 0;
        setUpdateStatus({
          state: 'downloading',
          progress: percent,
          message: `Downloading update... ${percent}%`,
        });
      });
      autoUpdater.on('update-not-available', () => {
        setUpdateStatus({
          state: 'not-available',
          progress: 0,
          message: lastUpdateCheckWasManual ? 'You already have the latest version.' : 'App is up to date.',
        });
      });
      autoUpdater.on('update-downloaded', (info) => {
        setUpdateStatus({
          state: 'downloaded',
          version: info?.version || null,
          releaseName: info?.releaseName || null,
          progress: 100,
          message: info?.version ? `Version ${info.version} is ready to install.` : 'Update downloaded and ready to install.',
        });
        void promptForDownloadedUpdate(info);
      });
      autoUpdater.on('error', (err) => {
        const message = err?.message || String(err || 'unknown error');
        console.warn('autoUpdater error:', message);
        setUpdateStatus({
          state: 'error',
          message: `Update check failed: ${message}`,
        });
      });
      ensureAutoUpdaterInitialized();
    }
    await autoUpdater.checkForUpdates();
  } catch (err) {
    const message = err?.message || String(err || 'unknown error');
    console.warn('Auto-update not available:', message);
    setUpdateStatus({
      state: 'error',
      message: `Auto-update unavailable: ${message}`,
    });
  }
}

app.whenReady().then(() => {
  installApplicationMenu();
  installMediaPermissionHandlers();
  installClipboardHandlers();
  installUpdaterIpcHandlers();
  installMachineIpcHandlers();
  createWindow();
  screen.on('display-added', () => emitMachineDisplaysChanged());
  screen.on('display-removed', () => emitMachineDisplaysChanged());
  screen.on('display-metrics-changed', () => emitMachineDisplaysChanged());
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
});
