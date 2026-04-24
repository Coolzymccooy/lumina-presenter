import { describe, it, expect, vi } from 'vitest';
import { buildToolsMenu } from './toolsMenu.cjs';
import { DEFAULT_TOOLS_SETTINGS, ASPECT_VALUES, TEST_PATTERN_VALUES } from './toolsSettingsStore.cjs';

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
});
