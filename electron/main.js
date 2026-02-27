import { app, BrowserWindow, screen, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_INDEX_PATH = path.join(__dirname, '../dist/index.html');
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';
const SHOULD_OPEN_DEVTOOLS = process.env.LUMINA_OPEN_DEVTOOLS === '1';

// Content Security Policy — allows Firebase, Google APIs, and the Lumina API.
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

  // Apply CSP in production only — Vite dev server needs unsafe-inline for HMR.
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
    }
  });
  mainWindow.on('closed', () => { app.quit(); });
}

async function loadMainContent(mainWindow, isProd) {
  if (!isProd) {
    try {
      await mainWindow.loadURL(DEV_SERVER_URL);
      if (SHOULD_OPEN_DEVTOOLS) {
        mainWindow.webContents.openDevTools();
      }
      return;
    } catch (error) {
      console.warn(`Dev URL failed (${DEV_SERVER_URL}); falling back to packaged dist.`, error);
    }
  }

  if (fs.existsSync(DIST_INDEX_PATH)) {
    await mainWindow.loadFile(DIST_INDEX_PATH);
    return;
  }

  throw new Error(`Renderer entry not found: ${DIST_INDEX_PATH}`);
}

async function checkForUpdatesSafely() {
  try {
    // `electron-updater` is CommonJS. In ESM mode, resolve from either shape.
    const updaterModule = await import('electron-updater');
    const updater =
      updaterModule.autoUpdater ??
      updaterModule.default?.autoUpdater ??
      updaterModule.default;

    if (updater?.checkForUpdatesAndNotify) {
      await updater.checkForUpdatesAndNotify();
    } else {
      console.warn('Auto-update is unavailable: invalid electron-updater export shape.');
    }
  } catch (error) {
    console.error('Auto-update initialization failed:', error);
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
