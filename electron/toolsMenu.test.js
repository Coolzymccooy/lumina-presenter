import { describe, it, expect, vi } from 'vitest';
import { buildToolsMenu, buildNdiMenu, NDI_RESOLUTION_VALUES } from './toolsMenu.cjs';
import { DEFAULT_TOOLS_SETTINGS, ASPECT_VALUES, TEST_PATTERN_VALUES } from './toolsSettingsStore.cjs';

const DEFAULT_NDI_MENU_STATE = {
  active: false,
  broadcastMode: false,
  audioEnabled: false,
  resolution: '1080p',
};

function section(menu, label) {
  return menu.submenu.find((i) => i.label === label);
}

describe('buildToolsMenu', () => {
  it('throws without a send callback', () => {
    // @ts-expect-error intentional misuse
    expect(() => buildToolsMenu({ settings: DEFAULT_TOOLS_SETTINGS })).toThrow();
  });

  it('returns Tools with Overlays, Aspect Markers, Test Patterns, and Diagnostics', () => {
    const menu = buildToolsMenu({ settings: DEFAULT_TOOLS_SETTINGS, send: vi.fn() });
    expect(menu.label).toBe('Tools');
    const labels = menu.submenu.filter((i) => i.label).map((i) => i.label);
    expect(labels).toEqual(['Overlays', 'Aspect Markers', 'Test Patterns', 'Diagnostics']);
  });

  it('overlay checkboxes reflect settings', () => {
    const menu = buildToolsMenu({
      settings: { ...DEFAULT_TOOLS_SETTINGS, overlays: { safeAreas: true, centerCross: false } },
      send: vi.fn(),
    });
    const overlays = section(menu, 'Overlays').submenu;
    expect(overlays[0]).toMatchObject({ label: 'Safe Areas', type: 'checkbox', checked: true });
    expect(overlays[1]).toMatchObject({ label: 'Center Cross', type: 'checkbox', checked: false });
  });

  it('emits overlay.toggle when a checkbox is clicked', () => {
    const send = vi.fn();
    const menu = buildToolsMenu({ settings: DEFAULT_TOOLS_SETTINGS, send });
    section(menu, 'Overlays').submenu[0].click();
    section(menu, 'Overlays').submenu[1].click();
    expect(send).toHaveBeenNthCalledWith(1, { type: 'overlay.toggle', name: 'safeAreas' });
    expect(send).toHaveBeenNthCalledWith(2, { type: 'overlay.toggle', name: 'centerCross' });
  });

  it('aspect markers are radio items with exactly one checked', () => {
    const menu = buildToolsMenu({
      settings: { ...DEFAULT_TOOLS_SETTINGS, aspect: '16:9' },
      send: vi.fn(),
    });
    const aspects = section(menu, 'Aspect Markers').submenu;
    expect(aspects).toHaveLength(ASPECT_VALUES.length);
    expect(aspects.every((i) => i.type === 'radio')).toBe(true);
    const checked = aspects.filter((i) => i.checked).map((i) => i.label);
    expect(checked).toEqual(['16:9']);
  });

  it('emits aspect.set on aspect click', () => {
    const send = vi.fn();
    const menu = buildToolsMenu({ settings: DEFAULT_TOOLS_SETTINGS, send });
    section(menu, 'Aspect Markers').submenu.find((i) => i.label === '4:3').click();
    expect(send).toHaveBeenCalledWith({ type: 'aspect.set', value: '4:3' });
  });

  it('test patterns are radio items for every supported value', () => {
    const menu = buildToolsMenu({
      settings: { ...DEFAULT_TOOLS_SETTINGS, testPattern: 'smpte' },
      send: vi.fn(),
    });
    const patterns = section(menu, 'Test Patterns').submenu;
    expect(patterns).toHaveLength(TEST_PATTERN_VALUES.length);
    expect(patterns.every((i) => i.type === 'radio')).toBe(true);
    expect(patterns.filter((i) => i.checked)).toHaveLength(1);
    expect(patterns.find((i) => i.checked).label).toBe('SMPTE Color Bars');
  });

  it('emits testpattern.set on pattern click', () => {
    const send = vi.fn();
    const menu = buildToolsMenu({ settings: DEFAULT_TOOLS_SETTINGS, send });
    section(menu, 'Test Patterns').submenu.find((i) => i.label === 'PLUGE').click();
    expect(send).toHaveBeenCalledWith({ type: 'testpattern.set', value: 'pluge' });
  });

  it('diagnostics submenu has a placeholder until real items land', () => {
    const menu = buildToolsMenu({ settings: DEFAULT_TOOLS_SETTINGS, send: vi.fn() });
    const diag = section(menu, 'Diagnostics');
    expect(diag.submenu[0]).toMatchObject({ label: 'About Build', enabled: false });
  });

  it('omits the NDI submenu when ndiMenuState is undefined', () => {
    const menu = buildToolsMenu({ settings: DEFAULT_TOOLS_SETTINGS, send: vi.fn() });
    expect(section(menu, 'NDI')).toBeUndefined();
  });

  it('includes the NDI submenu when ndiMenuState is provided', () => {
    const menu = buildToolsMenu({
      settings: DEFAULT_TOOLS_SETTINGS,
      send: vi.fn(),
      ndiMenuState: DEFAULT_NDI_MENU_STATE,
    });
    expect(section(menu, 'NDI')).toBeDefined();
  });
});

describe('buildNdiMenu', () => {
  it('returns null when state is undefined', () => {
    expect(buildNdiMenu(undefined, vi.fn())).toBeNull();
  });

  it('NDI Output checkbox reflects active state', () => {
    const off = buildNdiMenu({ ...DEFAULT_NDI_MENU_STATE, active: false }, vi.fn());
    const on = buildNdiMenu({ ...DEFAULT_NDI_MENU_STATE, active: true }, vi.fn());
    expect(off.submenu[0].checked).toBe(false);
    expect(off.submenu[0].label).toMatch(/Off/);
    expect(on.submenu[0].checked).toBe(true);
    expect(on.submenu[0].label).toMatch(/Live/);
  });

  it('emits ndi.toggle-active when NDI Output is clicked', () => {
    const send = vi.fn();
    const menu = buildNdiMenu(DEFAULT_NDI_MENU_STATE, send);
    menu.submenu[0].click();
    expect(send).toHaveBeenCalledWith({ type: 'ndi.toggle-active' });
  });

  it('broadcast + audio checkboxes reflect state', () => {
    const menu = buildNdiMenu({
      ...DEFAULT_NDI_MENU_STATE,
      broadcastMode: true,
      audioEnabled: true,
    }, vi.fn());
    const broadcast = menu.submenu.find((i) => i.label?.startsWith('Broadcast'));
    const audio = menu.submenu.find((i) => i.label === 'Embed Program Audio');
    expect(broadcast?.checked).toBe(true);
    expect(audio?.checked).toBe(true);
  });

  it('emits ndi.toggle-broadcast and ndi.toggle-audio on click', () => {
    const send = vi.fn();
    const menu = buildNdiMenu(DEFAULT_NDI_MENU_STATE, send);
    menu.submenu.find((i) => i.label?.startsWith('Broadcast'))?.click();
    menu.submenu.find((i) => i.label === 'Embed Program Audio')?.click();
    expect(send).toHaveBeenNthCalledWith(1, { type: 'ndi.toggle-broadcast' });
    expect(send).toHaveBeenNthCalledWith(2, { type: 'ndi.toggle-audio' });
  });

  it('resolution submenu is radio with exactly one selected', () => {
    const menu = buildNdiMenu({ ...DEFAULT_NDI_MENU_STATE, resolution: '4k' }, vi.fn());
    const res = menu.submenu.find((i) => i.label === 'Resolution');
    expect(res.submenu).toHaveLength(NDI_RESOLUTION_VALUES.length);
    expect(res.submenu.every((i) => i.type === 'radio')).toBe(true);
    const checked = res.submenu.filter((i) => i.checked);
    expect(checked).toHaveLength(1);
    expect(checked[0].label).toMatch(/4K/);
  });

  it('emits ndi.set-resolution on radio click', () => {
    const send = vi.fn();
    const menu = buildNdiMenu(DEFAULT_NDI_MENU_STATE, send);
    const res = menu.submenu.find((i) => i.label === 'Resolution');
    res.submenu.find((i) => i.label?.includes('720p'))?.click();
    expect(send).toHaveBeenCalledWith({ type: 'ndi.set-resolution', value: '720p' });
  });

  it('coerces unknown resolution to 1080p', () => {
    const menu = buildNdiMenu({ ...DEFAULT_NDI_MENU_STATE, resolution: '8k' }, vi.fn());
    const res = menu.submenu.find((i) => i.label === 'Resolution');
    const checked = res.submenu.find((i) => i.checked);
    expect(checked.label).toMatch(/1080p/);
  });

  it('emits ndi.open-info when NDI Info… is clicked', () => {
    const send = vi.fn();
    const menu = buildNdiMenu(DEFAULT_NDI_MENU_STATE, send);
    const info = menu.submenu.find((i) => i.label === 'NDI Info…');
    expect(info).toBeDefined();
    info.click();
    expect(send).toHaveBeenCalledWith({ type: 'ndi.open-info' });
  });
});
