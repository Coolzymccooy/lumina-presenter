import { describe, expect, it } from 'vitest';
import {
  buildPreferredAudioConstraints,
  createAudioInputDiagnostic,
  type AudioInputProbeResult,
} from './mediaDiagnostics';

describe('mediaDiagnostics', () => {
  it('builds preferred audio constraints with ideal cleanup settings', () => {
    const constraints = buildPreferredAudioConstraints({
      deviceId: 'mic-123',
      channelCount: 1,
      sampleRate: 48000,
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: true,
    });

    expect(constraints).toEqual({
      deviceId: { exact: 'mic-123' },
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48000 },
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: false },
      autoGainControl: { ideal: true },
    });
  });

  it('creates UI diagnostics from the first audio track', () => {
    const probe: AudioInputProbeResult = {
      stream: null,
      status: 'usable',
      requestVariant: 'bare-audio',
      fallbackUsed: true,
      warning: 'Fell back to the OS/default microphone.',
      rawPeak: 0.25,
      rawRms: 0.04,
      rawSampleCount: 2048,
      rawDurationMs: 700,
      errorName: null,
      errorMessage: null,
      trackDiagnostics: [{
        label: 'Built-in Mic',
        enabled: true,
        muted: false,
        readyState: 'live',
        settings: { sampleRate: 48000, deviceId: 'resolved-device' },
        constraints: {},
        capabilities: null,
      }],
    };

    expect(createAudioInputDiagnostic('recording', 'selected-device', probe)).toEqual({
      phase: 'recording',
      status: 'usable',
      requestVariant: 'bare-audio',
      fallbackUsed: true,
      warning: 'Fell back to the OS/default microphone.',
      rawPeak: 0.25,
      rawRms: 0.04,
      rawSampleCount: 2048,
      rawDurationMs: 700,
      label: 'Built-in Mic',
      muted: false,
      readyState: 'live',
      settingsSampleRate: 48000,
      settingsDeviceId: 'resolved-device',
      selectedDeviceId: 'selected-device',
    });
  });
});
