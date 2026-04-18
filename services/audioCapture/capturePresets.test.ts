import { describe, it, expect } from 'vitest';
import {
  CAPTURE_MODE_PRESETS,
  CAPTURE_MODE_MAP,
  DEFAULT_CAPTURE_MODE,
  type CaptureModeId,
} from './capturePresets';

describe('capturePresets', () => {
  it('exports exactly 4 presets', () => {
    expect(CAPTURE_MODE_PRESETS).toHaveLength(4);
  });

  it('CAPTURE_MODE_MAP has all preset ids', () => {
    const ids: CaptureModeId[] = ['church-mixer', 'camera-ndi', 'laptop-rescue', 'basic-clean'];
    for (const id of ids) {
      expect(CAPTURE_MODE_MAP.has(id)).toBe(true);
    }
  });

  it('DEFAULT_CAPTURE_MODE is basic-clean', () => {
    expect(DEFAULT_CAPTURE_MODE).toBe('basic-clean');
  });

  it('church-mixer disables all browser processing', () => {
    const preset = CAPTURE_MODE_MAP.get('church-mixer')!;
    expect(preset.constraints.echoCancellation).toBe(false);
    expect(preset.constraints.noiseSuppression).toBe(false);
    expect(preset.constraints.autoGainControl).toBe(false);
  });

  it('laptop-rescue enables all browser processing and gate', () => {
    const preset = CAPTURE_MODE_MAP.get('laptop-rescue')!;
    expect(preset.constraints.echoCancellation).toBe(true);
    expect(preset.constraints.noiseSuppression).toBe(true);
    expect(preset.constraints.autoGainControl).toBe(true);
    expect(preset.gate.enabled).toBe(true);
    expect(preset.gate.thresholdDb).toBe(-55);
  });

  it('every preset has a non-empty name and description', () => {
    for (const p of CAPTURE_MODE_PRESETS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it('highPassHz is in valid range for all presets', () => {
    for (const p of CAPTURE_MODE_PRESETS) {
      expect(p.highPassHz).toBeGreaterThanOrEqual(40);
      expect(p.highPassHz).toBeLessThanOrEqual(200);
    }
  });
});
