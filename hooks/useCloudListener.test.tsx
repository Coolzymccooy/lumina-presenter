import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AudioInputDiagnostic } from '../services/audioCapture/mediaDiagnostics';

const createCloudListenerMock = vi.fn();

vi.mock('../services/audioCapture/cloudListener', () => ({
  createCloudListener: (...args: unknown[]) => createCloudListenerMock(...args),
}));

import { useCloudListener, type UseCloudListenerOptions, type UseCloudListenerReturn } from './useCloudListener';

let container: HTMLDivElement;
let root: Root;
let latestValue: UseCloudListenerReturn | null = null;

interface FakeHandle {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getState: () => string;
  getCumulativeTranscript: () => string;
  getInputDiagnostic: () => AudioInputDiagnostic | null;
  onChange: (listener: () => void) => () => void;
  emit: (next: {
    state?: string;
    cumulativeTranscript?: string;
    inputDiagnostic?: AudioInputDiagnostic | null;
  }) => void;
}

function createFakeHandle(): FakeHandle {
  let state = 'idle';
  let cumulativeTranscript = '';
  let inputDiagnostic: AudioInputDiagnostic | null = null;
  const listeners = new Set<() => void>();

  return {
    start: vi.fn(async () => true),
    stop: vi.fn(),
    getState: () => state,
    getCumulativeTranscript: () => cumulativeTranscript,
    getInputDiagnostic: () => inputDiagnostic,
    onChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (next) => {
      if (typeof next.state === 'string') state = next.state;
      if (typeof next.cumulativeTranscript === 'string') cumulativeTranscript = next.cumulativeTranscript;
      if ('inputDiagnostic' in next) inputDiagnostic = next.inputDiagnostic ?? null;
      listeners.forEach((listener) => listener());
    },
  };
}

function Harness(props: UseCloudListenerOptions) {
  latestValue = useCloudListener(props);
  return null;
}

function render(props: UseCloudListenerOptions) {
  act(() => {
    root.render(<Harness {...props} />);
  });
}

function baseProps(overrides: Partial<UseCloudListenerOptions> = {}): UseCloudListenerOptions {
  return {
    locale: 'en-US',
    onTranscript: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  latestValue = null;
  createCloudListenerMock.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  latestValue = null;
  vi.restoreAllMocks();
});

describe('useCloudListener', () => {
  it('mirrors state, cumulativeTranscript, and inputDiagnostic from the engine handle', () => {
    const handle = createFakeHandle();
    createCloudListenerMock.mockReturnValue(handle);

    render(baseProps({ selectedAudioDeviceId: 'selected-mic' }));

    const diagnostic: AudioInputDiagnostic = {
      phase: 'listening',
      status: 'usable',
      requestVariant: 'preferred',
      fallbackUsed: false,
      warning: null,
      rawPeak: 0.2,
      rawRms: 0.04,
      rawSampleCount: 2048,
      rawDurationMs: 700,
      label: 'Microphone Array (AMD Audio Device)',
      muted: false,
      readyState: 'live',
      settingsSampleRate: 48000,
      settingsDeviceId: 'resolved-device',
      selectedDeviceId: 'selected-mic',
    };

    act(() => {
      handle.emit({
        state: 'listening',
        cumulativeTranscript: 'Romans 8:28',
        inputDiagnostic: diagnostic,
      });
    });

    expect(latestValue?.state).toBe('listening');
    expect(latestValue?.cumulativeTranscript).toBe('Romans 8:28');
    expect(latestValue?.inputDiagnostic).toEqual(diagnostic);
  });

  it('forwards start() and stop() to the current engine handle', async () => {
    const handle = createFakeHandle();
    createCloudListenerMock.mockReturnValue(handle);

    render(baseProps());

    await expect(latestValue?.start()).resolves.toBe(true);
    expect(handle.start).toHaveBeenCalledOnce();

    act(() => {
      latestValue?.stop();
    });
    expect(handle.stop).toHaveBeenCalledOnce();
  });

  it('recreates the engine when option dependencies change and stops the previous handle', () => {
    const firstHandle = createFakeHandle();
    const secondHandle = createFakeHandle();
    createCloudListenerMock
      .mockReturnValueOnce(firstHandle)
      .mockReturnValueOnce(secondHandle);

    render(baseProps({
      audioDeviceId: 'resolved-1',
      selectedAudioDeviceId: 'selected-1',
      captureMode: 'basic-clean',
    }));

    render(baseProps({
      audioDeviceId: 'resolved-2',
      selectedAudioDeviceId: 'selected-2',
      captureMode: 'camera-ndi',
    }));

    expect(createCloudListenerMock).toHaveBeenCalledTimes(2);
    expect(firstHandle.stop).toHaveBeenCalledOnce();
    expect(secondHandle.stop).not.toHaveBeenCalled();
  });
});
