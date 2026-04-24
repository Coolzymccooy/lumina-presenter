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

function buildToolsMenu({ settings, send }) {
  if (typeof send !== 'function') {
    throw new Error('buildToolsMenu: send callback is required');
  }
  const s = settings || {};
  const overlays = s.overlays || {};
  const aspect = s.aspect || 'off';
  const testPattern = s.testPattern || 'off';

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
  buildToolsMenu,
};
