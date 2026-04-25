import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_APP_MENU_STATE,
  sanitizeAppMenuState,
  buildFileMenu,
  buildEditMenu,
  buildViewMenu,
  buildTransportMenu,
  buildWindowMenu,
  buildHelpMenu,
} from './appMenu.cjs';

function sub(menu, label) {
  return menu.submenu.find((i) => i.label === label);
}

describe('sanitizeAppMenuState', () => {
  it('returns defaults for nullish/empty input', () => {
    expect(sanitizeAppMenuState(null)).toEqual(DEFAULT_APP_MENU_STATE);
    expect(sanitizeAppMenuState(undefined)).toEqual(DEFAULT_APP_MENU_STATE);
    expect(sanitizeAppMenuState({})).toEqual(DEFAULT_APP_MENU_STATE);
  });
  it('coerces unknown viewMode to PRESENTER', () => {
    expect(sanitizeAppMenuState({ viewMode: 'WEIRD' }).viewMode).toBe('PRESENTER');
  });
  it('coerces unknown routingMode to PROJECTOR', () => {
    expect(sanitizeAppMenuState({ routingMode: 'SPACE' }).routingMode).toBe('PROJECTOR');
  });
  it('coerces non-boolean flags to false', () => {
    const s = sanitizeAppMenuState({ blackout: 1, outputMuted: 'y', lowerThirdsEnabled: null });
    expect(s.blackout).toBe(false);
    expect(s.outputMuted).toBe(false);
    expect(s.lowerThirdsEnabled).toBe(false);
  });
  it('preserves valid values', () => {
    const s = sanitizeAppMenuState({
      sessionActive: true,
      viewMode: 'STAGE',
      blackout: true,
      routingMode: 'STREAM',
      lastSavedAt: 1000,
    });
    expect(s.viewMode).toBe('STAGE');
    expect(s.blackout).toBe(true);
    expect(s.routingMode).toBe('STREAM');
    expect(s.lastSavedAt).toBe(1000);
  });
});

describe('buildFileMenu', () => {
  const send = () => vi.fn();
  it('includes Preferences, Profile, Import submenu, Share submenu, Save', () => {
    const menu = buildFileMenu({ send: send(), isMac: false });
    expect(sub(menu, 'Preferences…')).toBeDefined();
    expect(sub(menu, 'Profile…')).toBeDefined();
    expect(sub(menu, 'Import')).toBeDefined();
    expect(sub(menu, 'Share')).toBeDefined();
    expect(sub(menu, 'Save')).toBeDefined();
  });
  it('Import submenu exposes Media + PPTX visual/text entries', () => {
    const menu = buildFileMenu({ send: send(), isMac: false });
    const importSub = sub(menu, 'Import').submenu.filter((i) => i.label);
    const labels = importSub.map((i) => i.label);
    expect(labels).toContain('Media File…');
    expect(labels).toContain('PowerPoint (Visual)…');
    expect(labels).toContain('PowerPoint (Text)…');
  });
  it('Import → Media File emits file.import-media', () => {
    const spy = vi.fn();
    const menu = buildFileMenu({ send: spy, isMac: false });
    sub(menu, 'Import').submenu.find((i) => i.label === 'Media File…').click();
    expect(spy).toHaveBeenCalledWith({ type: 'file.import-media' });
  });
  it('Import → PowerPoint (Visual) emits file.import-pptx-visual', () => {
    const spy = vi.fn();
    const menu = buildFileMenu({ send: spy, isMac: false });
    sub(menu, 'Import').submenu.find((i) => i.label === 'PowerPoint (Visual)…').click();
    expect(spy).toHaveBeenCalledWith({ type: 'file.import-pptx-visual' });
  });
  it('Import → PowerPoint (Text) emits file.import-pptx-text', () => {
    const spy = vi.fn();
    const menu = buildFileMenu({ send: spy, isMac: false });
    sub(menu, 'Import').submenu.find((i) => i.label === 'PowerPoint (Text)…').click();
    expect(spy).toHaveBeenCalledWith({ type: 'file.import-pptx-text' });
  });
  it('Share submenu has 5 copy targets + Connect & Share', () => {
    const menu = buildFileMenu({ send: send(), isMac: false });
    const share = sub(menu, 'Share').submenu.filter((i) => i.label);
    const labels = share.map((i) => i.label);
    expect(labels).toContain('Copy Audience URL');
    expect(labels).toContain('Copy OBS Output URL');
    expect(labels).toContain('Copy Clean Feed URL');
    expect(labels).toContain('Copy Stage URL');
    expect(labels).toContain('Copy Remote Control URL');
    expect(labels).toContain('Connect & Share…');
  });
  it('Save emits file.save', () => {
    const spy = vi.fn();
    const menu = buildFileMenu({ send: spy, isMac: false });
    sub(menu, 'Save').click();
    expect(spy).toHaveBeenCalledWith({ type: 'file.save' });
  });
  it('Copy Audience URL emits correct command', () => {
    const spy = vi.fn();
    const menu = buildFileMenu({ send: spy, isMac: false });
    const share = sub(menu, 'Share').submenu.find((i) => i.label === 'Copy Audience URL');
    share.click();
    expect(spy).toHaveBeenCalledWith({ type: 'file.copy-share-url', which: 'audience' });
  });
});

describe('buildEditMenu', () => {
  it('uses native roles for standard edit actions', () => {
    const menu = buildEditMenu();
    const roles = menu.submenu.filter((i) => i.role).map((i) => i.role);
    expect(roles).toContain('undo');
    expect(roles).toContain('redo');
    expect(roles).toContain('cut');
    expect(roles).toContain('copy');
    expect(roles).toContain('paste');
    expect(roles).toContain('selectAll');
  });
});

describe('buildViewMenu', () => {
  const state = DEFAULT_APP_MENU_STATE;
  it('three view modes are radio items with exactly one checked', () => {
    const menu = buildViewMenu({ state: { ...state, viewMode: 'BUILDER' }, send: vi.fn(), isProd: true });
    const modes = ['Presenter', 'Builder', 'Stage'].map((lbl) => sub(menu, lbl));
    expect(modes.every((i) => i.type === 'radio')).toBe(true);
    expect(modes.filter((i) => i.checked).map((i) => i.label)).toEqual(['Builder']);
  });
  it('emits view.set-mode on radio click', () => {
    const spy = vi.fn();
    const menu = buildViewMenu({ state, send: spy, isProd: true });
    sub(menu, 'Stage').click();
    expect(spy).toHaveBeenCalledWith({ type: 'view.set-mode', mode: 'STAGE' });
  });
  it('emits sidebar-tab commands for library items', () => {
    const spy = vi.fn();
    const menu = buildViewMenu({ state, send: spy, isProd: true });
    sub(menu, 'Bible Browser').click();
    sub(menu, 'Audio Library').click();
    sub(menu, 'Audience Studio').click();
    expect(spy).toHaveBeenNthCalledWith(1, { type: 'view.open-sidebar-tab', tab: 'BIBLE' });
    expect(spy).toHaveBeenNthCalledWith(2, { type: 'view.open-sidebar-tab', tab: 'AUDIO' });
    expect(spy).toHaveBeenNthCalledWith(3, { type: 'view.open-sidebar-tab', tab: 'AUDIENCE' });
  });
  it('hides reload/devtools in production', () => {
    const menu = buildViewMenu({ state, send: vi.fn(), isProd: true });
    const reload = menu.submenu.find((i) => i.role === 'reload');
    expect(reload?.visible).toBe(false);
  });
});

describe('buildTransportMenu', () => {
  it('disables transport actions when no session is active', () => {
    const menu = buildTransportMenu({ state: { ...DEFAULT_APP_MENU_STATE, sessionActive: false }, send: vi.fn() });
    expect(sub(menu, 'Next Slide').enabled).toBe(false);
    expect(sub(menu, 'Go Live').enabled).toBe(false);
  });
  it('enables transport actions when session is active', () => {
    const menu = buildTransportMenu({ state: { ...DEFAULT_APP_MENU_STATE, sessionActive: true }, send: vi.fn() });
    expect(sub(menu, 'Next Slide').enabled).toBe(true);
    expect(sub(menu, 'Go Live').enabled).toBe(true);
  });
  it('mute / blackout / lower-thirds checkboxes reflect state', () => {
    const menu = buildTransportMenu({
      state: { ...DEFAULT_APP_MENU_STATE, sessionActive: true, blackout: true, outputMuted: true, lowerThirdsEnabled: true },
      send: vi.fn(),
    });
    expect(sub(menu, 'Audience Mute').checked).toBe(true);
    expect(sub(menu, 'Blackout').checked).toBe(true);
    expect(sub(menu, 'Lower Thirds').checked).toBe(true);
  });
  it('routing mode is a radio submenu', () => {
    const menu = buildTransportMenu({
      state: { ...DEFAULT_APP_MENU_STATE, sessionActive: true, routingMode: 'STREAM' },
      send: vi.fn(),
    });
    const routing = sub(menu, 'Routing Mode').submenu;
    const checked = routing.filter((i) => i.checked).map((i) => i.label);
    expect(checked).toEqual(['Stream']);
  });
  it('emits transport.next-slide on click', () => {
    const spy = vi.fn();
    const menu = buildTransportMenu({ state: { ...DEFAULT_APP_MENU_STATE, sessionActive: true }, send: spy });
    sub(menu, 'Next Slide').click();
    expect(spy).toHaveBeenCalledWith({ type: 'transport.next-slide' });
  });
});

describe('buildWindowMenu', () => {
  it('label flips between Open/Close based on state', () => {
    const closedMenu = buildWindowMenu({ state: DEFAULT_APP_MENU_STATE, send: vi.fn(), isMac: false });
    expect(sub(closedMenu, 'Open Audience Window')).toBeDefined();
    expect(sub(closedMenu, 'Close Audience Window')).toBeUndefined();

    const openMenu = buildWindowMenu({
      state: { ...DEFAULT_APP_MENU_STATE, audienceWindowOpen: true, stageWindowOpen: true },
      send: vi.fn(),
      isMac: false,
    });
    expect(sub(openMenu, 'Close Audience Window')).toBeDefined();
    expect(sub(openMenu, 'Close Stage Window')).toBeDefined();
  });
  it('emits correct command based on state', () => {
    const spy = vi.fn();
    const menu = buildWindowMenu({ state: DEFAULT_APP_MENU_STATE, send: spy, isMac: false });
    sub(menu, 'Open Audience Window').click();
    expect(spy).toHaveBeenCalledWith({ type: 'window.open-audience' });

    const spy2 = vi.fn();
    const menu2 = buildWindowMenu({
      state: { ...DEFAULT_APP_MENU_STATE, audienceWindowOpen: true },
      send: spy2,
      isMac: false,
    });
    sub(menu2, 'Close Audience Window').click();
    expect(spy2).toHaveBeenCalledWith({ type: 'window.close-audience' });
  });
});

describe('buildHelpMenu', () => {
  it('includes Guided Tours, Help, Shortcuts, Releases, Report Issue, About', () => {
    const menu = buildHelpMenu({ send: vi.fn() });
    const labels = menu.submenu.filter((i) => i.label).map((i) => i.label);
    expect(labels).toContain('Guided Tours…');
    expect(labels).toContain('Help…');
    expect(labels).toContain('Keyboard Shortcuts');
    expect(labels).toContain('Lumina Releases');
    expect(labels).toContain('Report Issue');
    expect(labels).toContain('About Lumina Presenter');
  });
  it('emits the right command for each', () => {
    const spy = vi.fn();
    const menu = buildHelpMenu({ send: spy });
    sub(menu, 'Guided Tours…').click();
    sub(menu, 'About Lumina Presenter').click();
    expect(spy).toHaveBeenNthCalledWith(1, { type: 'help.open-tours' });
    expect(spy).toHaveBeenNthCalledWith(2, { type: 'help.open-about' });
  });
});
