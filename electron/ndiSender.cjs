/**
 * ndiSender.cjs — NDI outbound sender factory for Lumina Presenter.
 *
 * Pure Node.js module (no Electron imports). Loaded at startup from main.cjs.
 * Wraps @stagetimerio/grandiose — N-API, actively maintained, NDI SDK bundled.
 *
 * Phase 2: refactored from singleton → factory. Each call to createSender()
 * returns an independent NdiSenderInstance so main.cjs can run N simultaneous
 * NDI sources (Program, Lyrics, LowerThirds).
 *
 * API reference: https://github.com/stagetimerio/grandiose
 */

let grandiose = null;
let ndiAvailable = false;

/**
 * Attempt to load grandiose once (module-global; shared by all instances).
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

class NdiSenderInstance {
  /**
   * @param {string} sourceName
   */
  constructor(sourceName) {
    this._sourceName = sourceName || 'Lumina Presenter';
    this._sender = null;
    this._active = false;
    this._resolution = { width: 1920, height: 1080 };
  }

  get sourceName() { return this._sourceName; }
  get active() { return this._active; }
  get resolution() { return { ...this._resolution }; }

  /**
   * Start the underlying grandiose sender.
   * @param {number} width
   * @param {number} height
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async start(width, height) {
    const load = loadGrandiose();
    if (!load.ok) return load;

    // Tear down any existing instance state (idempotent).
    await this.stop();

    try {
      this._resolution = { width, height };
      this._sender = await grandiose.send({
        name: this._sourceName,
        clockVideo: true,
      });
      this._active = true;
      console.log(`[NDI] Sender started: "${this._sourceName}" ${width}x${height}`);
      return { ok: true };
    } catch (err) {
      this._sender = null;
      this._active = false;
      const message = err?.message || String(err);
      console.error(`[NDI] start error for "${this._sourceName}":`, message);
      return { ok: false, error: message };
    }
  }

  /**
   * Send one BGRA video frame.
   * @param {Buffer} bgraBuffer
   * @param {number} width
   * @param {number} height
   */
  async sendFrame(bgraBuffer, width, height) {
    if (!this._active || !this._sender) return;
    if (!bgraBuffer || !Buffer.isBuffer(bgraBuffer) || width <= 0 || height <= 0) return;

    const expectedStride = width * 4;
    const inferredStride = Math.floor(bgraBuffer.length / Math.max(1, height));
    const lineStrideBytes = Number.isFinite(inferredStride) && inferredStride >= expectedStride
      ? inferredStride
      : expectedStride;

    await this._sender.video({
      xres: width,
      yres: height,
      frameRateN: 30000,
      frameRateD: 1001,
      pictureAspectRatio: width / height,
      frameFormatType: grandiose.FORMAT_TYPE_PROGRESSIVE,
      lineStrideBytes,
      fourCC: grandiose.FOURCC_BGRA,
      data: bgraBuffer,
    });
  }

  /** Destroy the sender cleanly. Safe to call multiple times. */
  async stop() {
    this._active = false;
    if (!this._sender) return;
    try {
      await this._sender.destroy();
    } catch (err) {
      console.warn(`[NDI] stop cleanup warning for "${this._sourceName}":`, err?.message || err);
    } finally {
      this._sender = null;
      console.log(`[NDI] Sender stopped: "${this._sourceName}"`);
    }
  }
}

/**
 * Factory — returns a fresh NdiSenderInstance. Call .start(w, h) to activate.
 * @param {string} sourceName
 * @returns {NdiSenderInstance}
 */
function createSender(sourceName) {
  return new NdiSenderInstance(sourceName);
}

module.exports = {
  createSender,
  NdiSenderInstance,
  loadGrandiose,
};
