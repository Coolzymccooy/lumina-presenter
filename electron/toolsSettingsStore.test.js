import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_TOOLS_SETTINGS,
  sanitizeToolsSettings,
  createToolsSettingsStore,
} from './toolsSettingsStore.cjs';

let tmpDir;
let filePath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-tools-'));
  filePath = path.join(tmpDir, 'tools-settings.json');
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_err) {
    /* noop */
  }
});

describe('sanitizeToolsSettings', () => {
  it('returns defaults for empty / nullish input', () => {
    expect(sanitizeToolsSettings(null)).toEqual(DEFAULT_TOOLS_SETTINGS);
    expect(sanitizeToolsSettings(undefined)).toEqual(DEFAULT_TOOLS_SETTINGS);
    expect(sanitizeToolsSettings({})).toEqual(DEFAULT_TOOLS_SETTINGS);
    expect(sanitizeToolsSettings('garbage')).toEqual(DEFAULT_TOOLS_SETTINGS);
  });

  it('preserves valid aspect values', () => {
    expect(sanitizeToolsSettings({ aspect: '4:3' }).aspect).toBe('4:3');
    expect(sanitizeToolsSettings({ aspect: '16:9' }).aspect).toBe('16:9');
    expect(sanitizeToolsSettings({ aspect: '1:1' }).aspect).toBe('1:1');
  });

  it('coerces unknown aspect values to off', () => {
    expect(sanitizeToolsSettings({ aspect: '21:9' }).aspect).toBe('off');
    expect(sanitizeToolsSettings({ aspect: 1234 }).aspect).toBe('off');
    expect(sanitizeToolsSettings({ aspect: null }).aspect).toBe('off');
  });

  it('coerces overlay flags to strict booleans', () => {
    expect(sanitizeToolsSettings({ overlays: { safeAreas: 'yes' } }).overlays.safeAreas).toBe(false);
    expect(sanitizeToolsSettings({ overlays: { safeAreas: 1 } }).overlays.safeAreas).toBe(false);
    expect(sanitizeToolsSettings({ overlays: { safeAreas: true } }).overlays.safeAreas).toBe(true);
    expect(sanitizeToolsSettings({ overlays: { centerCross: true } }).overlays.centerCross).toBe(true);
  });

  it('coerces invalid test pattern values to off', () => {
    expect(sanitizeToolsSettings({ testPattern: 'rainbow' }).testPattern).toBe('off');
    expect(sanitizeToolsSettings({ testPattern: 'smpte' }).testPattern).toBe('smpte');
    expect(sanitizeToolsSettings({ testPattern: 42 }).testPattern).toBe('off');
  });
});

describe('createToolsSettingsStore', () => {
  it('throws without a filePath', () => {
    expect(() => createToolsSettingsStore({})).toThrow();
  });

  it('load() returns defaults when the file does not exist', () => {
    const store = createToolsSettingsStore({ filePath });
    expect(store.load()).toEqual(DEFAULT_TOOLS_SETTINGS);
  });

  it('save() round-trips a patch through the file and survives re-open', () => {
    const store = createToolsSettingsStore({ filePath });
    const next = store.save({ aspect: '16:9', overlays: { safeAreas: true } });
    expect(next.aspect).toBe('16:9');
    expect(next.overlays.safeAreas).toBe(true);
    expect(next.overlays.centerCross).toBe(false);

    const store2 = createToolsSettingsStore({ filePath });
    expect(store2.load()).toEqual(next);
  });

  it('save() sanitizes invalid patches rather than throwing', () => {
    const store = createToolsSettingsStore({ filePath });
    const next = store.save({ aspect: '21:9', testPattern: 'rainbow' });
    expect(next.aspect).toBe('off');
    expect(next.testPattern).toBe('off');
  });

  it('load() falls back to defaults when the file is corrupt', () => {
    fs.writeFileSync(filePath, '{not json', 'utf8');
    const store = createToolsSettingsStore({ filePath });
    expect(store.load()).toEqual(DEFAULT_TOOLS_SETTINGS);
  });

  it('save() creates missing parent directories', () => {
    const nested = path.join(tmpDir, 'a', 'b', 'tools-settings.json');
    const store = createToolsSettingsStore({ filePath: nested });
    store.save({ aspect: '4:3' });
    expect(fs.existsSync(nested)).toBe(true);
  });

  it('merges partial overlay patches without clobbering siblings', () => {
    const store = createToolsSettingsStore({ filePath });
    store.save({ overlays: { safeAreas: true } });
    const next = store.save({ overlays: { centerCross: true } });
    expect(next.overlays).toEqual({ safeAreas: true, centerCross: true });
  });
});
