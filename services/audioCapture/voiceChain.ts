import type { CaptureModePreset } from './capturePresets';
// Vite resolves `?url` to a stable runtime URL that survives Electron packaging,
// unlike `new URL(..., import.meta.url)` which breaks under file:// protocol.
import noiseGateWorkletUrl from './worklets/noise-gate-worklet.js?url';

export interface VoiceChainNodes {
  analyser: AnalyserNode;
  processedStream: MediaStream;
  dispose(): void;
}

let workletRegistered = false;

async function ensureWorklet(ctx: AudioContext): Promise<boolean> {
  if (workletRegistered) return true;
  try {
    await ctx.audioWorklet.addModule(noiseGateWorkletUrl);
    workletRegistered = true;
    return true;
  } catch {
    return false;
  }
}

export async function buildVoiceChain(
  ctx: AudioContext,
  source: MediaStreamAudioSourceNode,
  preset: CaptureModePreset,
): Promise<VoiceChainNodes> {
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => undefined);
  }

  const nodes: AudioNode[] = [];

  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = preset.highPassHz;
  hpf.Q.value = 0.7;
  nodes.push(hpf);

  let gateNode: AudioWorkletNode | null = null;
  if (preset.gate.enabled) {
    const hasWorklet = await ensureWorklet(ctx);
    if (hasWorklet) {
      gateNode = new AudioWorkletNode(ctx, 'noise-gate-processor', {
        processorOptions: {
          thresholdDb: preset.gate.thresholdDb,
          ratio: preset.gate.ratio,
          releaseMs: preset.gate.releaseMs,
        },
      });
      nodes.push(gateNode);
    }
  }

  let presenceEq: BiquadFilterNode | null = null;
  if (preset.presenceGainDb !== 0) {
    presenceEq = ctx.createBiquadFilter();
    presenceEq.type = 'peaking';
    presenceEq.frequency.value = preset.presenceFreq;
    presenceEq.gain.value = preset.presenceGainDb;
    presenceEq.Q.value = 1.0;
    nodes.push(presenceEq);
  }

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 8;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  nodes.push(compressor);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = preset.limiterCeilingDb;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  nodes.push(limiter);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  nodes.push(analyser);

  // Wire the chain: source → hpf → [gate] → [presenceEq] → compressor → limiter → analyser
  source.connect(nodes[0]);
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].connect(nodes[i + 1]);
  }

  // Chromium keep-alive: silent sink to ctx.destination
  const silentSink = ctx.createGain();
  silentSink.gain.value = 0;
  analyser.connect(silentSink);
  silentSink.connect(ctx.destination);

  // Processed output for MediaRecorder
  const destination = ctx.createMediaStreamDestination();
  limiter.connect(destination);
  const processedStream = destination.stream;

  return {
    analyser,
    processedStream,
    dispose() {
      try { source.disconnect(); } catch { /* no-op */ }
      for (const n of nodes) {
        try { n.disconnect(); } catch { /* no-op */ }
      }
      try { silentSink.disconnect(); } catch { /* no-op */ }
      try { destination.disconnect(); } catch { /* no-op */ }
    },
  };
}
