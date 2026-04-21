import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildVoiceChain } from './voiceChain';
import { CAPTURE_MODE_MAP } from './capturePresets';

if (typeof globalThis.MediaStream === 'undefined') {
  (globalThis as any).MediaStream = class MediaStream {
    getTracks() { return []; }
  };
}

function createMockNode(overrides: Record<string, any> = {}): any {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  };
}

function createMockCtx() {
  const mockAnalyser = createMockNode({ fftSize: 1024 });
  const mockGain = createMockNode({ gain: { value: 0 } });
  const mockBiquad = createMockNode({
    type: '',
    frequency: { value: 0 },
    Q: { value: 0 },
    gain: { value: 0 },
  });
  const mockCompressor = createMockNode({
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
  });
  const mockDestination = createMockNode({
    stream: new MediaStream(),
  });

  return {
    ctx: {
      createBiquadFilter: vi.fn().mockReturnValue({ ...mockBiquad }),
      createDynamicsCompressor: vi.fn().mockReturnValue({ ...mockCompressor }),
      createAnalyser: vi.fn().mockReturnValue({ ...mockAnalyser }),
      createGain: vi.fn().mockReturnValue({ ...mockGain }),
      createMediaStreamDestination: vi.fn().mockReturnValue({ ...mockDestination }),
      destination: {},
      audioWorklet: {
        addModule: vi.fn().mockRejectedValue(new Error('Not supported in test')),
      },
    } as unknown as AudioContext,
    source: createMockNode() as unknown as MediaStreamAudioSourceNode,
  };
}

describe('buildVoiceChain', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a chain for basic-clean preset', async () => {
    const { ctx, source } = createMockCtx();
    const preset = CAPTURE_MODE_MAP.get('basic-clean')!;

    const result = await buildVoiceChain(ctx, source, preset);

    expect(result.analyser).toBeDefined();
    expect(result.processedStream).toBeInstanceOf(MediaStream);
    expect(typeof result.dispose).toBe('function');
  });

  it('creates highpass filter with preset frequency', async () => {
    const { ctx, source } = createMockCtx();
    const preset = CAPTURE_MODE_MAP.get('church-mixer')!;

    await buildVoiceChain(ctx, source, preset);

    expect(ctx.createBiquadFilter).toHaveBeenCalled();
  });

  it('creates compressor and limiter nodes', async () => {
    const { ctx, source } = createMockCtx();
    const preset = CAPTURE_MODE_MAP.get('basic-clean')!;

    await buildVoiceChain(ctx, source, preset);

    // compressor + limiter = 2 DynamicsCompressorNodes
    // If presenceGainDb !== 0, also a BiquadFilter for presence EQ
    expect(ctx.createDynamicsCompressor).toHaveBeenCalledTimes(2);
  });

  it('creates presence EQ when presenceGainDb is non-zero', async () => {
    const { ctx, source } = createMockCtx();
    const preset = CAPTURE_MODE_MAP.get('laptop-rescue')!;

    await buildVoiceChain(ctx, source, preset);

    // highpass + presence EQ = 2 BiquadFilters
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(2);
  });

  it('skips presence EQ when presenceGainDb is zero', async () => {
    const { ctx, source } = createMockCtx();
    const preset = CAPTURE_MODE_MAP.get('church-mixer')!;

    await buildVoiceChain(ctx, source, preset);

    // only highpass = 1 BiquadFilter
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(1);
  });

  it('dispose disconnects all nodes without throwing', async () => {
    const { ctx, source } = createMockCtx();
    const preset = CAPTURE_MODE_MAP.get('basic-clean')!;

    const result = await buildVoiceChain(ctx, source, preset);

    expect(() => result.dispose()).not.toThrow();
  });

  it('creates silent sink for Chromium keep-alive', async () => {
    const { ctx, source } = createMockCtx();
    const preset = CAPTURE_MODE_MAP.get('basic-clean')!;

    await buildVoiceChain(ctx, source, preset);

    expect(ctx.createGain).toHaveBeenCalled();
  });

  // Regression: module-level registration flag used to lie across AudioContexts.
  // After stop/restart, the flag persisted but the new context had no processor,
  // causing `new AudioWorkletNode` to throw "AudioWorklet does not exist".
  it('calls addModule on every fresh AudioContext, not just the first', async () => {
    const addModule1 = vi.fn().mockResolvedValue(undefined);
    const ctx1 = {
      ...createMockCtx().ctx,
      audioWorklet: { addModule: addModule1 },
    } as unknown as AudioContext;
    const src1 = createMockNode() as unknown as MediaStreamAudioSourceNode;

    const addModule2 = vi.fn().mockResolvedValue(undefined);
    const ctx2 = {
      ...createMockCtx().ctx,
      audioWorklet: { addModule: addModule2 },
    } as unknown as AudioContext;
    const src2 = createMockNode() as unknown as MediaStreamAudioSourceNode;

    // laptop-rescue has gate.enabled, so addModule should be attempted
    const preset = CAPTURE_MODE_MAP.get('laptop-rescue')!;

    // Without AudioWorkletNode constructor, ensureWorklet still returns true
    // but the node construction falls through the try/catch. That is the
    // guard rail. We only assert addModule is called per-context here.
    (globalThis as any).AudioWorkletNode = class {
      constructor() { throw new Error('AudioWorklet does not exist'); }
    };

    await buildVoiceChain(ctx1, src1, preset);
    await buildVoiceChain(ctx2, src2, preset);

    expect(addModule1).toHaveBeenCalledTimes(1);
    expect(addModule2).toHaveBeenCalledTimes(1);

    delete (globalThis as any).AudioWorkletNode;
  });

  it('does not throw when AudioWorkletNode construction fails', async () => {
    const { ctx, source } = createMockCtx();
    // addModule resolves (worklet "registered") but constructor throws.
    // This mimics the Electron packaging case where the module loads but
    // the processor name is not actually available.
    (ctx.audioWorklet as any).addModule = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).AudioWorkletNode = class {
      constructor() { throw new Error('AudioWorklet does not exist'); }
    };

    const preset = CAPTURE_MODE_MAP.get('basic-clean')!;

    await expect(buildVoiceChain(ctx, source, preset)).resolves.toBeDefined();

    delete (globalThis as any).AudioWorkletNode;
  });

  it('does not throw when audioWorklet API is missing entirely', async () => {
    const { ctx, source } = createMockCtx();
    (ctx as any).audioWorklet = undefined;

    const preset = CAPTURE_MODE_MAP.get('basic-clean')!;

    await expect(buildVoiceChain(ctx, source, preset)).resolves.toBeDefined();
  });
});
