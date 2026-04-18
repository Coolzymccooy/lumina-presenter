import type { CaptureModePreset } from './capturePresets';

export type RecordCheckVerdict = 'good' | 'low-signal' | 'too-noisy' | 'no-signal' | 'clipping';

export interface RecordCheckResult {
  verdict: RecordCheckVerdict;
  rmsDb: number;
  peakDb: number;
  noiseFloorDb: number;
  clipFrames: number;
  speechLikelihood: number;
  qualityScore: number;
  suggestion: string;
}

function toDb(linear: number): number {
  return linear <= 0 ? -Infinity : 20 * Math.log10(linear);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function verdictSuggestion(verdict: RecordCheckVerdict): string {
  switch (verdict) {
    case 'good':
      return 'Sounds great — you\'re good to record.';
    case 'low-signal':
      return 'Signal is very quiet. Move closer to the speaker or pick the mixer feed.';
    case 'too-noisy':
      return 'Too much background noise. Try a different mic or reduce room noise.';
    case 'no-signal':
      return 'No audio detected. Check that the mic is connected and not muted.';
    case 'clipping':
      return 'Audio is clipping — turn down the input gain or move the mic further away.';
  }
}

function pickMimeType(): string {
  for (const mime of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

function analysePcm(
  samples: Float32Array,
  sampleRate: number,
  durationMs: number,
): Omit<RecordCheckResult, 'suggestion'> {
  const frameSize = 2048;
  const rmsValues: number[] = [];
  let peakOverall = 0;
  let clipFrames = 0;
  let speechFrames = 0;
  let totalFrames = 0;

  for (let offset = 0; offset + frameSize <= samples.length; offset += frameSize) {
    let sumSq = 0;
    let framePeak = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = Math.abs(samples[offset + i]);
      sumSq += samples[offset + i] * samples[offset + i];
      if (s > framePeak) framePeak = s;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    rmsValues.push(rms);
    if (framePeak > peakOverall) peakOverall = framePeak;
    if (framePeak >= 0.99) clipFrames++;

    // Speech estimation via zero-crossing rate (200-3500 Hz range)
    let zeroCrossings = 0;
    for (let i = 1; i < frameSize; i++) {
      if ((samples[offset + i] >= 0) !== (samples[offset + i - 1] >= 0)) zeroCrossings++;
    }
    const zcRate = zeroCrossings / 2;
    const estimatedFreq = (zcRate * sampleRate) / frameSize;
    if (estimatedFreq >= 200 && estimatedFreq <= 3500 && rms > 0.001) {
      speechFrames++;
    }
    totalFrames++;
  }

  const sortedRms = [...rmsValues].sort((a, b) => a - b);
  const avgRms = rmsValues.length > 0
    ? rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length
    : 0;
  const noiseFloor = percentile(sortedRms, 0.1);
  const rmsDb = toDb(avgRms);
  const peakDb = toDb(peakOverall);
  const noiseFloorDb = toDb(noiseFloor);
  const speechLikelihood = totalFrames > 0 ? speechFrames / totalFrames : 0;

  let verdict: RecordCheckVerdict;
  if (clipFrames > durationMs / 100) {
    verdict = 'clipping';
  } else if (peakDb < -55) {
    verdict = 'no-signal';
  } else if (rmsDb - noiseFloorDb < 6) {
    verdict = 'too-noisy';
  } else if (rmsDb < -45) {
    verdict = 'low-signal';
  } else {
    verdict = 'good';
  }

  const snr = Math.max(0, rmsDb - noiseFloorDb);
  const qualityScore = Math.min(1, Math.max(0,
    (snr / 30) * 0.4 +
    speechLikelihood * 0.3 +
    (1 - Math.min(clipFrames / 10, 1)) * 0.15 +
    (peakDb > -55 ? 0.15 : 0),
  ));

  return { verdict, rmsDb, peakDb, noiseFloorDb, clipFrames, speechLikelihood, qualityScore };
}

export async function analyseStream(
  stream: MediaStream,
  _preset: CaptureModePreset,
  durationMs = 4000,
  signal?: AbortSignal,
): Promise<RecordCheckResult> {
  const tracks = stream.getAudioTracks();
  if (tracks.length === 0 || tracks.every((t) => t.readyState === 'ended')) {
    return {
      verdict: 'no-signal',
      rmsDb: -Infinity,
      peakDb: -Infinity,
      noiseFloorDb: -Infinity,
      clipFrames: 0,
      speechLikelihood: 0,
      qualityScore: 0,
      suggestion: 'No audio tracks available. Check that the mic is connected and permissions are granted.',
    };
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  const recordingDone = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = (e) => reject(e);
  });

  recorder.start(250);

  const abortHandler = () => {
    if (recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* no-op */ }
    }
  };
  signal?.addEventListener('abort', abortHandler, { once: true });

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      if (recorder.state !== 'inactive') {
        try { recorder.stop(); } catch { /* no-op */ }
      }
      resolve();
    }, durationMs);
  });

  signal?.removeEventListener('abort', abortHandler);

  if (signal?.aborted) {
    return {
      verdict: 'no-signal',
      rmsDb: -Infinity,
      peakDb: -Infinity,
      noiseFloorDb: -Infinity,
      clipFrames: 0,
      speechLikelihood: 0,
      qualityScore: 0,
      suggestion: 'Check was cancelled.',
    };
  }

  const blob = await recordingDone;

  if (blob.size === 0) {
    return {
      verdict: 'no-signal',
      rmsDb: -Infinity,
      peakDb: -Infinity,
      noiseFloorDb: -Infinity,
      clipFrames: 0,
      speechLikelihood: 0,
      qualityScore: 0,
      suggestion: 'No audio data captured. Check that the mic is connected and not muted.',
    };
  }

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AudioCtx();
  let audioBuffer: AudioBuffer;
  try {
    const arrayBuf = await blob.arrayBuffer();
    audioBuffer = await ctx.decodeAudioData(arrayBuf);
  } catch {
    try { ctx.close(); } catch { /* no-op */ }
    return {
      verdict: 'no-signal',
      rmsDb: -Infinity,
      peakDb: -Infinity,
      noiseFloorDb: -Infinity,
      clipFrames: 0,
      speechLikelihood: 0,
      qualityScore: 0,
      suggestion: 'Could not decode audio. The microphone may not be producing valid audio data.',
    };
  }

  const samples = audioBuffer.getChannelData(0);
  const result = analysePcm(samples, audioBuffer.sampleRate, durationMs);

  try { ctx.close(); } catch { /* no-op */ }

  return { ...result, suggestion: verdictSuggestion(result.verdict) };
}
