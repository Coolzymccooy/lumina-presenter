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
  await mainWindow.loadFile(DIST_INDEX_PATH);
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
    const { autoUpdater } = await import('electron-updater');
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
  createWindow();
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
