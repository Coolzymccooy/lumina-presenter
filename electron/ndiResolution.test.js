import { describe, it, expect } from 'vitest';
import { NDI_RESOLUTION_PRESETS, resolveNdiResolution } from './ndiResolution.cjs';

describe('NDI resolution presets', () => {
  it('exposes the three canonical broadcast resolutions', () => {
    expect(NDI_RESOLUTION_PRESETS['720p']).toEqual({ width: 1280, height: 720 });
    expect(NDI_RESOLUTION_PRESETS['1080p']).toEqual({ width: 1920, height: 1080 });
    expect(NDI_RESOLUTION_PRESETS['4k']).toEqual({ width: 3840, height: 2160 });
  });

  it('preset object is frozen so downstream code cannot mutate it', () => {
    expect(Object.isFrozen(NDI_RESOLUTION_PRESETS)).toBe(true);
    expect(Object.isFrozen(NDI_RESOLUTION_PRESETS['1080p'])).toBe(true);
  });
});

describe('resolveNdiResolution', () => {
  it('returns the exact preset when given a known key', () => {
    expect(resolveNdiResolution('720p', 1920, 1080)).toEqual({ key: '720p', width: 1280, height: 720 });
    expect(resolveNdiResolution('1080p', 1920, 1080)).toEqual({ key: '1080p', width: 1920, height: 1080 });
    expect(resolveNdiResolution('4k', 1920, 1080)).toEqual({ key: '4k', width: 3840, height: 2160 });
  });

  it('falls back to the provided fallback dimensions for unknown keys', () => {
    expect(resolveNdiResolution('5k', 2560, 1440)).toEqual({ key: '1080p', width: 2560, height: 1440 });
    expect(resolveNdiResolution(undefined, 2560, 1440)).toEqual({ key: '1080p', width: 2560, height: 1440 });
    expect(resolveNdiResolution(null, 2560, 1440)).toEqual({ key: '1080p', width: 2560, height: 1440 });
  });

  it('falls back to 1920x1080 when fallback dimensions are invalid', () => {
    expect(resolveNdiResolution('bogus', 0, 0)).toEqual({ key: '1080p', width: 1920, height: 1080 });
    expect(resolveNdiResolution('bogus', -100, -100)).toEqual({ key: '1080p', width: 1920, height: 1080 });
    expect(resolveNdiResolution('bogus', Number.NaN, Number.NaN)).toEqual({ key: '1080p', width: 1920, height: 1080 });
  });

  it('ignores non-string inputs entirely', () => {
    expect(resolveNdiResolution(1080, 1920, 1080)).toEqual({ key: '1080p', width: 1920, height: 1080 });
    expect(resolveNdiResolution({ width: 1280, height: 720 }, 1920, 1080)).toEqual({ key: '1080p', width: 1920, height: 1080 });
  });
});
