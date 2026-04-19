import type { CaptureModePreset } from './capturePresets';

const TRACK_SETTLE_MS = 150;
const RAW_PROBE_DURATION_MS = 700;
const RAW_PROBE_INTERVAL_MS = 70;
const RAW_PROBE_FFT_SIZE = 2048;
const RAW_SILENCE_PEAK_THRESHOLD = 0.0001;
const RAW_SILENCE_RMS_THRESHOLD = 0.00001;

export type AudioProbeMode = 'record-check' | 'recording' | 'listening';
export type AudioInputProbeStatus = 'usable' | 'muted-live' | 'ended' | 'silent-raw' | 'request-failed';
export type AudioInputRequestVariant = 'preferred' | 'without-device' | 'bare-audio' | 'none';

interface PreferredAudioConstraintOptions {
  deviceId?: string;
  channelCount?: number;
  sampleRate?: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface AudioTrackDiagnostic {
  label: string;
  enabled: boolean;
  muted: boolean;
  readyState: MediaStreamTrackState;
  settings: MediaTrackSettings;
  constraints: MediaTrackConstraints;
  capabilities: MediaTrackCapabilities | null;
}

export interface AudioInputProbeResult {
  stream: MediaStream | null;
  status: AudioInputProbeStatus;
  requestVariant: AudioInputRequestVariant;
  fallbackUsed: boolean;
  warning: string | null;
  trackDiagnostics: AudioTrackDiagnostic[];
  rawPeak: number;
  rawRms: number;
  rawSampleCount: number;
  rawDurationMs: number;
  errorName: string | null;
  errorMessage: string | null;
}

export interface AudioInputDiagnostic {
  phase: AudioProbeMode;
  status: AudioInputProbeStatus;
  requestVariant: AudioInputRequestVariant;
  fallbackUsed: boolean;
  warning: string | null;
  rawPeak: number;
  rawRms: number;
  rawSampleCount: number;
  rawDurationMs: number;
  label: string;
  muted: boolean;
  readyState: MediaStreamTrackState | 'missing';
  settingsSampleRate: number | null;
  settingsDeviceId: string | null;
  selectedDeviceId: string | null;
}

interface AudioInputProbeOptions {
  deviceId?: string;
  preset: CaptureModePreset;
  mode: AudioProbeMode;
  signal?: AbortSignal;
  strictRawSignal?: boolean;
}

interface RawSignalStats {
  peak: number;
  rms: number;
  sampleCount: number;
  durationMs: number;
}

interface ProbeAttemptResult {
  stream: MediaStream | null;
  status: AudioInputProbeStatus;
  trackDiagnostics: AudioTrackDiagnostic[];
  rawPeak: number;
  rawRms: number;
  rawSampleCount: number;
  rawDurationMs: number;
  errorName: string | null;
  errorMessage: string | null;
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

function stopStreamSafely(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* no-op */ }
  });
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(createAbortError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function readCapabilities(track: MediaStreamTrack): MediaTrackCapabilities | null {
  const candidate = track as MediaStreamTrack & {
    getCapabilities?: () => MediaTrackCapabilities;
  };

  if (typeof candidate.getCapabilities !== 'function') {
    return null;
  }

  try {
    return candidate.getCapabilities();
  } catch {
    return null;
  }
}

function classifyProbeStatus(
  diagnostics: AudioTrackDiagnostic[],
  rawPeak: number,
  rawRms: number,
  strictRawSignal: boolean,
): AudioInputProbeStatus {
  if (diagnostics.length === 0) return 'ended';
  if (diagnostics.every((track) => track.readyState === 'ended')) return 'ended';
  if (diagnostics.every((track) => track.readyState === 'live' && track.muted)) return 'muted-live';
  if (
    strictRawSignal
    && rawPeak <= RAW_SILENCE_PEAK_THRESHOLD
    && rawRms <= RAW_SILENCE_RMS_THRESHOLD
  ) {
    return 'silent-raw';
  }
  return 'usable';
}

function shouldTryFallback(status: AudioInputProbeStatus, errorName: string | null): boolean {
  if (status === 'usable') return false;
  if (status === 'request-failed') return errorName === 'OverconstrainedError';
  return true;
}

function buildFallbackWarning(
  requestVariant: Exclude<AudioInputRequestVariant, 'none' | 'preferred'>,
  hadExactDevice: boolean,
): string {
  if (requestVariant === 'without-device') {
    return hadExactDevice
      ? 'The selected source was unavailable or silent. Lumina retried without locking to that exact device.'
      : 'The preferred V2 constraints were unavailable or silent. Lumina retried with a relaxed microphone request.';
  }
  return hadExactDevice
    ? 'The selected source was silent, so Lumina fell back to the OS/default microphone.'
    : 'The preferred V2 constraints were silent, so Lumina fell back to a bare OS/default microphone request.';
}

function buildRequestedAudio(
  preset: CaptureModePreset,
  deviceId?: string,
): MediaTrackConstraints {
  return buildPreferredAudioConstraints({
    deviceId,
    channelCount: 1,
    sampleRate: 48000,
    echoCancellation: preset.constraints.echoCancellation,
    noiseSuppression: preset.constraints.noiseSuppression,
    autoGainControl: preset.constraints.autoGainControl,
  });
}

async function measureRawStreamSignal(
  stream: MediaStream,
  signal?: AbortSignal,
): Promise<RawSignalStats> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    return { peak: 0, rms: 0, sampleCount: 0, durationMs: 0 };
  }

  const ctx: AudioContext = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = RAW_PROBE_FFT_SIZE;
  const sink = ctx.createGain();
  sink.gain.value = 0;

  source.connect(analyser);
  analyser.connect(sink);
  sink.connect(ctx.destination);

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => undefined);
    }

    const buffer = new Float32Array(analyser.fftSize);
    let peak = 0;
    let sumSq = 0;
    let sampleCount = 0;
    const startedAt = performance.now();

    while (performance.now() - startedAt < RAW_PROBE_DURATION_MS) {
      throwIfAborted(signal);
      analyser.getFloatTimeDomainData(buffer);
      for (let index = 0; index < buffer.length; index++) {
        const sample = buffer[index];
        const abs = Math.abs(sample);
        if (abs > peak) peak = abs;
        sumSq += sample * sample;
        sampleCount++;
      }
      await delay(RAW_PROBE_INTERVAL_MS, signal);
    }

    return {
      peak,
      rms: sampleCount > 0 ? Math.sqrt(sumSq / sampleCount) : 0,
      sampleCount,
      durationMs: performance.now() - startedAt,
    };
  } finally {
    try { source.disconnect(); } catch { /* no-op */ }
    try { analyser.disconnect(); } catch { /* no-op */ }
    try { sink.disconnect(); } catch { /* no-op */ }
    try { ctx.close(); } catch { /* no-op */ }
  }
}

async function inspectRequestedStream(
  mode: AudioProbeMode,
  requestVariant: Exclude<AudioInputRequestVariant, 'none'>,
  requestedAudio: MediaStreamConstraints['audio'],
  strictRawSignal: boolean,
  signal?: AbortSignal,
): Promise<ProbeAttemptResult> {
  let stream: MediaStream | null = null;
  try {
    throwIfAborted(signal);
    stream = await navigator.mediaDevices.getUserMedia({ audio: requestedAudio });
    const trackDiagnostics = await collectAudioTrackDiagnostics(stream, TRACK_SETTLE_MS, signal);
    const rawSignal = await measureRawStreamSignal(stream, signal);
    const status = classifyProbeStatus(trackDiagnostics, rawSignal.peak, rawSignal.rms, strictRawSignal);
    logAudioProbeAttempt(mode, requestVariant, requestedAudio, {
      status,
      stream,
      trackDiagnostics,
      rawPeak: rawSignal.peak,
      rawRms: rawSignal.rms,
      rawSampleCount: rawSignal.sampleCount,
      rawDurationMs: rawSignal.durationMs,
      errorName: null,
      errorMessage: null,
    });
    return {
      stream,
      status,
      trackDiagnostics,
      rawPeak: rawSignal.peak,
      rawRms: rawSignal.rms,
      rawSampleCount: rawSignal.sampleCount,
      rawDurationMs: rawSignal.durationMs,
      errorName: null,
      errorMessage: null,
    };
  } catch (error) {
    if (stream) {
      stopStreamSafely(stream);
      stream = null;
    }
    if ((error as Error)?.name === 'AbortError') throw error;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : 'Could not access microphone.';
    logAudioProbeAttempt(mode, requestVariant, requestedAudio, {
      status: 'request-failed',
      stream: null,
      trackDiagnostics: [],
      rawPeak: 0,
      rawRms: 0,
      rawSampleCount: 0,
      rawDurationMs: 0,
      errorName,
      errorMessage,
    });
    return {
      stream: null,
      status: 'request-failed',
      trackDiagnostics: [],
      rawPeak: 0,
      rawRms: 0,
      rawSampleCount: 0,
      rawDurationMs: 0,
      errorName,
      errorMessage,
    };
  }
}

function logAudioProbeAttempt(
  mode: AudioProbeMode,
  requestVariant: Exclude<AudioInputRequestVariant, 'none'>,
  requestedAudio: MediaStreamConstraints['audio'],
  result: ProbeAttemptResult,
): void {
  console.info('[audioCapture] probe', {
    mode,
    requestVariant,
    requestedAudio,
    status: result.status,
    errorName: result.errorName,
    errorMessage: result.errorMessage,
    streamActive: result.stream?.active ?? false,
    supportedConstraints: navigator.mediaDevices.getSupportedConstraints(),
    rawPeak: result.rawPeak,
    rawRms: result.rawRms,
    rawSampleCount: result.rawSampleCount,
    rawDurationMs: result.rawDurationMs,
    tracks: result.trackDiagnostics,
  });
}

export function buildPreferredAudioConstraints(
  options: PreferredAudioConstraintOptions,
): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    echoCancellation: { ideal: options.echoCancellation },
    noiseSuppression: { ideal: options.noiseSuppression },
    autoGainControl: { ideal: options.autoGainControl },
  };

  if (typeof options.channelCount === 'number') {
    constraints.channelCount = { ideal: options.channelCount };
  }
  if (typeof options.sampleRate === 'number') {
    constraints.sampleRate = { ideal: options.sampleRate };
  }
  if (options.deviceId) {
    constraints.deviceId = { exact: options.deviceId };
  }

  return constraints;
}

export async function collectAudioTrackDiagnostics(
  stream: MediaStream,
  settleMs = TRACK_SETTLE_MS,
  signal?: AbortSignal,
): Promise<AudioTrackDiagnostic[]> {
  if (settleMs > 0) {
    await delay(settleMs, signal);
  }

  return stream.getAudioTracks().map((track) => ({
    label: track.label,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    settings: track.getSettings(),
    constraints: track.getConstraints(),
    capabilities: readCapabilities(track),
  }));
}

export function createAudioInputDiagnostic(
  phase: AudioProbeMode,
  selectedDeviceId: string | undefined,
  probe: AudioInputProbeResult,
): AudioInputDiagnostic {
  const firstTrack = probe.trackDiagnostics[0];
  return {
    phase,
    status: probe.status,
    requestVariant: probe.requestVariant,
    fallbackUsed: probe.fallbackUsed,
    warning: probe.warning,
    rawPeak: probe.rawPeak,
    rawRms: probe.rawRms,
    rawSampleCount: probe.rawSampleCount,
    rawDurationMs: probe.rawDurationMs,
    label: firstTrack?.label || 'No live audio track',
    muted: firstTrack?.muted ?? false,
    readyState: firstTrack?.readyState ?? 'missing',
    settingsSampleRate: firstTrack?.settings.sampleRate ?? null,
    settingsDeviceId: firstTrack?.settings.deviceId ?? null,
    selectedDeviceId: selectedDeviceId ?? null,
  };
}

export async function probeAudioInput(
  options: AudioInputProbeOptions,
): Promise<AudioInputProbeResult> {
  const {
    deviceId,
    preset,
    mode,
    signal,
    strictRawSignal = true,
  } = options;
  const preferredAudio = buildRequestedAudio(preset, deviceId);
  const withoutDeviceAudio = buildRequestedAudio(preset);

  const preferredResult = await inspectRequestedStream(
    mode,
    'preferred',
    preferredAudio,
    strictRawSignal,
    signal,
  );
  if (preferredResult.status === 'usable') {
    return {
      ...preferredResult,
      requestVariant: 'preferred',
      fallbackUsed: false,
      warning: null,
    };
  }

  let lastAttemptVariant: AudioInputRequestVariant = 'preferred';
  let lastFailure = preferredResult;
  if (deviceId && shouldTryFallback(preferredResult.status, preferredResult.errorName)) {
    const withoutDeviceResult = await inspectRequestedStream(
      mode,
      'without-device',
      withoutDeviceAudio,
      strictRawSignal,
      signal,
    );
    lastAttemptVariant = 'without-device';
    if (withoutDeviceResult.status === 'usable') {
      if (preferredResult.stream && preferredResult.stream !== withoutDeviceResult.stream) {
        stopStreamSafely(preferredResult.stream);
      }
      return {
        ...withoutDeviceResult,
        requestVariant: 'without-device',
        fallbackUsed: true,
        warning: buildFallbackWarning('without-device', true),
      };
    }
    if (lastFailure.stream && lastFailure.stream !== withoutDeviceResult.stream) {
      stopStreamSafely(lastFailure.stream);
    }
    lastFailure = withoutDeviceResult;
  }

  if (shouldTryFallback(lastFailure.status, lastFailure.errorName)) {
    const bareAudioResult = await inspectRequestedStream(
      mode,
      'bare-audio',
      true,
      strictRawSignal,
      signal,
    );
    lastAttemptVariant = 'bare-audio';
    if (bareAudioResult.status === 'usable') {
      if (lastFailure.stream && lastFailure.stream !== bareAudioResult.stream) {
        stopStreamSafely(lastFailure.stream);
      }
      if (preferredResult.stream && preferredResult.stream !== lastFailure.stream && preferredResult.stream !== bareAudioResult.stream) {
        stopStreamSafely(preferredResult.stream);
      }
      return {
        ...bareAudioResult,
        requestVariant: 'bare-audio',
        fallbackUsed: true,
        warning: buildFallbackWarning('bare-audio', Boolean(deviceId)),
      };
    }
    if (lastFailure.stream && lastFailure.stream !== bareAudioResult.stream) {
      stopStreamSafely(lastFailure.stream);
    }
    lastFailure = bareAudioResult;
  }

  if (preferredResult.stream && preferredResult.stream !== lastFailure.stream) {
    stopStreamSafely(preferredResult.stream);
  }
  if (lastFailure.stream) {
    stopStreamSafely(lastFailure.stream);
  }

  return {
    stream: null,
    status: lastFailure.status,
    requestVariant: lastAttemptVariant,
    fallbackUsed: false,
    warning: null,
    trackDiagnostics: lastFailure.trackDiagnostics,
    rawPeak: lastFailure.rawPeak,
    rawRms: lastFailure.rawRms,
    rawSampleCount: lastFailure.rawSampleCount,
    rawDurationMs: lastFailure.rawDurationMs,
    errorName: lastFailure.errorName,
    errorMessage: lastFailure.errorMessage,
  };
}
