import {
  transcribeSermonChunk,
  type TranscribeSermonChunkRequest,
  type TranscribeSermonChunkResult,
} from '../geminiService';
import {
  CAPTURE_MODE_MAP,
  DEFAULT_CAPTURE_MODE,
  type CaptureModeId,
  type CaptureModePreset,
} from './capturePresets';
import { buildVoiceChain, type VoiceChainNodes } from './voiceChain';
import { createDualRecorder, type DualRecorderHandle } from './dualRecorder';
import {
  createAudioInputDiagnostic,
  probeAudioInput,
  type AudioInputDiagnostic,
  type AudioInputProbeResult,
} from './mediaDiagnostics';

const MIN_SEGMENT_BYTES = 8 * 1024;
const MAX_SEGMENT_BASE64_BYTES = 1_400_000;
const DEFAULT_SEGMENT_MS = 12_000;
const DEFAULT_BITRATE = 32_000;
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const;

const META_TRANSCRIPT_PATTERNS: RegExp[] = [
  /\bno discernible speech\b/i,
  /\bno clearly audible speech\b/i,
  /\bno audible speech\b/i,
  /\bno speech detected\b/i,
  /\bthere (?:is|are) no spoken words\b/i,
  /\bno spoken words\b/i,
  /\bno audio (?:detected|provided|available)\b/i,
  /\bcannot transcribe\b/i,
  /\bunable to transcribe\b/i,
  /\bfailed to transcribe\b/i,
  /\bspeech could not be detected\b/i,
  /\bbackground noise\b/i,
  /\bthere (?:is|are) no\b.*\bspeech\b/i,
  /\[\s*(?:silence|inaudible|background noise)\s*\]/i,
  /^\s*(?:silence|inaudible|background noise)\s*$/i,
];

type SupportedMimeType = TranscribeSermonChunkRequest['mimeType'];

export type CloudListenerState = 'idle' | 'starting' | 'listening' | 'cooldown' | 'error';

export type CloudListenerErrorKind = 'mic' | 'recorder' | 'network' | 'cooldown';

export interface CloudListenerError {
  kind: CloudListenerErrorKind;
  message: string;
  retryAfterMs?: number;
}

export interface CloudListenerOptions {
  audioDeviceId?: string;
  selectedAudioDeviceId?: string;
  captureMode?: CaptureModeId;
  locale: 'en-US' | 'en-GB';
  accentHint?: string;
  segmentMs?: number;
  audioBitsPerSecond?: number;
  workspaceId?: string;
  sessionId?: string;
  clientId?: string;
  onTranscript: (text: string, slotIdx: number) => void;
  onError?: (err: CloudListenerError) => void;
}

export interface CloudListenerHandle {
  start: () => Promise<boolean>;
  stop: () => void;
  getState: () => CloudListenerState;
  getCumulativeTranscript: () => string;
  getInputDiagnostic: () => AudioInputDiagnostic | null;
  onChange: (listener: () => void) => () => void;
}

export interface CloudListenerDeps {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext: (options?: AudioContextOptions) => AudioContext;
  buildVoiceChain: typeof buildVoiceChain;
  createDualRecorder: typeof createDualRecorder;
  transcribeChunk: typeof transcribeSermonChunk;
  blobToBase64: (blob: Blob) => Promise<string>;
  now: () => number;
  pickMimeType?: () => SupportedMimeType;
  probeAudioInput?: typeof probeAudioInput;
}

function defaultPickMimeType(): SupportedMimeType {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm;codecs=opus';
  for (const candidate of PREFERRED_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported?.(candidate)) {
        return candidate;
      }
    } catch {
      /* ignore */
    }
  }
  return 'audio/webm;codecs=opus';
}

async function defaultBlobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    const buf = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export function defaultCloudListenerDeps(): CloudListenerDeps {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createAudioContext: (options) => new AudioContext(options),
    buildVoiceChain,
    createDualRecorder,
    transcribeChunk: transcribeSermonChunk,
    blobToBase64: defaultBlobToBase64,
    now: () => Date.now(),
    pickMimeType: defaultPickMimeType,
    probeAudioInput,
  };
}

function resolvePreset(modeId: CaptureModeId | undefined): CaptureModePreset {
  const id = modeId ?? DEFAULT_CAPTURE_MODE;
  return CAPTURE_MODE_MAP.get(id) ?? CAPTURE_MODE_MAP.get(DEFAULT_CAPTURE_MODE)!;
}

function stopStreamSafely(stream: MediaStream | null): void {
  if (!stream) return;
  try {
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch { /* no-op */ }
    }
  } catch {
    /* no-op */
  }
}

function buildProbeFailureMessage(probe: AudioInputProbeResult): string {
  if (probe.warning) return probe.warning;
  if (probe.status === 'request-failed') {
    return probe.errorMessage || 'Could not access microphone.';
  }
  if (probe.status === 'muted-live') {
    return 'The selected microphone returned a live but muted track. Try another source.';
  }
  if (probe.status === 'ended') {
    return 'The selected microphone ended before Lumina could start listening.';
  }
  return 'The selected microphone produced no usable audio samples.';
}

export function sanitizeCloudTranscriptText(raw: string): string {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

export function filterCloudTranscriptText(raw: string): string | null {
  const normalized = sanitizeCloudTranscriptText(raw);
  if (!normalized) return null;
  if (META_TRANSCRIPT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return null;
  }
  return normalized;
}

export function createCloudListener(
  opts: CloudListenerOptions,
  depsOverride?: Partial<CloudListenerDeps>,
): CloudListenerHandle {
  const deps: CloudListenerDeps = { ...defaultCloudListenerDeps(), ...depsOverride };
  const segmentMs = opts.segmentMs ?? DEFAULT_SEGMENT_MS;
  const audioBitsPerSecond = opts.audioBitsPerSecond ?? DEFAULT_BITRATE;
  const pickMime = deps.pickMimeType ?? defaultPickMimeType;
  const probeInput = deps.probeAudioInput ?? probeAudioInput;

  let state: CloudListenerState = 'idle';
  let cumulative = '';
  let cooldownUntil = 0;
  const segments: string[] = [];
  const subscribers = new Set<() => void>();

  let micStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let voiceChain: VoiceChainNodes | null = null;
  let recorder: DualRecorderHandle | null = null;
  let mimeType: SupportedMimeType = 'audio/webm;codecs=opus';
  let inputDiagnostic: AudioInputDiagnostic | null = null;

  function emitChange(): void {
    for (const listener of subscribers) {
      try { listener(); } catch { /* swallow listener errors */ }
    }
  }

  function setState(next: CloudListenerState): void {
    if (state === next) return;
    state = next;
    emitChange();
  }

  function setInputDiagnostic(next: AudioInputDiagnostic | null): void {
    inputDiagnostic = next;
    emitChange();
  }

  function rebuildCumulative(): void {
    cumulative = segments.filter(Boolean).join(' ');
  }

  function resetTranscriptState(): void {
    segments.length = 0;
    cumulative = '';
    cooldownUntil = 0;
  }

  function reportError(err: CloudListenerError): void {
    try { opts.onError?.(err); } catch { /* swallow consumer errors */ }
  }

  async function handleSegment(blob: Blob, slotIdx: number): Promise<void> {
    if (blob.size < MIN_SEGMENT_BYTES) return;
    const estBase64 = Math.ceil((blob.size * 4) / 3);
    if (estBase64 > MAX_SEGMENT_BASE64_BYTES) return;
    if (deps.now() < cooldownUntil) return;

    let audioBase64: string;
    try {
      audioBase64 = await deps.blobToBase64(blob);
    } catch (err) {
      reportError({ kind: 'recorder', message: err instanceof Error ? err.message : 'Failed to encode segment' });
      return;
    }

    let result: TranscribeSermonChunkResult;
    try {
      result = await deps.transcribeChunk({
        audioBase64,
        mimeType,
        locale: opts.locale,
        accentHint: opts.accentHint,
        workspaceId: opts.workspaceId,
        sessionId: opts.sessionId,
        clientId: opts.clientId,
      });
    } catch (err) {
      reportError({ kind: 'network', message: err instanceof Error ? err.message : 'Transcription request failed' });
      return;
    }

    if (result.mode === 'success') {
      const acceptedText = filterCloudTranscriptText(result.transcript);
      if (acceptedText) {
        segments[slotIdx] = acceptedText;
        rebuildCumulative();
        try { opts.onTranscript(acceptedText, slotIdx); } catch { /* swallow consumer errors */ }
        emitChange();
      }
      if (state === 'cooldown' && deps.now() >= cooldownUntil) {
        setState('listening');
      }
      return;
    }

    if (result.mode === 'cooldown') {
      cooldownUntil = deps.now() + (result.retryAfterMs > 0 ? result.retryAfterMs : 0);
      setState('cooldown');
      reportError({ kind: 'cooldown', message: result.message, retryAfterMs: result.retryAfterMs });
      return;
    }

    reportError({ kind: 'network', message: result.message });
  }

  async function start(): Promise<boolean> {
    if (state === 'starting' || state === 'listening' || state === 'cooldown') {
      return true;
    }

    resetTranscriptState();
    setInputDiagnostic(null);
    setState('starting');

    const preset = resolvePreset(opts.captureMode);
    const probe = await probeInput({
      deviceId: opts.audioDeviceId,
      preset,
      mode: 'listening',
      strictRawSignal: false,
    });
    setInputDiagnostic(
      createAudioInputDiagnostic('listening', opts.selectedAudioDeviceId ?? opts.audioDeviceId, probe),
    );

    if (!probe.stream || probe.status !== 'usable') {
      setState('error');
      reportError({ kind: 'mic', message: buildProbeFailureMessage(probe) });
      return false;
    }

    micStream = probe.stream;

    try {
      audioContext = deps.createAudioContext({ sampleRate: 48_000 } as AudioContextOptions);
      const source = audioContext.createMediaStreamSource(micStream);
      voiceChain = await deps.buildVoiceChain(audioContext, source, preset);
    } catch (err) {
      releaseResources();
      setState('error');
      reportError({ kind: 'recorder', message: err instanceof Error ? err.message : 'Voice chain init failed' });
      return false;
    }

    mimeType = pickMime();

    try {
      recorder = deps.createDualRecorder({
        stream: voiceChain.processedStream,
        mimeType,
        segmentMs,
        audioBitsPerSecond,
        onSegment: (blob, slotIdx) => { void handleSegment(blob, slotIdx); },
      });
      recorder.start();
    } catch (err) {
      releaseResources();
      setState('error');
      reportError({ kind: 'recorder', message: err instanceof Error ? err.message : 'Recorder failed to start' });
      return false;
    }

    setState('listening');
    return true;
  }

  function releaseResources(): void {
    if (recorder) {
      try { recorder.stop(); } catch { /* no-op */ }
      recorder = null;
    }
    if (voiceChain) {
      try { voiceChain.dispose(); } catch { /* no-op */ }
      voiceChain = null;
    }
    if (audioContext) {
      try { void audioContext.close(); } catch { /* no-op */ }
      audioContext = null;
    }
    stopStreamSafely(micStream);
    micStream = null;
  }

  function stop(): void {
    if (state === 'idle') return;
    releaseResources();
    resetTranscriptState();
    setInputDiagnostic(null);
    setState('idle');
  }

  return {
    start,
    stop,
    getState: () => state,
    getCumulativeTranscript: () => cumulative,
    getInputDiagnostic: () => inputDiagnostic,
    onChange(listener: () => void): () => void {
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },
  };
}
