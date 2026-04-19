import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDualRecorder } from './dualRecorder';

interface MockRecorderInstance {
  state: 'inactive' | 'recording' | 'paused';
  mimeType: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  emitData: (blob: Blob) => void;
  fireStop: () => void;
  ctorOpts?: MediaRecorderOptions;
  ctorStream?: MediaStream;
}

const recorderInstances: MockRecorderInstance[] = [];
const ctorCalls: Array<{ stream: unknown; opts?: MediaRecorderOptions }> = [];
let ctorThrowsOnce = false;

class MockMediaRecorder implements MockRecorderInstance {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  start = vi.fn(() => { this.state = 'recording'; });
  stop = vi.fn(() => {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    queueMicrotask(() => { this.onstop?.(); });
  });
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  ctorOpts?: MediaRecorderOptions;
  ctorStream?: MediaStream;

  constructor(stream: MediaStream, opts?: MediaRecorderOptions) {
    ctorCalls.push({ stream, opts });
    if (ctorThrowsOnce) {
      ctorThrowsOnce = false;
      throw new Error('mock ctor failed');
    }
    this.ctorStream = stream;
    this.ctorOpts = opts;
    this.mimeType = opts?.mimeType ?? 'audio/webm';
    recorderInstances.push(this);
  }

  emitData(blob: Blob) {
    this.ondataavailable?.({ data: blob });
  }

  fireStop() {
    if (this.state !== 'inactive') this.state = 'inactive';
    this.onstop?.();
  }
}

const fakeStream = { id: 'fake-stream' } as unknown as MediaStream;

beforeEach(() => {
  recorderInstances.length = 0;
  ctorCalls.length = 0;
  ctorThrowsOnce = false;
  vi.useFakeTimers();
  (globalThis as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder =
    MockMediaRecorder as unknown as typeof MediaRecorder;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createDualRecorder', () => {
  it('returns a handle exposing start, stop, isActive', () => {
    const handle = createDualRecorder({
      stream: fakeStream,
      mimeType: 'audio/webm;codecs=opus',
      segmentMs: 12_000,
      onSegment: () => {},
    });
    expect(typeof handle.start).toBe('function');
    expect(typeof handle.stop).toBe('function');
    expect(typeof handle.isActive).toBe('function');
    expect(handle.isActive()).toBe(false);
  });

  it('start() immediately spawns first segment with supplied stream, mimeType, and bitrate', () => {
    const handle = createDualRecorder({
      stream: fakeStream,
      mimeType: 'audio/webm;codecs=opus',
      segmentMs: 12_000,
      audioBitsPerSecond: 32_000,
      onSegment: () => {},
    });
    handle.start();
    expect(ctorCalls).toHaveLength(1);
    expect(ctorCalls[0].stream).toBe(fakeStream);
    expect(ctorCalls[0].opts).toEqual({
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 32_000,
    });
    expect(recorderInstances[0].start).toHaveBeenCalledTimes(1);
    expect(handle.isActive()).toBe(true);
  });

  it('after segmentMs elapses, stops first recorder and spawns second segment with slotIdx 1', async () => {
    const seen: Array<{ slotIdx: number; size: number }> = [];
    const handle = createDualRecorder({
      stream: fakeStream,
      mimeType: 'audio/webm;codecs=opus',
      segmentMs: 12_000,
      onSegment: (blob, slotIdx) => seen.push({ slotIdx, size: blob.size }),
    });
    handle.start();
    const first = recorderInstances[0];
    first.emitData(new Blob([new Uint8Array(2048)], { type: 'audio/webm' }));

    vi.advanceTimersByTime(12_000);
    expect(first.stop).toHaveBeenCalledTimes(1);

    // Flush the queued onstop microtask; spawn() inside it creates the next recorder.
    await Promise.resolve();
    await Promise.resolve();
    handle.stop();

    expect(recorderInstances).toHaveLength(2);
    expect(seen[0].slotIdx).toBe(0);
    expect(seen[0].size).toBeGreaterThan(0);
  });

  it('stop() cancels the pending timer and stops the in-flight recorder', () => {
    const handle = createDualRecorder({
      stream: fakeStream,
      mimeType: 'audio/webm;codecs=opus',
      segmentMs: 12_000,
      onSegment: () => {},
    });
    handle.start();
    expect(recorderInstances).toHaveLength(1);
    handle.stop();
    expect(recorderInstances[0].stop).toHaveBeenCalled();
    expect(handle.isActive()).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(recorderInstances).toHaveLength(1);
  });

  it('falls back to constructor without bitrate when first attempt throws', () => {
    ctorThrowsOnce = true;
    const handle = createDualRecorder({
      stream: fakeStream,
      mimeType: 'audio/webm;codecs=opus',
      segmentMs: 12_000,
      audioBitsPerSecond: 32_000,
      onSegment: () => {},
    });
    handle.start();
    expect(ctorCalls).toHaveLength(2);
    expect(ctorCalls[0].opts).toMatchObject({ audioBitsPerSecond: 32_000 });
    expect(ctorCalls[1].opts).toEqual({ mimeType: 'audio/webm;codecs=opus' });
    expect(recorderInstances).toHaveLength(1);
    handle.stop();
  });

  it('emits a Blob assembled from all dataavailable chunks for the segment', async () => {
    const seen: Blob[] = [];
    const handle = createDualRecorder({
      stream: fakeStream,
      mimeType: 'audio/webm;codecs=opus',
      segmentMs: 12_000,
      onSegment: (blob) => seen.push(blob),
    });
    handle.start();
    const first = recorderInstances[0];
    first.emitData(new Blob([new Uint8Array(1000)], { type: 'audio/webm' }));
    first.emitData(new Blob([new Uint8Array(500)], { type: 'audio/webm' }));

    vi.advanceTimersByTime(12_000);
    await Promise.resolve();
    await Promise.resolve();
    handle.stop();

    expect(seen).toHaveLength(1);
    expect(seen[0].size).toBe(1500);
  });

  it('drops the segment silently if MediaRecorder ctor fails entirely (no fallback)', () => {
    ctorThrowsOnce = true;
    (globalThis as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder =
      class extends MockMediaRecorder {
        constructor(s: MediaStream, o?: MediaRecorderOptions) {
          super(s, o);
        }
      } as unknown as typeof MediaRecorder;

    const handle = createDualRecorder({
      stream: fakeStream,
      mimeType: 'audio/webm;codecs=opus',
      segmentMs: 12_000,
      onSegment: () => {},
    });
    expect(() => handle.start()).not.toThrow();
    handle.stop();
  });
});
