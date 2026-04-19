const { ipcMain, clipboard, shell, BrowserWindow } = require('electron');
const { createClipboardLyricWatcher } = require('../clipboardLyricWatcher.cjs');

const CHANNEL_ARM = 'lyric-clipboard:arm';
const CHANNEL_DISARM = 'lyric-clipboard:disarm';
const CHANNEL_CAPTURED = 'lyric-clipboard:captured';

let watcher = null;

function broadcastCaptured(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(CHANNEL_CAPTURED, payload);
  }
}

function registerLyricClipboardIpc({ isTrustedRendererOrigin } = {}) {
  if (watcher) return; // idempotent
  if (typeof isTrustedRendererOrigin !== 'function') {
    throw new Error('registerLyricClipboardIpc requires isTrustedRendererOrigin');
  }
  watcher = createClipboardLyricWatcher({
    clipboard,
    onCaptured: broadcastCaptured,
  });

  ipcMain.handle(CHANNEL_ARM, async (event, payload) => {
    if (!isTrustedRendererOrigin(String(event?.senderFrame?.url || ''))) {
      return { ok: false, error: 'UNTRUSTED_ORIGIN' };
    }
    const url = String(payload?.url || '');
    if (!url) return { ok: false, error: 'URL_REQUIRED' };
    watcher.arm(url);
    try { await shell.openExternal(url); } catch (err) {
      return { ok: false, error: 'OPEN_EXTERNAL_FAILED', message: String(err?.message || err) };
    }
    return { ok: true };
  });

  ipcMain.handle(CHANNEL_DISARM, async (event) => {
    if (!isTrustedRendererOrigin(String(event?.senderFrame?.url || ''))) {
      return { ok: false, error: 'UNTRUSTED_ORIGIN' };
    }
    watcher.disarm();
    return { ok: true };
  });
}

function disposeLyricClipboardIpc() {
  if (!watcher) return;
  watcher.dispose();
  watcher = null;
  ipcMain.removeHandler(CHANNEL_ARM);
  ipcMain.removeHandler(CHANNEL_DISARM);
}

module.exports = { registerLyricClipboardIpc, disposeLyricClipboardIpc };
