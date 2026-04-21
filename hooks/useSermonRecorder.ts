/**
 * useSermonRecorder
 *
 * Full sermon recording pipeline ported from ScribeAI:
 * - MediaRecorder for audio capture (webm/opus preferred)
 * - AudioContext AnalyserNode for real-time waveform levels
 * - Web Speech API for live captions (interim + final)
 * - Chunked audio storage in memory for crash resilience
 * - Cloud transcription via /api/ai/transcribe-sermon-audio on stop
 * - Periodic interim transcription via /api/ai/transcribe-sermon-chunk
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSermonProcessingJob,
  retrySermonProcessingJob,
  transcribeSermonAudio,
  transcribeSermonChunk,
  type SermonProcessingJob,
} from '../services/geminiService';
import type { SermonSummary } from '../services/sermonSummaryService';
import {
  buildVoiceChain,
  CAPTURE_MODE_MAP,
  DEFAULT_CAPTURE_MODE,
  type CaptureModeId,
  type VoiceChainNodes,
} from '../services/audioCapture';
import { ENABLE_RECORDER_V2 } from '../services/audioCapture/featureFlag';
import {
  createAudioInputDiagnostic,
  probeAudioInput,
  type AudioInputDiagnostic,
} from '../services/audioCapture/mediaDiagnostics';

export type SermonRecorderLocale = 'en-GB' | 'en-US';
export type SermonAccentHint = 'standard' | 'uk' | 'nigerian' | 'ghanaian' | 'southafrican' | 'kenyan';

export interface SermonRecorderOptions {
  locale?: SermonRecorderLocale;
  accentHint?: SermonAccentHint;
  /** deviceId from enumerateDevices — use default if omitted */
  audioDeviceId?: string;
  selectedAudioDeviceId?: string;
  /** V2 capture mode preset id — only used when ENABLE_RECORDER_V2 is true */
  captureMode?: CaptureModeId;
}

export type SermonRecorderPhase =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'transcribing'
  | 'done'
  | 'error';

export interface SermonRecorderState {
  phase: SermonRecorderPhase;
  /** Live transcript from Web Speech API (final segments joined) */
  liveTranscript: string;
  /** Unconfirmed word(s) currently being spoken */
  interimText: string;
  /** Cloud-corrected transcript returned after stop */
  cloudTranscript: string;
  /** Merged best transcript: cloud if available, else live */
  transcript: string;
  /** Elapsed recording seconds */
  elapsedSeconds: number;
  /** 0–1 microphone amplitude level for visualizer */
  micLevel: number;
  /** Last error message if phase === 'error' */
  error: string | null;
  /** Web Speech API status — 'idle' before start, 'active' when receiving results,
   *  'unavailable' if the browser doesn't support it,
   *  or an error code string (e.g. 'network', 'not-allowed') */
  sttStatus: 'idle' | 'active' | 'unavailable' | string;
  /** Last cloud transcription error (chunk upload or final); null when ok */
  chunkError: string | null;
  /** Deferred sermon-processing job while Gemini quota retry is pending */
  processingJob: SermonProcessingJob | null;
  /** Summary returned from deferred sermon processing */
  processingSummary: SermonSummary | null;
  /** Temporary V2 input debug state for selected vs actual capture source */
  inputDiagnostic: AudioInputDiagnostic | null;
  /** Last recording blob + metadata, set when recording is stopped */
  lastRecording: LastRecording | null;
}

export interface SermonRecorderActions {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
  retryProcessing: () => Promise<void>;
  clearTranscript: () => void;
  setTranscript: (text: string) => void;
  setInputDiagnostic: (diagnostic: AudioInputDiagnostic | null) => void;
  clearLastRecording: () => void;
}

export interface LastRecording {
  blob: Blob;
  durationSec: number;
  mime: string;
}

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

const pickMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
};

const stopStreamSafely = (stream: MediaStream | null) => {
  if (!stream) return;
  stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* no-op */ } });
};

const getAnalyserLevel = (analyser: AnalyserNode): number => {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  const rmsDb = 20 * Math.log10(Math.max(rms, 0.00001));
  return Math.max(0, Math.min(1, (rmsDb + 72) / 52));
};

const CHUNK_UPLOAD_INTERVAL_MS = 12_000;
const TIMER_INTERVAL_MS = 1_000;
const JOB_POLL_INTERVAL_MS = 4_000;
const JOB_POLL_MAX_INTERVAL_MS = 15_000;
/** Speech-grade Opus bitrate for interim segments — keeps each 12 s slice well under the
 *  server's 1.5 MB chunk cap. The master recorder retains its default (higher) bitrate
 *  for the final transcript. */
const INTERVAL_SEGMENT_BITS_PER_SECOND = 32_000;
/** Hard ceiling for an interim segment's encoded base64 payload. Mirrors the server's
 *  TRANSCRIBE_MAX_BASE64_BYTES with a safety margin so a transient bitrate spike never
 *  reaches the 413 path. */
const MAX_SEGMENT_BASE64_BYTES = 1_400_000;

export const useSermonRecorder = (
  options: SermonRecorderOptions = {}
): [SermonRecorderState, SermonRecorderActions] => {
  const {
    locale = 'en-GB',
    accentHint = 'standard',
    audioDeviceId,
    selectedAudioDeviceId,
    captureMode = DEFAULT_CAPTURE_MODE,
  } = options;
  const [phase, setPhase] = useState<SermonRecorderPhase>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [cloudTranscript, setCloudTranscript] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sttStatus, setSttStatus] = useState<SermonRecorderState['sttStatus']>('idle');
  const [chunkError, setChunkError] = useState<string | null>(null);
  const [processingJob, setProcessingJob] = useState<SermonProcessingJob | null>(null);
  const [processingSummary, setProcessingSummary] = useState<SermonSummary | null>(null);
  const [inputDiagnostic, setInputDiagnostic] = useState<AudioInputDiagnostic | null>(null);
  const [lastRecording, setLastRecording] = useState<LastRecording | null>(null);

  // refs — stable across renders
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vizAnimRef = useRef<number | null>(null);
  const speechRecRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const chunkUploadTimerRef = useRef<number | null>(null);
  const jobPollTimerRef = useRef<number | null>(null);
  const mimeTypeRef = useRef(pickMimeType());
  const liveTranscriptRef = useRef('');
  const phaseRef = useRef<SermonRecorderPhase>('idle');
  const recordingStartedAtRef = useRef<number | null>(null);
  /** V2 voice chain handle — only populated when ENABLE_RECORDER_V2 is true */
  const voiceChainRef = useRef<VoiceChainNodes | null>(null);
  /** Index into audioChunksRef up to which we've already uploaded — avoids re-sending old audio */
  const lastChunkIdxRef = useRef(0);
  /** Timestamp (ms) until which chunk uploads are paused due to quota/cooldown */
  const chunkUploadPausedUntilRef = useRef(0);
  /** Processed audio stream feeding both the master MediaRecorder and the rolling
   *  interim segment recorder. Held so the segment cycle can spawn fresh recorders
   *  without tearing the voice chain down. */
  const processedStreamRef = useRef<MediaStream | null>(null);
  /** Short-lived MediaRecorder for the current interim segment (12 s window). */
  const intervalRecorderRef = useRef<MediaRecorder | null>(null);
  /** Buffer for the in-flight interim segment's dataavailable blobs. */
  const intervalChunksRef = useRef<Blob[]>([]);
  /** setTimeout handle for the next segment swap. */
  const intervalRestartTimerRef = useRef<number | null>(null);
  /** Whether the rolling segment cycle should keep re-spawning. Cleared on stop/pause. */
  const intervalActiveRef = useRef(false);
  /** Ordered array of interim transcript text per segment slot. Indexed by spawn order
   *  so out-of-order upload completion still reconstructs the correct sequence. */
  const cloudSegmentsRef = useRef<string[]>([]);

  const clearJobPolling = useCallback(() => {
    if (jobPollTimerRef.current !== null) {
      window.clearTimeout(jobPollTimerRef.current);
      jobPollTimerRef.current = null;
    }
  }, []);

  // Keep refs in sync with state so callbacks always read current values
  useEffect(() => { liveTranscriptRef.current = liveTranscript; }, [liveTranscript]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Visualizer loop ──────────────────────────────────────────────────────
  const startVizLoop = useCallback(() => {
    const run = () => {
      if (analyserRef.current) {
        setMicLevel(getAnalyserLevel(analyserRef.current));
      }
      vizAnimRef.current = requestAnimationFrame(run);
    };
    vizAnimRef.current = requestAnimationFrame(run);
  }, []);

  const stopVizLoop = useCallback(() => {
    if (vizAnimRef.current !== null) {
      cancelAnimationFrame(vizAnimRef.current);
      vizAnimRef.current = null;
    }
    setMicLevel(0);
  }, []);

  // ── Web Speech API ───────────────────────────────────────────────────────
  const startSpeechRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // In Electron, webkitSpeechRecognition exists (Chromium) but cannot connect to
    // Google's speech servers — it lacks the auth credentials Chrome has.
    // Skip Web Speech entirely in Electron; Gemini chunk transcription handles it instead.
    const isElectron = typeof navigator !== 'undefined'
      && navigator.userAgent.toLowerCase().includes('electron');
    if (!SR || isElectron) {
      setSttStatus('unavailable');
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = locale;

    rec.onresult = (e: any) => {
      setSttStatus('active');
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          setLiveTranscript((prev) => {
            const next = prev ? `${prev} ${text.trim()}` : text.trim();
            liveTranscriptRef.current = next;
            return next;
          });
        } else {
          interim += text;
        }
      }
      setInterimText(interim);
    };

    rec.onerror = (e: any) => {
      const code: string = e?.error || 'unknown';
      if (code !== 'no-speech') {
        setSttStatus(code);
      }
    };
    rec.onend = () => {
      if (speechRecRef.current === rec && phaseRef.current === 'recording') {
        try { rec.start(); } catch { /* ignore */ }
      }
    };

    speechRecRef.current = rec;
    try { rec.start(); } catch { /* browser may deny */ }
  }, [locale]);

  const stopSpeechRecognition = useCallback(() => {
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch { /* ignore */ }
      speechRecRef.current = null;
    }
    setInterimText('');
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (chunkUploadTimerRef.current !== null) {
      window.clearInterval(chunkUploadTimerRef.current);
      chunkUploadTimerRef.current = null;
    }
    intervalActiveRef.current = false;
    if (intervalRestartTimerRef.current !== null) {
      window.clearTimeout(intervalRestartTimerRef.current);
      intervalRestartTimerRef.current = null;
    }
    const segmentRecorder = intervalRecorderRef.current;
    if (segmentRecorder && segmentRecorder.state !== 'inactive') {
      try { segmentRecorder.stop(); } catch { /* no-op */ }
    }
    intervalRecorderRef.current = null;
    processedStreamRef.current = null;
    clearJobPolling();
    stopVizLoop();
    stopSpeechRecognition();
    try { voiceChainRef.current?.dispose(); } catch { /* no-op */ }
    voiceChainRef.current = null;
    try { analyserRef.current?.disconnect(); } catch { /* no-op */ }
    analyserRef.current = null;
    try { audioCtxRef.current?.close(); } catch { /* no-op */ }
    audioCtxRef.current = null;
    stopStreamSafely(micStreamRef.current);
    micStreamRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* no-op */ }
    }
    mediaRecorderRef.current = null;
  }, [clearJobPolling, stopVizLoop, stopSpeechRecognition]);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Rolling interim transcription via short-lived segment recorders ──────
  // Each cycle spawns a fresh MediaRecorder on the processed stream, lets it run for
  // CHUNK_UPLOAD_INTERVAL_MS, then stops it. Each segment is a complete standalone
  // WebM (its own EBML header) — bounded in size and safe to upload as-is, so the
  // server's 1.5 MB chunk cap is never reached even on hour-long recordings.
  // Segment transcripts are appended in spawn order using positional slots, so
  // out-of-order upload completion still reconstructs the correct sequence.
  const uploadSegment = useCallback(async (blob: Blob, slotIdx: number) => {
    if (blob.size < 8192) return;
    const estBase64 = Math.ceil((blob.size * 4) / 3);
    if (estBase64 > MAX_SEGMENT_BASE64_BYTES) {
      // Defensive: at 32 kbps over 12 s a segment is ~50 KB, so this branch should
      // never fire. If it does, drop the segment silently rather than provoke a 413.
      return;
    }
    if (Date.now() < chunkUploadPausedUntilRef.current) return;

    const result = await transcribeSermonChunk({
      audioBase64: await blobToBase64(blob),
      mimeType: mimeTypeRef.current as any,
      locale,
      accentHint,
    });

    if (result.ok) {
      if (result.transcript) {
        cloudSegmentsRef.current[slotIdx] = result.transcript.trim();
        setCloudTranscript(cloudSegmentsRef.current.filter(Boolean).join(' '));
        setChunkError(null);
      }
    } else {
      const failed = result as Extract<typeof result, { ok: false }>;
      setChunkError(failed.message || failed.error || 'Cloud transcription failed.');
      if (failed.mode === 'cooldown' && failed.retryAfterMs > 0) {
        chunkUploadPausedUntilRef.current = Date.now() + failed.retryAfterMs;
      }
    }
  }, [accentHint, locale]);

  const stopIntervalRecorderCycle = useCallback(() => {
    intervalActiveRef.current = false;
    if (intervalRestartTimerRef.current !== null) {
      window.clearTimeout(intervalRestartTimerRef.current);
      intervalRestartTimerRef.current = null;
    }
    const recorder = intervalRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* no-op */ }
    }
    intervalRecorderRef.current = null;
  }, []);

  const startIntervalRecorderCycle = useCallback(() => {
    intervalActiveRef.current = true;

    const spawn = () => {
      if (!intervalActiveRef.current) return;
      if (phaseRef.current !== 'recording') return;
      const stream = processedStreamRef.current;
      if (!stream) return;

      const chunks: Blob[] = [];
      const slotIdx = cloudSegmentsRef.current.length;
      cloudSegmentsRef.current.push('');

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: mimeTypeRef.current,
          audioBitsPerSecond: INTERVAL_SEGMENT_BITS_PER_SECOND,
        });
      } catch {
        try {
          recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
        } catch {
          return;
        }
      }

      intervalRecorderRef.current = recorder;
      intervalChunksRef.current = chunks;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeTypeRef.current });
        void uploadSegment(blob, slotIdx);
      };

      try {
        recorder.start();
      } catch {
        cloudSegmentsRef.current[slotIdx] = '';
        return;
      }

      intervalRestartTimerRef.current = window.setTimeout(() => {
        try {
          if (recorder.state === 'recording') recorder.stop();
        } catch { /* no-op */ }
        spawn();
      }, CHUNK_UPLOAD_INTERVAL_MS);
    };

    spawn();
  }, [uploadSegment]);

  const pollProcessingJob = useCallback((jobId: string, delayMs = JOB_POLL_INTERVAL_MS) => {
    clearJobPolling();
    jobPollTimerRef.current = window.setTimeout(async () => {
      if (phaseRef.current !== 'transcribing') return;

      const result = await getSermonProcessingJob(jobId);
      if (phaseRef.current !== 'transcribing') return;

      if (!result.ok) {
        const pollError = 'error' in result ? result.error : 'Unable to fetch deferred sermon status.';
        setChunkError(`Waiting for saved transcription... ${pollError}`);
        pollProcessingJob(jobId, JOB_POLL_INTERVAL_MS);
        return;
      }

      const job = result.job;
      setProcessingJob(job);

      if (job.status === 'completed') {
        if (job.transcript) {
          setCloudTranscript(job.transcript);
        }
        setProcessingSummary(job.summary || null);
        setChunkError(job.error || null);
        setError(null);
        clearJobPolling();
        setPhase('done');
        return;
      }

      if (job.status === 'failed') {
        clearJobPolling();
        if (liveTranscriptRef.current.trim()) {
          setChunkError(job.error || 'Saved transcription failed. Using the live transcript.');
          setPhase('done');
          return;
        }
        setError(job.error || 'Saved transcription failed.');
        setPhase('error');
        return;
      }

      if (job.status === 'queued') {
        setChunkError(job.error || 'Saved audio is queued for automatic transcription retry.');
      } else if (job.phase === 'summarize') {
        setChunkError(null);
      }

      const nextDelay = job.retryAfterMs > 0
        ? Math.min(JOB_POLL_MAX_INTERVAL_MS, Math.max(JOB_POLL_INTERVAL_MS, job.retryAfterMs))
        : JOB_POLL_INTERVAL_MS;
      pollProcessingJob(jobId, nextDelay);
    }, Math.max(500, delayMs));
  }, [clearJobPolling]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null);
    setSttStatus('idle');
    setChunkError(null);
    setProcessingJob(null);
    setProcessingSummary(null);
    setLastRecording(null);
    phaseRef.current = 'recording';
    setPhase('recording');
    setLiveTranscript('');
    setCloudTranscript('');
    setInterimText('');
    setElapsedSeconds(0);
    recordingStartedAtRef.current = Date.now();
    audioChunksRef.current = [];
    lastChunkIdxRef.current = 0;
    chunkUploadPausedUntilRef.current = 0;
    cloudSegmentsRef.current = [];
    clearJobPolling();

    const v2Preset = ENABLE_RECORDER_V2 ? CAPTURE_MODE_MAP.get(captureMode) ?? null : null;
    let micStream: MediaStream;
    if (ENABLE_RECORDER_V2 && v2Preset) {
      const probe = await probeAudioInput({
        deviceId: audioDeviceId,
        preset: v2Preset,
        mode: 'recording',
      });
      setInputDiagnostic(createAudioInputDiagnostic('recording', selectedAudioDeviceId ?? audioDeviceId, probe));

      if (!probe.stream || probe.status !== 'usable') {
        const fallbackMessage = probe.status === 'request-failed'
          ? probe.errorMessage || 'Could not access microphone.'
          : 'The selected microphone produced no live audio samples. Try another source or run Record Check again.';
        setError(fallbackMessage);
        setPhase('error');
        return;
      }

      micStream = probe.stream;
    } else {
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        sampleRate: 48000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      try {
        if (audioDeviceId) {
          audioConstraints.deviceId = { exact: audioDeviceId };
        }
        micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (err: any) {
        if (audioDeviceId && err?.name === 'OverconstrainedError') {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: 1,
                sampleRate: 48000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
          } catch (fallbackErr) {
            const msg = fallbackErr instanceof Error ? fallbackErr.message : 'Microphone access denied.';
            setError(msg);
            setPhase('error');
            return;
          }
        } else {
          const msg = err instanceof Error ? err.message : 'Microphone access denied.';
          setError(msg);
          setPhase('error');
          return;
        }
      }
    }

    micStreamRef.current = micStream;

    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as
      | (new (contextOptions?: AudioContextOptions) => AudioContext)
      | undefined;
    if (!AudioCtx) {
      setError('AudioContext is not supported in this browser.');
      setPhase('error');
      stopStreamSafely(micStream);
      micStreamRef.current = null;
      return;
    }

    const ctx = new AudioCtx({ sampleRate: 48000 });
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => undefined);
    }

    const source = ctx.createMediaStreamSource(micStream);

    let processedStream: MediaStream;

    if (ENABLE_RECORDER_V2 && v2Preset) {
      // V2 path: full voice chain (HPF → gate → presence EQ → compressor → limiter → analyser).
      // Sequence: ctx.resume() (above) → buildVoiceChain → MediaRecorder.start() avoids silent first chunks.
      const chain = await buildVoiceChain(ctx, source, v2Preset);
      voiceChainRef.current = chain;
      analyserRef.current = chain.analyser;
      processedStream = chain.processedStream;
      startVizLoop();
    } else {
      // V1 path: existing inline chain — unchanged.
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 80;
      hpf.Q.value = 0.7;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 10;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source.connect(hpf);
      hpf.connect(compressor);
      compressor.connect(analyser);
      // Force analyser into Chromium's active audio graph via a silent (gain=0) path to destination.
      // Without this, Chromium skips nodes whose output has no downstream consumer connected to
      // AudioContext.destination, causing getFloatTimeDomainData to return silence.
      const silentSink = ctx.createGain();
      silentSink.gain.value = 0;
      analyser.connect(silentSink);
      silentSink.connect(ctx.destination);
      startVizLoop();

      const destination = ctx.createMediaStreamDestination();
      compressor.connect(destination);
      processedStream = destination.stream;
    }

    processedStreamRef.current = processedStream;

    const mimeType = mimeTypeRef.current;
    const recorder = new MediaRecorder(processedStream, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };
    recorder.onerror = () => {
      cleanup();
      setError('Recording failed. Try another microphone or browser.');
      setPhase('error');
    };
    recorder.start(1000);

    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, TIMER_INTERVAL_MS);

    startSpeechRecognition();
    startIntervalRecorderCycle();
  }, [audioDeviceId, captureMode, clearJobPolling, selectedAudioDeviceId, startIntervalRecorderCycle, startSpeechRecognition, startVizLoop]);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    stopIntervalRecorderCycle();
    stopSpeechRecognition();
    stopVizLoop();
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase('paused');
  }, [stopIntervalRecorderCycle, stopSpeechRecognition, stopVizLoop]);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    startVizLoop();
    startSpeechRecognition();
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, TIMER_INTERVAL_MS);
    phaseRef.current = 'recording';
    setPhase('recording');
    startIntervalRecorderCycle();
  }, [startIntervalRecorderCycle, startSpeechRecognition, startVizLoop]);

  const stop = useCallback(async () => {
    await new Promise<void>((resolve) => {
      const rec = mediaRecorderRef.current;
      if (!rec || rec.state === 'inactive') {
        resolve();
        return;
      }
      rec.onstop = () => resolve();
      rec.stop();
    });

    cleanup();
    setPhase('transcribing');
    setProcessingJob(null);
    setProcessingSummary(null);

    const chunks = audioChunksRef.current;
    if (chunks.length === 0) {
      setPhase('done');
      return;
    }

    const mimeType = mimeTypeRef.current;
    const blob = new Blob(chunks, { type: mimeType });

    // Capture lastRecording for the RecordingSavedPill
    const durationSec = recordingStartedAtRef.current
      ? Math.round((Date.now() - recordingStartedAtRef.current) / 1000)
      : 0;
    setLastRecording({ blob, durationSec, mime: mimeType });

    try {
      const result = await transcribeSermonAudio(blob, mimeType, locale, accentHint, { allowDeferred: true });
      if (result.ok) {
        if (result.transcript) {
          setCloudTranscript(result.transcript);
          setChunkError(null);
        }
        setPhase('done');
        return;
      }

      if (!result.ok && 'deferred' in result && result.deferred) {
        setProcessingJob(result.job);
        setChunkError(result.error || 'Saved audio is queued for automatic transcription retry.');
        pollProcessingJob(result.job.id, Math.min(JOB_POLL_MAX_INTERVAL_MS, Math.max(JOB_POLL_INTERVAL_MS, result.job.retryAfterMs || JOB_POLL_INTERVAL_MS)));
        return;
      }
      if (!result.ok) {
        const failed = result as Extract<typeof result, { ok: false }>;
        setChunkError(failed.error || 'Final transcription failed.');
      }
    } catch (err: any) {
      setChunkError(err?.message || 'Final transcription failed unexpectedly.');
    }

    setPhase('done');
  }, [accentHint, cleanup, locale, pollProcessingJob]);

  const clearTranscript = useCallback(() => {
    setLiveTranscript('');
    setCloudTranscript('');
    setInterimText('');
    setChunkError(null);
    setProcessingJob(null);
    setProcessingSummary(null);
    liveTranscriptRef.current = '';
  }, []);

  const retryProcessing = useCallback(async () => {
    if (!processingJob?.id) return;
    setError(null);
    setChunkError('Retrying saved audio...');
    setProcessingSummary(null);
    setPhase('transcribing');
    const result = await retrySermonProcessingJob(processingJob.id);
    if (!result.ok) {
      const retryError = 'error' in result ? result.error : 'Unable to retry saved sermon processing.';
      setError(retryError || 'Unable to retry saved sermon processing.');
      setPhase('error');
      return;
    }
    setProcessingJob(result.job);
    pollProcessingJob(
      result.job.id,
      Math.min(JOB_POLL_MAX_INTERVAL_MS, Math.max(JOB_POLL_INTERVAL_MS, result.job.retryAfterMs || JOB_POLL_INTERVAL_MS)),
    );
  }, [pollProcessingJob, processingJob]);

  const setTranscript = useCallback((text: string) => {
    setLiveTranscript(text);
    setCloudTranscript('');
    liveTranscriptRef.current = text;
  }, []);

  const clearLastRecording = useCallback(() => {
    setLastRecording(null);
  }, []);

  const transcript = cloudTranscript || liveTranscript;

  const state: SermonRecorderState = {
    phase,
    liveTranscript,
    interimText,
    cloudTranscript,
    transcript,
    elapsedSeconds,
    micLevel,
    error,
    sttStatus,
    chunkError,
    processingJob,
    processingSummary,
    inputDiagnostic,
    lastRecording,
  };

  const actions: SermonRecorderActions = {
    start,
    pause,
    resume,
    stop,
    retryProcessing,
    clearTranscript,
    setTranscript,
    setInputDiagnostic,
    clearLastRecording,
  };

  return [state, actions];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
