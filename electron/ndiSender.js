/**
 * ndiSender.js — NDI outbound sender for Lumina Presenter.
 *
 * Pure Node.js module (no Electron imports). Loaded at startup from main.js.
 * Wraps @stagetimerio/grandiose — N-API, actively maintained, NDI SDK bundled.
 *
 * API reference: https://github.com/stagetimerio/grandiose
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let grandiose = null;
let ndiAvailable = false;

/**
 * Attempt to load grandiose once. Sets ndiAvailable accordingly.
 * @returns {{ ok: boolean, error?: string }}
 */
function loadGrandiose() {
  if (grandiose !== null) return { ok: ndiAvailable };

  try {
    grandiose = require('@stagetimerio/grandiose');
    ndiAvailable = true;
    return { ok: true };
  } catch (err) {
    grandiose = null;
    ndiAvailable = false;
    const message = err?.message || String(err);
    console.error('[NDI] Failed to load grandiose:', message);
    return {
      ok: false,
      error: 'NDI runtime not found. Run "npm install" to restore the NDI addon, then restart Lumina.',
    };
  }
}

// ─── Module-level sender state ───────────────────────────────────────────────

/** @type {any|null} grandiose sender instance */
let sender = null;
/** @type {boolean} */
let active = false;
/** @type {{ width: number, height: number }} */
let currentResolution = { width: 1920, height: 1080 };
/** @type {string} */
let currentSourceName = 'Lumina Presenter';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create and start an NDI sender.
 * @param {string} sourceName
 * @param {number} width
 * @param {number} height
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function startNdiSend(sourceName, width, height) {
  const load = loadGrandiose();
  if (!load.ok) return load;

  // Tear down any existing sender before creating a new one.
  await stopNdiSend();

  try {
    currentSourceName = sourceName || 'Lumina Presenter';
    currentResolution = { width, height };

    sender = await grandiose.send({
      name: currentSourceName,
      clockVideo: true,
    });

    active = true;
    console.log(`[NDI] Sender started: "${currentSourceName}" ${width}x${height}`);
    return { ok: true };
  } catch (err) {
    sender = null;
    active = false;
    const message = err?.message || String(err);
    console.error('[NDI] startNdiSend error:', message);
    return { ok: false, error: message };
  }
}

/**
 * Send one BGRA video frame.
 * @param {Buffer} bgraBuffer  Raw pixel data (BGRA, 4 bytes per pixel)
 * @param {number} width
 * @param {number} height
 * @returns {Promise<void>}
 */
export async function sendFrame(bgraBuffer, width, height) {
  if (!active || !sender) return;
  if (!bgraBuffer || !Buffer.isBuffer(bgraBuffer) || width <= 0 || height <= 0) return;

  const expectedStride = width * 4;
  const inferredStride = Math.floor(bgraBuffer.length / Math.max(1, height));
  const lineStrideBytes = Number.isFinite(inferredStride) && inferredStride >= expectedStride
    ? inferredStride
    : expectedStride;

  await sender.video({
    xres: width,
    yres: height,
    frameRateN: 30000,
    frameRateD: 1001,   // 29.97 fps drop-frame
    pictureAspectRatio: width / height,
    frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
    lineStrideBytes,
    fourCC: grandiose.FOURCC_BGRA,
    data: bgraBuffer,
  });
}

/**
 * Destroy the active sender cleanly.
 * @returns {Promise<void>}
 */
export async function stopNdiSend() {
  active = false;

  if (!sender) return;

  try {
    await sender.destroy();
  } catch (err) {
    // Ignore errors during teardown — window/process may already be gone.
    console.warn('[NDI] stopNdiSend cleanup warning:', err?.message || err);
  } finally {
    sender = null;
    console.log('[NDI] Sender stopped.');
  }
}

/** @returns {boolean} */
export function isActive() {
  return active;
}

/** @returns {string} */
export function getSourceName() {
  return currentSourceName;
}

/** @returns {{ width: number, height: number }} */
export function getResolution() {
  return { ...currentResolution };
}
