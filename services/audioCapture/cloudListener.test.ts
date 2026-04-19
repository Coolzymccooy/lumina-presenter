import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCloudListener,
  filterCloudTranscriptText,
  type CloudListenerDeps,
} from './cloudListener';
import type { TranscribeSermonChunkResult } from '../geminiService';
import type { AudioInputProbeResult } from './mediaDiagnostics';

interface FakeTrack {
  stop: ReturnType<typeof vi.fn>;
  kind: string;
  readyState: 'live' | 'ended';
}

function makeFakeStream(): { stream: MediaStream; tracks: FakeTrack[] } {
  const tracks: FakeTrack[] = [
    { stop: vi.fn(function (this: FakeTrack) { this.readyState = 'ended'; }), kind: 'audio', readyState: 'live' },
  ];
  const stream = {
    id: 'fake-mic-stream',
    getTracks: () => tracks,
    getAudioTracks: () => tracks,
  } as unknown as MediaStream;
  return { stream, tracks };
}

function makeFakeProcessedStream(): MediaStream {
  return { id: 'processed-stream', getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream;
}

interface FakeAudioContext {
  state: 'running' | 'closed';
  close: ReturnType<typeof vi.fn>;
  createMediaStreamSource: ReturnType<typeof vi.fn>;
}

function makeFakeAudioContext(): FakeAudioContext {
  const ctx: FakeAudioContext = {
    state: 'running',
    close: vi.fn(async function (this: FakeAudioContext) { this.state = 'closed'; }),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }) as unknown as MediaStreamAudioSourceNode),
  };
  return ctx;
}

interface DualRecorderStub {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  isActive: ReturnType<typeof vi.fn>;
  emit: (blob: Blob) => Promise<void>;
}

function makeUsableProbeResult(stream: MediaStream, overrides: Partial<AudioInputProbeResult> = {}): AudioInputProbeResult {
  return {
    stream,
    status: 'usable',
    requestVariant: 'preferred',
    fallbackUsed: false,
    warning: null,
    trackDiagnostics: [{
      label: 'Microphone Array (AMD Audio Device)',
      enabled: true,
      muted: false,
      readyState: 'live',
      settings: { sampleRate: 48000, deviceId: 'resolved-device' },
      constraints: {},
      capabilities: null,
    }],
    rawPeak: 0.25,
    rawRms: 0.04,
    rawSampleCount: 2048,
    rawDurationMs: 700,
    errorName: null,
    errorMessage: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CloudListenerDeps> = {}): {
  deps: CloudListenerDeps;
  audioContext: FakeAudioContext;
  voiceChainDispose: ReturnType<typeof vi.fn>;
  transcribeChunk: ReturnType<typeof vi.fn>;
  recorder: DualRecorderStub;
  micStream: { stream: MediaStream; tracks: FakeTrack[] };
  probeAudioInputMock: ReturnType<typeof vi.fn>;
} {
  const micStream = makeFakeStream();
  const audioContext = makeFakeAudioContext();
  const voiceChainDispose = vi.fn();

  let onSegmentRef: ((blob: Blob, slotIdx: number) => void) | null = null;
  let nextSlot = 0;

  const recorder: DualRecorderStub = {
    start: vi.fn(),
    stop: vi.fn(),
    isActive: vi.fn(() => true),
    emit: async (blob: Blob) => {
      if (onSegmentRef) {
        onSegmentRef(blob, nextSlot++);
        await Promise.resolve();
        await Promise.resolve();
      }
    },
  };

  const transcribeChunk = vi.fn(async (): Promise<TranscribeSermonChunkResult> => ({
    ok: true,
    mode: 'success',
    transcript: 'hello world',
    locale: 'en-US',
    retryAfterMs: 0,
  }));

  const probeAudioInputMock = vi.fn(async () => makeUsableProbeResult(micStream.stream));

  const deps: CloudListenerDeps = {
    createAudioContext: vi.fn(() => audioContext as unknown as AudioContext),
    buildVoiceChain: vi.fn(async () => ({
      analyser: { fftSize: 1024 } as unknown as AnalyserNode,
      processedStream: makeFakeProcessedStream(),
      dispose: voiceChainDispose,
    })),
    createDualRecorder: vi.fn((opts) => {
      onSegmentRef = opts.onSegment;
      nextSlot = 0;
      return {
        start: () => (recorder.start as unknown as () => void)(),
        stop: () => (recorder.stop as unknown as () => void)(),
        isActive: () => (recorder.isActive as unknown as () => boolean)(),
      };
    }),
    transcribeChunk,
    blobToBase64: vi.fn(async () => 'base64data'),
    now: vi.fn(() => 1_000_000),
    probeAudioInput: probeAudioInputMock,
    ...overrides,
  };

  return { deps, audioContext, voiceChainDispose, transcribeChunk, recorder, micStream, probeAudioInputMock };
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('filterCloudTranscriptText', () => {
  it('drops empty and silence/meta responses', () => {
    expect(filterCloudTranscriptText('')).toBeNull();
    expect(filterCloudTranscriptText('   [Silence]   ')).toBeNull();
    expect(filterCloudTranscriptText('There is no discernible speech in the provided audio.')).toBeNull();
    expect(filterCloudTranscriptText('No speech detected in this audio segment.')).toBeNull();
  });

  it('preserves real spoken transcript text', () => {
    expect(filterCloudTranscriptText(' Romans 8:28 ')).toBe('Romans 8:28');
  });
});

describe('createCloudListener', () => {
  it('returns a handle exposing start, stop, getState, getCumulativeTranscript, getInputDiagnostic, and onChange', () => {
    const { deps } = makeDeps();
    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: () => {},
    }, deps);
    expect(typeof listener.start).toBe('function');
    expect(typeof listener.stop).toBe('function');
    expect(typeof listener.getState).toBe('function');
    expect(typeof listener.getCumulativeTranscript).toBe('function');
    expect(typeof listener.getInputDiagnostic).toBe('function');
    expect(typeof listener.onChange).toBe('function');
    expect(listener.getState()).toBe('idle');
    expect(listener.getCumulativeTranscript()).toBe('');
    expect(listener.getInputDiagnostic()).toBeNull();
  });

  it('start() resolves true, probes input, and transitions state idle -> starting -> listening', async () => {
    const { deps, probeAudioInputMock } = makeDeps();
    const states: string[] = [];
    const listener = createCloudListener({
      locale: 'en-US',
      selectedAudioDeviceId: 'selected-device',
      onTranscript: () => {},
    }, deps);
    listener.onChange(() => states.push(listener.getState()));

    const ok = await listener.start();
    expect(ok).toBe(true);
    expect(states).toContain('starting');
    expect(listener.getState()).toBe('listening');
    expect(probeAudioInputMock).toHaveBeenCalledOnce();
    expect(listener.getInputDiagnostic()?.phase).toBe('listening');
    expect(listener.getInputDiagnostic()?.settingsDeviceId).toBe('resolved-device');
  });

  it('each accepted segment triggers onTranscript exactly once with the transcript text', async () => {
    const { deps, recorder } = makeDeps();
    const seen: string[] = [];
    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: (text) => seen.push(text),
    }, deps);
    await listener.start();

    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));
    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));

    expect(seen).toEqual(['hello world', 'hello world']);
    expect(listener.getCumulativeTranscript()).toBe('hello world hello world');
  });

  it('drops silence/meta Gemini replies without updating transcript state', async () => {
    const { deps, transcribeChunk, recorder } = makeDeps();
    transcribeChunk.mockResolvedValueOnce({
      ok: true,
      mode: 'success',
      transcript: 'There is no discernible speech in the provided audio. [Silence]',
      locale: 'en-US',
      retryAfterMs: 0,
    } as TranscribeSermonChunkResult);

    const seen: string[] = [];
    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: (text) => seen.push(text),
    }, deps);
    await listener.start();

    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));

    expect(seen).toEqual([]);
    expect(listener.getCumulativeTranscript()).toBe('');
  });

  it('drops segments smaller than 8KB without calling transcribe', async () => {
    const { deps, transcribeChunk, recorder } = makeDeps();
    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: () => {},
    }, deps);
    await listener.start();

    await recorder.emit(new Blob([new Uint8Array(500)], { type: 'audio/webm' }));
    expect(transcribeChunk).not.toHaveBeenCalled();
  });

  it('cooldown response calls onError(kind=cooldown) and drops subsequent segments during cooldown window', async () => {
    let nowValue = 1_000_000;
    const { deps, transcribeChunk, recorder } = makeDeps({
      now: vi.fn(() => nowValue),
    });

    transcribeChunk
      .mockResolvedValueOnce({
        ok: false,
        mode: 'cooldown',
        retryAfterMs: 30_000,
        error: 'TRANSCRIBE_COOLDOWN',
        message: 'Cooling down',
      } as TranscribeSermonChunkResult)
      .mockResolvedValueOnce({
        ok: true,
        mode: 'success',
        transcript: 'should not arrive',
        locale: 'en-US',
        retryAfterMs: 0,
      } as TranscribeSermonChunkResult);

    const errors: Array<{ kind: string; retryAfterMs?: number }> = [];
    const transcripts: string[] = [];
    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: (text) => transcripts.push(text),
      onError: (err) => errors.push({ kind: err.kind, retryAfterMs: err.retryAfterMs }),
    }, deps);
    await listener.start();

    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe('cooldown');
    expect(errors[0].retryAfterMs).toBe(30_000);
    expect(listener.getState()).toBe('cooldown');

    nowValue += 5_000;
    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));
    expect(transcribeChunk).toHaveBeenCalledTimes(1);
    expect(transcripts).toHaveLength(0);
  });

  it('resumes transcribing after cooldown window expires', async () => {
    let nowValue = 1_000_000;
    const { deps, transcribeChunk, recorder } = makeDeps({
      now: vi.fn(() => nowValue),
    });

    transcribeChunk
      .mockResolvedValueOnce({
        ok: false,
        mode: 'cooldown',
        retryAfterMs: 1_000,
        error: 'TRANSCRIBE_COOLDOWN',
        message: 'Cooling down',
      } as TranscribeSermonChunkResult)
      .mockResolvedValueOnce({
        ok: true,
        mode: 'success',
        transcript: 'after cooldown',
        locale: 'en-US',
        retryAfterMs: 0,
      } as TranscribeSermonChunkResult);

    const transcripts: string[] = [];
    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: (text) => transcripts.push(text),
    }, deps);
    await listener.start();

    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));
    nowValue += 2_000;
    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));

    expect(transcribeChunk).toHaveBeenCalledTimes(2);
    expect(transcripts).toEqual(['after cooldown']);
    expect(listener.getState()).toBe('listening');
  });

  it('stop() invokes recorder.stop, voiceChain.dispose, ctx.close once, stops mic tracks, and clears inputDiagnostic', async () => {
    const { deps, audioContext, voiceChainDispose, recorder, micStream } = makeDeps();
    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: () => {},
    }, deps);
    await listener.start();

    listener.stop();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(voiceChainDispose).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
    expect(micStream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(listener.getState()).toBe('idle');
    expect(listener.getInputDiagnostic()).toBeNull();

    listener.stop();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(audioContext.close).toHaveBeenCalledOnce();
  });

  it('out-of-order resolution preserves slot-order join in cumulativeTranscript', async () => {
    const { deps, transcribeChunk, recorder } = makeDeps();

    let resolveSlot0!: (value: TranscribeSermonChunkResult) => void;
    let resolveSlot1!: (value: TranscribeSermonChunkResult) => void;
    const slot0 = new Promise<TranscribeSermonChunkResult>((resolve) => { resolveSlot0 = resolve; });
    const slot1 = new Promise<TranscribeSermonChunkResult>((resolve) => { resolveSlot1 = resolve; });
    transcribeChunk.mockReturnValueOnce(slot0).mockReturnValueOnce(slot1);

    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: () => {},
    }, deps);
    await listener.start();

    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));
    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));

    resolveSlot1({ ok: true, mode: 'success', transcript: 'second', locale: 'en-US', retryAfterMs: 0 } as TranscribeSermonChunkResult);
    await Promise.resolve();
    await Promise.resolve();

    resolveSlot0({ ok: true, mode: 'success', transcript: 'first', locale: 'en-US', retryAfterMs: 0 } as TranscribeSermonChunkResult);
    await Promise.resolve();
    await Promise.resolve();

    expect(listener.getCumulativeTranscript()).toBe('first second');
  });

  it('probe failure sets state=error, fires onError(kind=mic), and keeps the diagnostic', async () => {
    const { deps, probeAudioInputMock } = makeDeps();
    probeAudioInputMock.mockResolvedValueOnce(makeUsableProbeResult(null as unknown as MediaStream, {
      stream: null,
      status: 'request-failed',
      trackDiagnostics: [],
      errorName: 'NotAllowedError',
      errorMessage: 'Permission denied',
    }));

    const errors: Array<{ kind: string; message: string }> = [];
    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: () => {},
      onError: (err) => errors.push({ kind: err.kind, message: err.message }),
    }, deps);

    const ok = await listener.start();
    expect(ok).toBe(false);
    expect(listener.getState()).toBe('error');
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe('mic');
    expect(errors[0].message).toContain('Permission denied');
    expect(listener.getInputDiagnostic()?.status).toBe('request-failed');
  });

  it('terminal_error response calls onError(kind=network) but stays in listening state', async () => {
    const { deps, transcribeChunk, recorder } = makeDeps();
    transcribeChunk.mockResolvedValueOnce({
      ok: false,
      mode: 'terminal_error',
      retryAfterMs: 0,
      error: 'TRANSCRIBE_FAILED',
      message: 'Server unreachable',
    } as TranscribeSermonChunkResult);

    const errors: Array<{ kind: string }> = [];
    const listener = createCloudListener({
      locale: 'en-US',
      onTranscript: () => {},
      onError: (err) => errors.push({ kind: err.kind }),
    }, deps);
    await listener.start();

    await recorder.emit(new Blob([new Uint8Array(20_000)], { type: 'audio/webm' }));
    expect(errors[0].kind).toBe('network');
    expect(listener.getState()).toBe('listening');
  });
});
