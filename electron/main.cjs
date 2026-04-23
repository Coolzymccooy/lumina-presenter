const { app, BrowserWindow, screen, session, Menu, shell, ipcMain, clipboard, dialog, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');
const ndiSender = require('./ndiSender.cjs');
const { NDI_RESOLUTION_PRESETS, resolveNdiResolution } = require('./ndiResolution.cjs');
const { buildCaptureScript: buildNdiAudioCaptureScript } = require('./ndiAudioCapture.cjs');
const { registerLyricClipboardIpc } = require('./ipc/lyricClipboard.cjs');
const DIST_INDEX_PATH = path.join(__dirname, '../dist/index.html');
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';
const SHOULD_OPEN_DEVTOOLS = process.env.LUMINA_OPEN_DEVTOOLS === '1';
const RELEASES_URL = 'https://github.com/Coolzymccooy/lumina-presenter/releases';
const TRUSTED_DEV_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
const MEDIA_PERMISSIONS = new Set(['media', 'microphone', 'camera', 'speech']);
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

// ─── NDI outbound sender state (Phase 2: multi-source) ──────────────────────
// Fixed scene list — all three are broadcast simultaneously when NDI is active.
// Downstream switchers bind to these source names; do not rename casually.
//
// Resolution precedence (highest first):
//   1. Per-scene `width`/`height` on NDI_SCENES (power-user scene tuning)
//   2. Payload `resolution` from renderer (workspace setting: 720p/1080p/4k)
//   3. Env vars LUMINA_NDI_WIDTH / LUMINA_NDI_HEIGHT (host override)
//   4. Hardcoded 1920x1080 fallback
const NDI_DEFAULT_WIDTH = Number.parseInt(process.env.LUMINA_NDI_WIDTH || '', 10) || 1920;
const NDI_DEFAULT_HEIGHT = Number.parseInt(process.env.LUMINA_NDI_HEIGHT || '', 10) || 1080;
const NDI_SCENES = [
  { id: 'program',     sourceName: 'Lumina-Program',     fillKey: false, route: 'output' },
  { id: 'lyrics',      sourceName: 'Lumina-Lyrics',      fillKey: true,  route: 'lyrics-ndi' },
  { id: 'lowerThirds', sourceName: 'Lumina-LowerThirds', fillKey: true,  route: 'lower-thirds-ndi' },
];
/** @type {Record<string, { window: any, sender: any, active: boolean, lastError?: string, droppedFrames: number }>} */
const ndiSources = {};
let ndiActive = false;
let ndiBroadcastMode = false;
let ndiAudioEnabled = false;
let ndiResolution = '1080p';
let ndiSessionWidth = NDI_DEFAULT_WIDTH;
let ndiSessionHeight = NDI_DEFAULT_HEIGHT;
let ndiAudioDroppedFrames = 0;
let ndiAudioFramesSent = 0;            // total successful sendAudioFrame calls this session
let ndiAudioFramesLastSample = 0;       // frames sent at the last telemetry tick
let ndiAudioFramesPerSecond = 0;        // derived rate for renderer display
let ndiAudioStatsTimer = null;
const NDI_AUDIO_STATS_INTERVAL_MS = 2000;
let ndiStatus = { active: false, broadcastMode: false, resolution: '1080p', width: NDI_DEFAULT_WIDTH, height: NDI_DEFAULT_HEIGHT, audioEnabled: false, audio: null, sources: [] };
let ndiDropLogTimer = null;
const NDI_TARGET_FPS = 30;
// ─────────────────────────────────────────────────────────────────────────────

let machineServiceState = {
  controlDisplayId: null,
  audienceDisplayId: null,
  stageDisplayId: null,
  outputOpen: false,
  stageOpen: false,
};

// ─── Local API server (packaged mode only) ───────────────────────────────────
let apiServerProcess = null;

/**
 * Read a simple KEY=VALUE config file from the user's data directory
 * (userData/lumina.env).  This lets non-dev users supply GOOGLE_AI_API_KEY
 * without needing system-level environment variables.
 */
function readUserEnvConfig(userData) {
  const configPath = path.join(userData, 'lumina.env');
  const vars = {};
  try {
    if (!fs.existsSync(configPath)) return vars;
    const lines = fs.readFileSync(configPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key) vars[key] = val;
    }
  } catch { /* best effort */ }
  return vars;
}

function startApiServer() {
  if (!app.isPackaged) return; // dev mode: server is started by npm run server separately
  const serverPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'index.js');
  if (!fs.existsSync(serverPath)) {
    console.warn('[lumina-server] server/index.js not found at:', serverPath);
    return;
  }
  const userData = app.getPath('userData');
  const userConfig = readUserEnvConfig(userData);
  const serverEnv = {
    ...process.env,
    ...userConfig,
    PORT: '8787',
    LUMINA_API_PORT: '8787',
    LUMINA_DATA_DIR: userData,
  };
  try {
    apiServerProcess = utilityProcess.fork(serverPath, [], {
      serviceName: 'lumina-api-server',
      stdio: 'pipe',
      env: serverEnv,
    });
    apiServerProcess.on('exit', (code) => {
      console.warn('[lumina-server] API server exited with code:', code);
      apiServerProcess = null;
    });
  } catch (err) {
    console.warn('[lumina-server] Failed to start API server:', err?.message || err);
  }
}

function stopApiServer() {
  if (!apiServerProcess) return;
  try { apiServerProcess.kill(); } catch { /* best effort */ }
  apiServerProcess = null;
}
// ─────────────────────────────────────────────────────────────────────────────

// Content Security Policy — allows Firebase, Google APIs, and the Lumina API.
// http://localhost:8787 and http://127.0.0.1:8787 are needed for the local
// Express API server that is spawned as a child process in packaged builds.
const CSP = [
  "default-src 'self' blob: data:",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: data: https:",
  "connect-src 'self' https: http://localhost:8787 http://127.0.0.1:8787 wss: ws:",
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
module.exports.isTrustedRendererOrigin = isTrustedRendererOrigin;

function resolveTrustedMediaPermissionContext(webContents, requestingOrigin, details) {
  const webContentsUrl = typeof webContents?.getURL === 'function'
    ? String(webContents.getURL() || '')
    : '';
  const candidates = [
    ['requestingOrigin', String(requestingOrigin || '')],
    ['securityOrigin', String(details?.securityOrigin || '')],
    ['requestingUrl', String(details?.requestingUrl || '')],
    ['embeddingOrigin', String(details?.embeddingOrigin || '')],
    ['webContentsUrl', webContentsUrl],
  ];
  const trustedCandidate = candidates.find(([, value]) => isTrustedRendererOrigin(value));

  return {
    allowed: Boolean(trustedCandidate),
    trustedSource: trustedCandidate?.[0] || '',
    trustedValue: trustedCandidate?.[1] || '',
    candidates: {
      requestingOrigin: String(requestingOrigin || ''),
      securityOrigin: String(details?.securityOrigin || ''),
      requestingUrl: String(details?.requestingUrl || ''),
      embeddingOrigin: String(details?.embeddingOrigin || ''),
      webContentsUrl,
      isMainFrame: Boolean(details?.isMainFrame),
      mediaType: String(details?.mediaType || ''),
    },
  };
}

function installMediaPermissionHandlers() {
  const ses = session.defaultSession;
  if (!ses) return;
  const shouldLog = !app.isPackaged || SHOULD_OPEN_DEVTOOLS;

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const normalizedPermission = String(permission);
    if (!MEDIA_PERMISSIONS.has(normalizedPermission)) return false;
    const resolution = resolveTrustedMediaPermissionContext(webContents, requestingOrigin, details);
    if (shouldLog) {
      console.info('[media-permission] check', {
        permission: normalizedPermission,
        allowed: resolution.allowed,
        trustedSource: resolution.trustedSource,
        trustedValue: resolution.trustedValue,
        ...resolution.candidates,
      });
    }
    return resolution.allowed;
  });

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const normalizedPermission = String(permission);
    if (!MEDIA_PERMISSIONS.has(normalizedPermission)) {
      callback(false);
      return;
    }

    const resolution = resolveTrustedMediaPermissionContext(webContents, '', details);
    if (shouldLog) {
      console.info('[media-permission] request', {
        permission: normalizedPermission,
        allowed: resolution.allowed,
        trustedSource: resolution.trustedSource,
        trustedValue: resolution.trustedValue,
        ...resolution.candidates,
      });
    }
    callback(resolution.allowed);
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
  registerLyricClipboardIpc({ isTrustedRendererOrigin });
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

function emitNdiState() {
  // In non-broadcast mode, hide fill+key sources from the renderer's status —
  // they're intentionally not started, so listing them as OFF would mislead.
  const visibleScenes = ndiBroadcastMode ? NDI_SCENES : NDI_SCENES.filter((s) => !s.fillKey);
  const sources = visibleScenes.map((scene) => {
    const entry = ndiSources[scene.id];
    return {
      id: scene.id,
      sourceName: scene.sourceName,
      fillKey: scene.fillKey,
      active: !!entry?.active,
      lastError: entry?.lastError,
    };
  });
  ndiStatus = {
    active: ndiActive,
    broadcastMode: ndiBroadcastMode,
    resolution: ndiResolution,
    width: ndiSessionWidth,
    height: ndiSessionHeight,
    audioEnabled: ndiAudioEnabled,
    // Null when audio is disabled; otherwise rolling stats so the renderer
    // can show a "flowing / silent" indicator.
    audio: ndiAudioEnabled ? {
      framesSent: ndiAudioFramesSent,
      framesPerSecond: ndiAudioFramesPerSecond,
      droppedFrames: ndiAudioDroppedFrames,
    } : null,
    sources,
  };
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
  mainWindowRef.webContents.send('ndi:state', ndiStatus);
}

/** Tear down every NDI capture window + sender. Safe to call repeatedly. */
async function teardownAllNdiSources() {
  const ids = Object.keys(ndiSources);
  await Promise.all(ids.map(async (id) => {
    const entry = ndiSources[id];
    if (!entry) return;
    // Clear active flag first so the capture window's `closed` handler skips
    // re-invoking sender.stop() — otherwise each teardown logs twice.
    entry.active = false;
    try {
      if (entry.window && !entry.window.isDestroyed()) entry.window.destroy();
    } catch (_) { /* ignore */ }
    try {
      if (entry.sender) await entry.sender.stop();
    } catch (_) { /* ignore */ }
    delete ndiSources[id];
  }));
}

/**
 * Spawn one NDI scene: offscreen window + sender + paint pump.
 * On success, populates ndiSources[scene.id]. On failure, returns { ok:false, error }.
 */
async function startNdiScene(scene, payload) {
  const transparent = !!scene.fillKey;
  // Per-scene override beats the session-wide resolution, which beats the env fallback.
  const sessionWidth = Number.isFinite(payload?.sessionWidth) && payload.sessionWidth > 0 ? payload.sessionWidth : NDI_DEFAULT_WIDTH;
  const sessionHeight = Number.isFinite(payload?.sessionHeight) && payload.sessionHeight > 0 ? payload.sessionHeight : NDI_DEFAULT_HEIGHT;
  const sceneWidth = Number.isFinite(scene.width) && scene.width > 0 ? scene.width : sessionWidth;
  const sceneHeight = Number.isFinite(scene.height) && scene.height > 0 ? scene.height : sessionHeight;
  const captureWindow = new BrowserWindow({
    width: sceneWidth,
    height: sceneHeight,
    show: false,
    frame: false,
    useContentSize: true,
    transparent,
    backgroundColor: transparent ? '#00000000' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      offscreen: true,
      backgroundThrottling: false,
    },
  });

  await loadRendererRoute(captureWindow, scene.route, {
    session: payload?.sessionId || 'live',
    workspace: payload?.workspaceId || 'default-workspace',
    ndi: '1',
    fillKey: scene.fillKey ? '1' : undefined,
  });

  await new Promise((resolve) => {
    captureWindow.webContents.once('did-finish-load', () => setTimeout(resolve, 2500));
    setTimeout(resolve, 6000);
  });

  if (captureWindow.isDestroyed()) {
    return { ok: false, error: `Capture window for "${scene.sourceName}" closed before start.` };
  }

  // Inject the audio-capture tap only for the program scene (fillKey:false).
  // Graphics feeds stay silent — audio belongs on a single program source.
  if (!scene.fillKey && payload?.audioEnabled) {
    try {
      await captureWindow.webContents.executeJavaScript(buildNdiAudioCaptureScript(), true);
    } catch (err) {
      console.warn(`[NDI:${scene.sourceName}] audio-capture injection failed:`, err?.message || err);
    }
  }

  const sender = ndiSender.createSender(scene.sourceName);
  // Program sender clocks audio when embedding is on so A/V stays in sync;
  // graphics feeds never clock audio (no audio track to clock against).
  const senderOptions = !scene.fillKey && payload?.audioEnabled ? { clockAudio: true } : undefined;
  const result = await sender.start(sceneWidth, sceneHeight, senderOptions);
  if (!result.ok) {
    try { if (!captureWindow.isDestroyed()) captureWindow.destroy(); } catch (_) { /* ignore */ }
    return result;
  }

  const entry = {
    window: captureWindow,
    sender,
    active: true,
    droppedFrames: 0,
    lastError: undefined,
  };
  ndiSources[scene.id] = entry;

  captureWindow.once('closed', () => {
    if (!entry.active) return;
    entry.active = false;
    entry.window = null;
    sender.stop().catch(() => {});
    delete ndiSources[scene.id];
    emitNdiState();
  });

  captureWindow.webContents.setFrameRate(NDI_TARGET_FPS);
  let sending = false;
  let pendingFrame = null;
  const flush = async (initialFrame) => {
    sending = true;
    let frame = initialFrame;
    while (entry.active && frame) {
      try {
        await sender.sendFrame(frame.buffer, frame.width, frame.height);
      } catch (err) {
        entry.droppedFrames++;
        if (entry.droppedFrames <= 3) {
          console.error(`[NDI] send error (${scene.sourceName}):`, err?.message || String(err));
        }
      }
      frame = pendingFrame;
      pendingFrame = null;
    }
    sending = false;
  };

  captureWindow.webContents.on('paint', async (_paintEvent, _dirty, image) => {
    if (!entry.active) return;
    const { width, height } = image.getSize();
    if (width === 0 || height === 0) return;
    const buffer = image.toBitmap();
    if (process.platform === 'darwin') {
      for (let i = 0; i < buffer.length; i += 4) {
        const r = buffer[i]; buffer[i] = buffer[i + 2]; buffer[i + 2] = r;
      }
    }
    const frame = { buffer, width, height };
    if (sending) {
      pendingFrame = frame;
      return;
    }
    pendingFrame = null;
    void flush(frame);
  });

  return { ok: true };
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
  const isWindowed = !!payload?.windowed;
  const targetDisplay = findDisplayById(displayId) || screen.getPrimaryDisplay();
  const displayBounds = targetDisplay?.bounds || targetDisplay?.workArea || { x: 0, y: 0, width: 1280, height: 720 };

  // Windowed (NDI/stream capture) mode: offscreen rendering is used, so the position doesn't
  // affect compositing. We still set 1920×1080 so the page layout matches the NDI output size.
  const bounds = isWindowed
    ? { x: displayBounds.x, y: displayBounds.y, width: 1920, height: 1080 }
    : displayBounds;

  const isAudience = kind === 'audience';
  let targetWindow = isAudience ? outputWindowRef : stageWindowRef;

  if (!targetWindow || targetWindow.isDestroyed()) {
    // Windowed/NDI mode uses offscreen rendering so capturePage() works regardless
    // of window position or GPU compositing state. Normal projector/stage windows
    // use the regular on-screen pipeline.
    targetWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      show: !isWindowed,
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      fullscreenable: !isWindowed,
      frame: false,
      skipTaskbar: true,
      resizable: isWindowed,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: !isWindowed,        // offscreen + sandbox conflicts in some Electron builds
        offscreen: isWindowed,       // render to buffer — invisible, GPU-independent
        backgroundThrottling: false, // prevent JS/timer throttling when window loses focus
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

  if (!isWindowed) {
    try {
      if (targetWindow.isFullScreen()) {
        targetWindow.setFullScreen(false);
      }
    } catch {
      // ignore
    }
    targetWindow.setBounds(bounds);
  }
  targetWindow.setMenuBarVisibility(false);
  await loadRendererRoute(targetWindow, isAudience ? 'output' : 'stage', {
    session: payload.sessionId || 'live',
    workspace: payload.workspaceId || 'default-workspace',
    fullscreen: isAudience ? '1' : undefined,
    ndi: isWindowed ? '1' : undefined,
  });
  if (isAudience) {
    targetWindow.webContents.insertCSS('html,body,*{cursor:none !important;}').catch(() => {});
  }
  if (!isWindowed) {
    try {
      if (!targetWindow.isVisible()) {
        targetWindow.show();
      }
      targetWindow.setFullScreen(true);
      targetWindow.focus();
    } catch {
      // ignore
    }
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
    const isWindowed = !!payload?.windowed;
    const displayId = Number(payload?.displayId || 0);
    // Windowed (NDI) mode does not require a display assignment — uses primary display.
    if (!isWindowed && (!Number.isFinite(displayId) || displayId <= 0)) {
      return { ok: false, error: 'DISPLAY_REQUIRED', state: machineServiceState };
    }
    const state = await createManagedRoleWindow(role, displayId || 0, payload);
    return { ok: true, state };
  });
  // ── NDI outbound send (Phase 2: multi-source) ─────────────────────────────
  ipcMain.handle('ndi:start', async (_event, payload) => {
    if (ndiActive) return { ok: true, state: ndiStatus };

    // Fresh start — clear any leftover entries from a previous failed attempt.
    await teardownAllNdiSources();

    // Broadcast Mode: off = program only (single NDI source, for streaming).
    // on = all three sources including transparent fill+key for switchers.
    ndiBroadcastMode = !!payload?.broadcastMode;
    // Audio embedding is program-only (fill+key graphics stay silent — audio
    // belongs on a single program feed to avoid phasing in a switcher sum).
    ndiAudioEnabled = !!payload?.audioEnabled;
    ndiAudioDroppedFrames = 0;
    ndiAudioFramesSent = 0;
    ndiAudioFramesLastSample = 0;
    ndiAudioFramesPerSecond = 0;
    const activeScenes = ndiBroadcastMode ? NDI_SCENES : NDI_SCENES.filter((s) => !s.fillKey);

    // Resolve session resolution from the payload preset (falls back to env
    // var defaults when the renderer doesn't specify — keeps CLI/test paths
    // working without changes).
    const resolved = resolveNdiResolution(payload?.resolution, NDI_DEFAULT_WIDTH, NDI_DEFAULT_HEIGHT);
    ndiResolution = resolved.key;
    ndiSessionWidth = resolved.width;
    ndiSessionHeight = resolved.height;
    const scenePayload = { ...payload, sessionWidth: ndiSessionWidth, sessionHeight: ndiSessionHeight };

    try {
      // Spawn all scenes in parallel. Any failure → roll everything back.
      const results = await Promise.all(
        activeScenes.map((scene) => startNdiScene(scene, scenePayload).catch((err) => ({
          ok: false,
          error: err?.message || String(err),
          sceneId: scene.id,
        })))
      );

      const firstFailure = results.find((r) => !r.ok);
      if (firstFailure) {
        await teardownAllNdiSources();
        ndiBroadcastMode = false;
        ndiAudioEnabled = false;
        ndiResolution = '1080p';
        ndiSessionWidth = NDI_DEFAULT_WIDTH;
        ndiSessionHeight = NDI_DEFAULT_HEIGHT;
        return { ok: false, error: firstFailure.error || 'Unknown NDI start failure.' };
      }

      ndiActive = true;

      if (!ndiDropLogTimer) {
        ndiDropLogTimer = setInterval(() => {
          for (const id of Object.keys(ndiSources)) {
            const entry = ndiSources[id];
            if (entry && entry.droppedFrames > 0) {
              console.warn(`[NDI] "${id}" dropped ${entry.droppedFrames} frames in last 10s`);
              entry.droppedFrames = 0;
            }
          }
        }, 10000);
      }

      // Audio telemetry — every 2s compute frames/sec and push state so the
      // renderer can show a live "flowing" indicator. Cheap: just math + emit.
      if (ndiAudioEnabled && !ndiAudioStatsTimer) {
        ndiAudioStatsTimer = setInterval(() => {
          const delta = ndiAudioFramesSent - ndiAudioFramesLastSample;
          ndiAudioFramesPerSecond = Math.round((delta / NDI_AUDIO_STATS_INTERVAL_MS) * 1000);
          ndiAudioFramesLastSample = ndiAudioFramesSent;
          emitNdiState();
        }, NDI_AUDIO_STATS_INTERVAL_MS);
      }

      emitNdiState();
      return { ok: true, state: ndiStatus };
    } catch (err) {
      await teardownAllNdiSources();
      ndiActive = false;
      ndiBroadcastMode = false;
      ndiAudioEnabled = false;
      ndiResolution = '1080p';
      ndiSessionWidth = NDI_DEFAULT_WIDTH;
      ndiSessionHeight = NDI_DEFAULT_HEIGHT;
      if (ndiAudioStatsTimer) { clearInterval(ndiAudioStatsTimer); ndiAudioStatsTimer = null; }
      emitNdiState();
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('ndi:stop', async () => {
    ndiActive = false;
    ndiBroadcastMode = false;
    ndiAudioEnabled = false;
    ndiResolution = '1080p';
    ndiSessionWidth = NDI_DEFAULT_WIDTH;
    ndiSessionHeight = NDI_DEFAULT_HEIGHT;
    ndiAudioDroppedFrames = 0;
    ndiAudioFramesSent = 0;
    ndiAudioFramesLastSample = 0;
    ndiAudioFramesPerSecond = 0;
    if (ndiDropLogTimer) { clearInterval(ndiDropLogTimer); ndiDropLogTimer = null; }
    if (ndiAudioStatsTimer) { clearInterval(ndiAudioStatsTimer); ndiAudioStatsTimer = null; }
    await teardownAllNdiSources();
    emitNdiState();
    return { ok: true };
  });

  ipcMain.handle('ndi:get-status', () => ndiStatus);

  // Audio frames arrive every ~20ms from the Lumina-Program capture window's
  // audio worklet. Route them to the program sender only. Use `ipcMain.on`
  // (fire-and-forget) — `.handle` with awaited replies would flood the event
  // loop.
  ipcMain.on('ndi:audio-frame', (_event, payload) => {
    if (!ndiActive || !ndiAudioEnabled) return;
    const entry = ndiSources['program'];
    if (!entry || !entry.active || !entry.sender) return;
    const pcm = payload?.pcm;
    const sampleRate = Number(payload?.sampleRate);
    const channels = Number(payload?.channels);
    const samples = Number(payload?.samples);
    if (!pcm || !(pcm instanceof ArrayBuffer)) return;
    const buffer = Buffer.from(pcm);
    entry.sender.sendAudioFrame(buffer, sampleRate, channels, samples).then(() => {
      ndiAudioFramesSent++;
    }).catch((err) => {
      ndiAudioDroppedFrames++;
      if (ndiAudioDroppedFrames <= 3) {
        console.error('[NDI] audio send error:', err?.message || String(err));
      }
    });
  });

  // Warnings from the capture window (e.g. cross-origin iframe detected)
  // relay to the main renderer so the operator sees a toast explaining why
  // some audio isn't reaching the NDI feed.
  ipcMain.on('ndi:audio-warning', (_event, payload) => {
    if (!payload || typeof payload !== 'object') return;
    const code = String(payload.code || '').slice(0, 64);
    const src = String(payload.src || '').slice(0, 200);
    if (!code) return;
    console.warn(`[NDI] audio warning: ${code}${src ? ' src=' + src : ''}`);
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('ndi:audio-warning', { code, src });
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

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
      autoUpdaterRef.quitAndInstall(true, true);
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
    autoUpdaterRef.quitAndInstall(true, true);
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
      // Disable DevTools in production builds to prevent users from tampering
      // with localStorage (e.g. forging lumina_demo_user) or inspecting creds.
      devTools: !isProd,
    },
    title: 'Lumina Presenter',
    backgroundColor: '#000000',
    show: false,
  });

  // Block DevTools keyboard shortcuts in production as a belt-and-braces guard
  // (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Cmd+Opt+I on macOS).
  if (isProd) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const key = (input.key || '').toLowerCase();
      const isDevToolsShortcut =
        key === 'f12' ||
        ((input.control || input.meta) && input.shift && (key === 'i' || key === 'j' || key === 'c')) ||
        (input.meta && input.alt && key === 'i');
      if (isDevToolsShortcut) {
        event.preventDefault();
      }
    });
    // Extra safety: if anything in the renderer calls openDevTools, close it immediately.
    mainWindow.webContents.on('devtools-opened', () => {
      try { mainWindow.webContents.closeDevTools(); } catch { /* noop */ }
    });
    // Block right-click "Inspect Element" context menu and any popup that might
    // expose dev affordances. The renderer can still handle its own contextmenu
    // events for in-app menus because this only suppresses the default Chromium menu.
    mainWindow.webContents.on('context-menu', (event) => {
      event.preventDefault();
    });
    // Refuse navigation to non-app origins to prevent XSS-style escapes.
    mainWindow.webContents.on('will-navigate', (event, url) => {
      try {
        const parsed = new URL(url);
        const isApp = parsed.protocol === 'file:' || parsed.origin === 'https://api.luminalive.co.uk';
        if (!isApp) event.preventDefault();
      } catch {
        event.preventDefault();
      }
    });
    // Refuse new windows except via setWindowOpenHandler below.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url);
        // Allow only https external links — they open in the default browser.
        if (parsed.protocol === 'https:') {
          shell.openExternal(url).catch(() => {});
        }
      } catch { /* noop */ }
      return { action: 'deny' };
    });
  }
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

  // Apply CSP in production only â€" Vite dev server needs unsafe-inline for HMR.
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
    mainWindow.maximize();
    mainWindow.show();
    // Check for updates on launch — delay 20s to let network settle after startup
    if (isProd) {
      setTimeout(() => void checkForUpdatesSafely(), 20_000);
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

// ── Runtime ASAR / critical-file integrity check ─────────────────────────────
// In production, verify that the bundled renderer and preload script exist and
// are non-empty before launching. This is not a substitute for code signing —
// a determined attacker who repacks the ASAR can defeat this — but it catches
// trivial tampering and accidental corruption (failed installs, AV quarantine).
function verifyCriticalFiles() {
  if (!app.isPackaged) return true;
  const required = [
    path.join(__dirname, 'preload.js'),
    DIST_INDEX_PATH,
  ];
  for (const p of required) {
    try {
      const st = fs.statSync(p);
      if (!st.isFile() || st.size === 0) {
        throw new Error(`Critical file missing or empty: ${p}`);
      }
    } catch (err) {
      console.error('[lumina-integrity] critical file check failed:', err?.message || err);
      try {
        dialog.showErrorBox(
          'Lumina Presenter — integrity error',
          'A required application file is missing or has been modified. Please reinstall Lumina Presenter from the official source.'
        );
      } catch { /* noop */ }
      app.exit(1);
      return false;
    }
  }
  return true;
}

app.whenReady().then(async () => {
  if (!verifyCriticalFiles()) return;
  startApiServer();
  // macOS requires explicit OS-level permission before getUserMedia can succeed.
  // On Windows/Linux this is handled automatically by Chromium.
  if (process.platform === 'darwin') {
    const { systemPreferences } = await import('electron');
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    if (micStatus !== 'granted') {
      await systemPreferences.askForMediaAccess('microphone');
    }
  }
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
  stopApiServer();
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
});
