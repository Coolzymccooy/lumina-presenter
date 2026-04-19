import type { DeviceKind } from './devicePicker';

export type CaptureModeId = 'church-mixer' | 'camera-ndi' | 'laptop-rescue' | 'basic-clean';

export interface NoiseGateConfig {
  enabled: boolean;
  thresholdDb: number;
  ratio: number;
  releaseMs: number;
}

export interface CaptureModePreset {
  id: CaptureModeId;
  name: string;
  description: string;
  constraints: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
  highPassHz: number;
  presenceGainDb: number;
  presenceFreq: number;
  gate: NoiseGateConfig;
  limiterCeilingDb: number;
  preferredSourceKinds: DeviceKind[];
}

export const CAPTURE_MODE_PRESETS: CaptureModePreset[] = [
  {
    id: 'church-mixer',
    name: 'Church Mixer Feed',
    description: 'Direct line from the sound desk — trusts the engineer\'s mix.',
    constraints: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    highPassHz: 60,
    presenceGainDb: 0,
    presenceFreq: 3000,
    gate: { enabled: false, thresholdDb: -60, ratio: 1, releaseMs: 250 },
    limiterCeilingDb: -1,
    preferredSourceKinds: ['mixer'],
  },
  {
    id: 'camera-ndi',
    name: 'Camera / NDI Audio',
    description: 'Audio embedded in a camera or NDI stream — light cleanup.',
    constraints: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    highPassHz: 80,
    presenceGainDb: 2,
    presenceFreq: 3000,
    gate: { enabled: false, thresholdDb: -60, ratio: 1, releaseMs: 250 },
    limiterCeilingDb: -1,
    preferredSourceKinds: ['camera', 'virtual'],
  },
  {
    id: 'laptop-rescue',
    name: 'Laptop Mic Rescue',
    description: 'Built-in mic in a noisy room — aggressive cleanup to salvage speech.',
    constraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    highPassHz: 100,
    presenceGainDb: 3.5,
    presenceFreq: 3000,
    gate: { enabled: true, thresholdDb: -55, ratio: 2, releaseMs: 250 },
    limiterCeilingDb: -2,
    preferredSourceKinds: ['laptop-mic', 'webcam-mic'],
  },
  {
    id: 'basic-clean',
    name: 'Basic Clean',
    description: 'Balanced defaults for any reasonable mic — a safe starting point.',
    constraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    highPassHz: 80,
    presenceGainDb: 2,
    presenceFreq: 3000,
    gate: { enabled: false, thresholdDb: -60, ratio: 1, releaseMs: 250 },
    limiterCeilingDb: -1.5,
    preferredSourceKinds: ['usb-mic', 'unknown'],
  },
];

export const CAPTURE_MODE_MAP = new Map<CaptureModeId, CaptureModePreset>(
  CAPTURE_MODE_PRESETS.map((p) => [p.id, p]),
);

export const DEFAULT_CAPTURE_MODE: CaptureModeId = 'basic-clean';
