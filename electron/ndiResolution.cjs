/**
 * NDI session resolution presets and resolver.
 *
 * Extracted into its own module so it can be unit-tested without loading
 * Electron (main.cjs registers ipcMain handlers on load and pulls in the
 * `electron` runtime, neither of which is available under vitest jsdom).
 */

const NDI_RESOLUTION_PRESETS = Object.freeze({
  '720p':  Object.freeze({ width: 1280, height: 720 }),
  '1080p': Object.freeze({ width: 1920, height: 1080 }),
  '4k':    Object.freeze({ width: 3840, height: 2160 }),
});

const DEFAULT_KEY = '1080p';

/**
 * Resolve a preset key (or any other input) to concrete dimensions.
 *
 * @param {unknown} input Candidate preset key from the renderer payload.
 * @param {number} [fallbackWidth=1920] Width to use when input is not a known preset.
 * @param {number} [fallbackHeight=1080] Height to use when input is not a known preset.
 * @returns {{ key: '720p'|'1080p'|'4k', width: number, height: number }}
 */
function resolveNdiResolution(input, fallbackWidth, fallbackHeight) {
  const preset = typeof input === 'string' ? NDI_RESOLUTION_PRESETS[input] : undefined;
  if (preset) {
    return { key: input, width: preset.width, height: preset.height };
  }
  const fw = Number.isFinite(fallbackWidth) && fallbackWidth > 0 ? fallbackWidth : NDI_RESOLUTION_PRESETS[DEFAULT_KEY].width;
  const fh = Number.isFinite(fallbackHeight) && fallbackHeight > 0 ? fallbackHeight : NDI_RESOLUTION_PRESETS[DEFAULT_KEY].height;
  return { key: DEFAULT_KEY, width: fw, height: fh };
}

module.exports = {
  NDI_RESOLUTION_PRESETS,
  resolveNdiResolution,
};
