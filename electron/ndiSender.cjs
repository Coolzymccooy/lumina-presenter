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
const AUDIO_FORMAT_FLOAT_32_SEPARATE = 0;
const NDI_AUDIO_FOURCC_FLTP =
  'F'.charCodeAt(0) |
  ('L'.charCodeAt(0) << 8) |
  ('T'.charCodeAt(0) << 16) |
  ('p'.charCodeAt(0) << 24);

function interleavedFloat32ToPlanarBuffer(pcmBuffer, channels, samples) {
  const expectedBytes = channels * samples * 4;
  if (pcmBuffer.length < expectedBytes) return null;

  const channelStrideBytes = samples * 4;
  const planarBuffer = Buffer.allocUnsafe(expectedBytes);

  for (let channel = 0; channel < channels; channel++) {
    const channelBaseOffset = channel * channelStrideBytes;
    for (let sample = 0; sample < samples; sample++) {
      const srcOffset = ((sample * channels) + channel) * 4;
      const dstOffset = channelBaseOffset + (sample * 4);
      planarBuffer.writeFloatLE(pcmBuffer.readFloatLE(srcOffset), dstOffset);
    }
  }

  return { channelStrideBytes, planarBuffer };
}

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
   * @param {{ clockAudio?: boolean }} [options] When `clockAudio` is true the
   *   sender clocks audio frames from the stream (keeps A/V sync when audio
   *   is embedded). Default false — graphics-only senders have nothing to
   *   clock against and clockAudio:true would stall the video pump.
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async start(width, height, options) {
    const load = loadGrandiose();
    if (!load.ok) return load;

    // Tear down any existing instance state (idempotent).
    await this.stop();

    try {
      this._resolution = { width, height };
      this._sender = await grandiose.send({
        name: this._sourceName,
        clockVideo: true,
        clockAudio: !!options?.clockAudio,
      });
      this._active = true;
      console.log(`[NDI] Sender started: "${this._sourceName}" ${width}x${height}${options?.clockAudio ? ' (audio-clocked)' : ''}`);
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

  /**
   * Send one interleaved Float32 audio frame (NDI embedded audio).
   * `pcmBuffer` holds interleaved L/R samples, so its length is samples * channels.
   * The installed grandiose addon expects planar FLTp audio on send, so the
   * sender repacks the renderer's interleaved PCM before handing it off.
   * @param {Buffer} pcmBuffer
   * @param {number} sampleRate e.g. 48000
   * @param {number} channels typically 2 (stereo)
   * @param {number} samples samples per channel in this frame
   */
  async sendAudioFrame(pcmBuffer, sampleRate, channels, samples) {
    if (!this._active || !this._sender) return;
    if (!pcmBuffer || !Buffer.isBuffer(pcmBuffer)) return;
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) return;
    if (!Number.isFinite(channels) || channels <= 0) return;
    if (!Number.isFinite(samples) || samples <= 0) return;

    // The published typings model sender.audio() after the receive-side audio
    // frame, but the native addon actually requires planar FLTp samples plus
    // `noChannels` / `noSamples` / `channelStrideBytes` / `fourCC` on send.
    const planar = interleavedFloat32ToPlanarBuffer(pcmBuffer, channels, samples);
    if (!planar) return;

    const audioFormat = grandiose?.AUDIO_FORMAT_FLOAT_32_SEPARATE ?? AUDIO_FORMAT_FLOAT_32_SEPARATE;
    const fourCC = grandiose?.FOURCC_FLTp ?? NDI_AUDIO_FOURCC_FLTP;
    await this._sender.audio({
      audioFormat,
      referenceLevel: 0,
      sampleRate,
      channels,
      samples,
      noChannels: channels,
      noSamples: samples,
      channelStrideInBytes: planar.channelStrideBytes,
      channelStrideBytes: planar.channelStrideBytes,
      fourCC,
      data: planar.planarBuffer,
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
