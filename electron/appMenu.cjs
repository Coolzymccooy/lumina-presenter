// Native application-menu template builders for File / Edit / View /
// Transport / Window / Help. Pure functions — main.cjs owns the actual
// Menu.buildFromTemplate / setApplicationMenu call and re-invokes these
// builders whenever menu state changes so check / radio labels stay in sync.
// The Tools submenu lives in its own module (toolsMenu.cjs) since the NDI
// state flow has its own cache.

const DEFAULT_APP_MENU_STATE = Object.freeze({
  sessionActive: false,
  viewMode: 'PRESENTER',
  blackout: false,
  outputMuted: false,
  lowerThirdsEnabled: false,
  routingMode: 'PROJECTOR',
  audienceWindowOpen: false,
  stageWindowOpen: false,
  lastSavedAt: null,
});

function buildFileMenu({ send, isMac }) {
  return {
    label: 'File',
    submenu: [
      {
        label: 'Preferences…',
        accelerator: 'CmdOrCtrl+,',
        click: () => send({ type: 'file.open-preferences' }),
      },
      {
        label: 'Profile…',
        accelerator: 'CmdOrCtrl+Shift+P',
        click: () => send({ type: 'file.open-profile' }),
      },
      { type: 'separator' },
      {
        label: 'Import',
        submenu: [
          {
            label: 'Media File…',
            accelerator: 'CmdOrCtrl+Shift+U',
            click: () => send({ type: 'file.import-media' }),
          },
          { type: 'separator' },
          {
            label: 'PowerPoint (Visual)…',
            click: () => send({ type: 'file.import-pptx-visual' }),
          },
          {
            label: 'PowerPoint (Text)…',
            click: () => send({ type: 'file.import-pptx-text' }),
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Share',
        submenu: [
          {
            label: 'Copy Audience URL',
            accelerator: 'CmdOrCtrl+Alt+A',
            click: () => send({ type: 'file.copy-share-url', which: 'audience' }),
          },
          {
            label: 'Copy OBS Output URL',
            accelerator: 'CmdOrCtrl+Alt+O',
            click: () => send({ type: 'file.copy-share-url', which: 'obs' }),
          },
          {
            label: 'Copy Clean Feed URL',
            accelerator: 'CmdOrCtrl+Alt+C',
            click: () => send({ type: 'file.copy-share-url', which: 'clean' }),
          },
          {
            label: 'Copy Stage URL',
            accelerator: 'CmdOrCtrl+Alt+S',
            click: () => send({ type: 'file.copy-share-url', which: 'stage' }),
          },
          {
            label: 'Copy Remote Control URL',
            click: () => send({ type: 'file.copy-share-url', which: 'remote' }),
          },
          { type: 'separator' },
          {
            label: 'Connect & Share…',
            accelerator: 'CmdOrCtrl+Shift+C',
            click: () => send({ type: 'file.open-connect' }),
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => send({ type: 'file.save' }),
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  };
}

function buildEditMenu() {
  return {
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
  };
}

function buildViewMenu({ state, send, isProd }) {
  const s = state;
  return {
    label: 'View',
    submenu: [
      {
        label: 'Presenter',
        type: 'radio',
        checked: s.viewMode === 'PRESENTER',
        accelerator: 'CmdOrCtrl+1',
        click: () => send({ type: 'view.set-mode', mode: 'PRESENTER' }),
      },
      {
        label: 'Builder',
        type: 'radio',
        checked: s.viewMode === 'BUILDER',
        accelerator: 'CmdOrCtrl+2',
        click: () => send({ type: 'view.set-mode', mode: 'BUILDER' }),
      },
      {
        label: 'Stage',
        type: 'radio',
        checked: s.viewMode === 'STAGE',
        accelerator: 'CmdOrCtrl+3',
        click: () => send({ type: 'view.set-mode', mode: 'STAGE' }),
      },
      { type: 'separator' },
      {
        label: 'Bible Browser',
        accelerator: 'CmdOrCtrl+B',
        click: () => send({ type: 'view.open-sidebar-tab', tab: 'BIBLE' }),
      },
      {
        label: 'Audio Library',
        accelerator: 'CmdOrCtrl+L',
        click: () => send({ type: 'view.open-sidebar-tab', tab: 'AUDIO' }),
      },
      {
        label: 'Motion Library',
        accelerator: 'CmdOrCtrl+Shift+M',
        click: () => send({ type: 'view.open-motion-library' }),
      },
      {
        label: 'Audience Studio',
        accelerator: 'CmdOrCtrl+Shift+A',
        click: () => send({ type: 'view.open-sidebar-tab', tab: 'AUDIENCE' }),
      },
      { type: 'separator' },
      {
        label: 'Timer Pop-out',
        accelerator: 'CmdOrCtrl+Shift+T',
        click: () => send({ type: 'view.open-timer-popout' }),
      },
      { type: 'separator' },
      { role: 'reload', accelerator: 'CmdOrCtrl+R', visible: !isProd },
      { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R', visible: !isProd },
      { role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I', visible: !isProd },
      ...(isProd ? [] : [{ type: 'separator' }]),
      { role: 'togglefullscreen', accelerator: 'F11' },
    ],
  };
}

function buildTransportMenu({ state, send }) {
  const s = state;
  const disabled = !s.sessionActive;
  return {
    label: 'Transport',
    submenu: [
      {
        label: 'Next Slide',
        accelerator: 'Right',
        enabled: !disabled,
        click: () => send({ type: 'transport.next-slide' }),
      },
      {
        label: 'Previous Slide',
        accelerator: 'Left',
        enabled: !disabled,
        click: () => send({ type: 'transport.prev-slide' }),
      },
      {
        label: 'Go Live',
        accelerator: 'Return',
        enabled: !disabled,
        click: () => send({ type: 'transport.go-live' }),
      },
      { type: 'separator' },
      {
        label: 'Next Item',
        accelerator: 'Shift+Right',
        enabled: !disabled,
        click: () => send({ type: 'transport.next-item' }),
      },
      {
        label: 'Previous Item',
        accelerator: 'Shift+Left',
        enabled: !disabled,
        click: () => send({ type: 'transport.prev-item' }),
      },
      { type: 'separator' },
      {
        label: 'Play / Pause',
        accelerator: 'Space',
        enabled: !disabled,
        click: () => send({ type: 'transport.toggle-play' }),
      },
      {
        label: 'Stop',
        enabled: !disabled,
        click: () => send({ type: 'transport.stop' }),
      },
      { type: 'separator' },
      {
        label: 'Audience Mute',
        type: 'checkbox',
        checked: s.outputMuted,
        accelerator: 'M',
        enabled: !disabled,
        click: () => send({ type: 'transport.toggle-mute' }),
      },
      {
        label: 'Blackout',
        type: 'checkbox',
        checked: s.blackout,
        accelerator: 'B',
        enabled: !disabled,
        click: () => send({ type: 'transport.toggle-blackout' }),
      },
      {
        label: 'Lower Thirds',
        type: 'checkbox',
        checked: s.lowerThirdsEnabled,
        accelerator: 'CmdOrCtrl+L',
        enabled: !disabled,
        click: () => send({ type: 'transport.toggle-lower-thirds' }),
      },
      { type: 'separator' },
      {
        label: 'Routing Mode',
        submenu: [
          {
            label: 'Projector',
            type: 'radio',
            checked: s.routingMode === 'PROJECTOR',
            click: () => send({ type: 'transport.set-routing', mode: 'PROJECTOR' }),
          },
          {
            label: 'Stream',
            type: 'radio',
            checked: s.routingMode === 'STREAM',
            click: () => send({ type: 'transport.set-routing', mode: 'STREAM' }),
          },
          {
            label: 'Lobby',
            type: 'radio',
            checked: s.routingMode === 'LOBBY',
            click: () => send({ type: 'transport.set-routing', mode: 'LOBBY' }),
          },
        ],
      },
    ],
  };
}

function buildWindowMenu({ state, send, isMac }) {
  const s = state;
  return {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
      { type: 'separator' },
      {
        label: s.audienceWindowOpen ? 'Close Audience Window' : 'Open Audience Window',
        click: () => send({
          type: s.audienceWindowOpen ? 'window.close-audience' : 'window.open-audience',
        }),
      },
      {
        label: s.stageWindowOpen ? 'Close Stage Window' : 'Open Stage Window',
        click: () => send({
          type: s.stageWindowOpen ? 'window.close-stage' : 'window.open-stage',
        }),
      },
    ],
  };
}

function buildHelpMenu({ send }) {
  return {
    label: 'Help',
    submenu: [
      {
        label: 'Guided Tours…',
        accelerator: 'F1',
        click: () => send({ type: 'help.open-tours' }),
      },
      {
        label: 'Help…',
        click: () => send({ type: 'help.open-help' }),
      },
      {
        label: 'Keyboard Shortcuts',
        accelerator: 'CmdOrCtrl+/',
        click: () => send({ type: 'help.open-shortcuts' }),
      },
      { type: 'separator' },
      {
        label: 'Lumina Releases',
        click: () => send({ type: 'help.open-releases' }),
      },
      {
        label: 'Report Issue',
        click: () => send({ type: 'help.report-issue' }),
      },
      { type: 'separator' },
      {
        label: 'About Lumina Presenter',
        click: () => send({ type: 'help.open-about' }),
      },
    ],
  };
}

function sanitizeAppMenuState(input) {
  const safe = input && typeof input === 'object' ? input : {};
  const viewMode = ['PRESENTER', 'BUILDER', 'STAGE'].includes(safe.viewMode) ? safe.viewMode : 'PRESENTER';
  const routingMode = ['PROJECTOR', 'STREAM', 'LOBBY'].includes(safe.routingMode) ? safe.routingMode : 'PROJECTOR';
  const lastSavedAt = typeof safe.lastSavedAt === 'number' && Number.isFinite(safe.lastSavedAt) ? safe.lastSavedAt : null;
  return {
    sessionActive: safe.sessionActive === true,
    viewMode,
    blackout: safe.blackout === true,
    outputMuted: safe.outputMuted === true,
    lowerThirdsEnabled: safe.lowerThirdsEnabled === true,
    routingMode,
    audienceWindowOpen: safe.audienceWindowOpen === true,
    stageWindowOpen: safe.stageWindowOpen === true,
    lastSavedAt,
  };
}

module.exports = {
  DEFAULT_APP_MENU_STATE,
  sanitizeAppMenuState,
  buildFileMenu,
  buildEditMenu,
  buildViewMenu,
  buildTransportMenu,
  buildWindowMenu,
  buildHelpMenu,
};
