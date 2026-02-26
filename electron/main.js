import { app, BrowserWindow, screen, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  if (isProd) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => { mainWindow.show(); });
  mainWindow.on('closed', () => { app.quit(); });
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
