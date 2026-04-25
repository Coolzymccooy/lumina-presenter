// Local, machine-scoped persistence for the Tools menu state (overlays,
// aspect markers, test patterns). Kept on disk rather than syncing through
// the workspace so operator preferences don't bleed across machines.
const fs = require('fs');
const path = require('path');

const ASPECT_VALUES = Object.freeze(['off', '4:3', '16:9', '1:1']);
const TEST_PATTERN_VALUES = Object.freeze([
  'off',
  'smpte',
  'pluge',
  'black',
  'white',
  'gradient',
  'checkerboard',
]);

const DEFAULT_TOOLS_SETTINGS = Object.freeze({
  overlays: Object.freeze({ safeAreas: false, centerCross: false }),
  aspect: 'off',
  testPattern: 'off',
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeToolsSettings(input) {
  const safe = isPlainObject(input) ? input : {};
  const overlays = isPlainObject(safe.overlays) ? safe.overlays : {};
  return {
    overlays: {
      safeAreas: overlays.safeAreas === true,
      centerCross: overlays.centerCross === true,
    },
    aspect: ASPECT_VALUES.includes(safe.aspect) ? safe.aspect : 'off',
    testPattern: TEST_PATTERN_VALUES.includes(safe.testPattern) ? safe.testPattern : 'off',
  };
}

function mergePatch(current, patch) {
  const safePatch = isPlainObject(patch) ? patch : {};
  return sanitizeToolsSettings({
    ...current,
    ...safePatch,
    overlays: {
      ...current.overlays,
      ...(isPlainObject(safePatch.overlays) ? safePatch.overlays : {}),
    },
  });
}

function createToolsSettingsStore({ filePath }) {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('createToolsSettingsStore: filePath is required');
  }

  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        cache = sanitizeToolsSettings(JSON.parse(raw));
      } else {
        cache = sanitizeToolsSettings({});
      }
    } catch (_err) {
      cache = sanitizeToolsSettings({});
    }
    return cache;
  }

  function save(patch) {
    const next = mergePatch(load(), patch);
    cache = next;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8');
    } catch (_err) {
      // Read-only FS or permissions issue — keep in-memory cache coherent,
      // the next save attempt will retry the disk write.
    }
    return next;
  }

  function reset() {
    cache = null;
  }

  return { load, save, reset };
}

module.exports = {
  ASPECT_VALUES,
  TEST_PATTERN_VALUES,
  DEFAULT_TOOLS_SETTINGS,
  sanitizeToolsSettings,
  createToolsSettingsStore,
};
