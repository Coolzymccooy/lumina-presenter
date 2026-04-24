import { describe, expect, it } from 'vitest';
import {
  describePayloadType,
  extractConsoleMessageText,
  normalizeAudioPcmPayload,
} from './ndiIpcUtils.cjs';

describe('extractConsoleMessageText', () => {
  it('reads the current Electron details event object', () => {
    expect(extractConsoleMessageText({ message: '[NDI-AUDIO] ready', level: 'info' })).toBe('[NDI-AUDIO] ready');
  });

  it('prefers Electron console-message callback args', () => {
    expect(extractConsoleMessageText({}, 1, '[NDI-AUDIO] ready')).toBe('[NDI-AUDIO] ready');
  });

  it('falls back to a string second arg for lightweight emitters', () => {
    expect(extractConsoleMessageText({}, '[OUTPUT] pick slide=abc')).toBe('[OUTPUT] pick slide=abc');
  });
});

describe('normalizeAudioPcmPayload', () => {
  it('accepts ArrayBuffer payloads', () => {
    const pcm = new Float32Array([0.1, -0.1, 0.2, -0.2]).buffer;
    const buffer = normalizeAudioPcmPayload(pcm);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer?.byteLength).toBe(16);
  });

  it('accepts typed-array views without widening past the slice', () => {
    const full = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const view = full.subarray(2, 5);
    const buffer = normalizeAudioPcmPayload(view);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(Array.from(buffer ?? [])).toEqual([3, 4, 5]);
  });

  it('passes Buffers through unchanged', () => {
    const pcm = Buffer.from([7, 8, 9]);
    expect(normalizeAudioPcmPayload(pcm)).toBe(pcm);
  });

  it('rejects unsupported payloads', () => {
    expect(normalizeAudioPcmPayload('bad')).toBeNull();
    expect(normalizeAudioPcmPayload(null)).toBeNull();
  });
});

describe('describePayloadType', () => {
  it('reports useful constructor names for diagnostics', () => {
    expect(describePayloadType(Buffer.from([1]))).toBe('Buffer');
    expect(describePayloadType(new Uint8Array([1]))).toBe('Uint8Array');
    expect(describePayloadType(new ArrayBuffer(4))).toBe('ArrayBuffer');
    expect(describePayloadType(null)).toBe('null');
  });
});
