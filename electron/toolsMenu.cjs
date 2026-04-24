// Tools + Diagnostics menu template builders. Kept as pure functions so they
// can be unit-tested without spinning up Electron. main.cjs owns the actual
// Menu.buildFromTemplate / setApplicationMenu call and re-invokes the builder
// whenever settings change so checkbox / radio state stays in sync.
const { ASPECT_VALUES, TEST_PATTERN_VALUES } = require('./toolsSettingsStore.cjs');

const ASPECT_LABELS = {
  off: 'Off',
  '4:3': '4:3',
  '16:9': '16:9',
  '1:1': '1:1 (Square)',
};

const TEST_PATTERN_LABELS = {
  off: 'Off',
  smpte: 'SMPTE Color Bars',
  pluge: 'PLUGE',
  black: 'Solid Black',
  white: 'Solid White',
  gradient: 'Grayscale Gradient',
  checkerboard: 'Checkerboard',
};

const NDI_RESOLUTION_VALUES = Object.freeze(['720p', '1080p', '4k']);
const NDI_RESOLUTION_LABELS = {
  '720p': '720p  (1280 × 720)',
  '1080p': '1080p (1920 × 1080)',
  '4k': '4K    (3840 × 2160)',
};

function buildNdiMenu(ndiMenuState, send) {
  // ndiMenuState is optional — if absent, the NDI submenu is not rendered.
  // Workspace NDI settings live in the renderer (workspace-synced), so the
  // renderer pushes a flat view here via tools:set-ndi-menu-state whenever
  // workspaceSettings or the ndi runtime state changes.
  if (!ndiMenuState) return null;
  const active = ndiMenuState.active === true;
  const broadcastMode = ndiMenuState.broadcastMode === true;
  const audioEnabled = ndiMenuState.audioEnabled === true;
  const resolution = NDI_RESOLUTION_VALUES.includes(ndiMenuState.resolution)
    ? ndiMenuState.resolution
    : '1080p';

  return {
    label: 'NDI',
    submenu: [
      {
        label: active ? 'NDI Output — Live' : 'NDI Output — Off',
        type: 'checkbox',
        checked: active,
        click: () => send({ type: 'ndi.toggle-active' }),
      },
      { type: 'separator' },
      {
        label: 'Broadcast Mode (Fill + Key)',
        type: 'checkbox',
        checked: broadcastMode,
        click: () => send({ type: 'ndi.toggle-broadcast' }),
      },
      {
        label: 'Resolution',
        submenu: NDI_RESOLUTION_VALUES.map((value) => ({
          label: NDI_RESOLUTION_LABELS[value],
          type: 'radio',
          checked: resolution === value,
          click: () => send({ type: 'ndi.set-resolution', value }),
        })),
      },
      {
        label: 'Embed Program Audio',
        type: 'checkbox',
        checked: audioEnabled,
        click: () => send({ type: 'ndi.toggle-audio' }),
      },
    ],
  };
}

function buildToolsMenu({ settings, send, ndiMenuState }) {
  if (typeof send !== 'function') {
    throw new Error('buildToolsMenu: send callback is required');
  }
  const s = settings || {};
  const overlays = s.overlays || {};
  const aspect = s.aspect || 'off';
  const testPattern = s.testPattern || 'off';
  const ndiMenu = buildNdiMenu(ndiMenuState, send);

  return {
    label: 'Tools',
    submenu: [
      {
        label: 'Overlays',
        submenu: [
          {
            label: 'Safe Areas',
            type: 'checkbox',
            checked: overlays.safeAreas === true,
            click: () => send({ type: 'overlay.toggle', name: 'safeAreas' }),
          },
          {
            label: 'Center Cross',
            type: 'checkbox',
            checked: overlays.centerCross === true,
            click: () => send({ type: 'overlay.toggle', name: 'centerCross' }),
          },
        ],
      },
      {
        label: 'Aspect Markers',
        submenu: ASPECT_VALUES.map((value) => ({
          label: ASPECT_LABELS[value],
          type: 'radio',
          checked: aspect === value,
          click: () => send({ type: 'aspect.set', value }),
        })),
      },
      {
        label: 'Test Patterns',
        submenu: TEST_PATTERN_VALUES.map((value) => ({
          label: TEST_PATTERN_LABELS[value],
          type: 'radio',
          checked: testPattern === value,
          click: () => send({ type: 'testpattern.set', value }),
        })),
      },
      ...(ndiMenu ? [{ type: 'separator' }, ndiMenu] : []),
      { type: 'separator' },
      {
        label: 'Diagnostics',
        submenu: [
          { label: 'About Build', enabled: false },
        ],
      },
    ],
  };
}

module.exports = {
  ASPECT_LABELS,
  TEST_PATTERN_LABELS,
  NDI_RESOLUTION_VALUES,
  NDI_RESOLUTION_LABELS,
  buildToolsMenu,
  buildNdiMenu,
};
