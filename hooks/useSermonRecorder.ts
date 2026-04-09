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
import { transcribeSermonAudio, transcribeSermonChunk } from '../services/geminiService';

export type SermonRecorderLocale = 'en-GB' | 'en-US';
export type SermonAccentHint = 'standard' | 'uk' | 'nigerian' | 'ghanaian' | 'southafrican' | 'kenyan';

export interface SermonRecorderOptions {
  locale?: SermonRecorderLocale;
  accentHint?: SermonAccentHint;
  /** deviceId from enumerateDevices — use default if omitted */
  audioDeviceId?: string;
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
}

export interface SermonRecorderActions {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
  clearTranscript: () => void;
  setTranscript: (text: string) => void;
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

const CHUNK_UPLOAD_INTERVAL_MS = 12_000; // upload every 12s — primary live transcript source in Electron
const TIMER_INTERVAL_MS = 1_000;

export const useSermonRecorder = (
  options: SermonRecorderOptions = {}
): [SermonRecorderState, SermonRecorderActions] => {
  const { locale = 'en-GB', accentHint = 'standard', audioDeviceId } = options;
  const [phase, setPhase] = useState<SermonRecorderPhase>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [cloudTranscript, setCloudTranscript] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sttStatus, setSttStatus] = useState<SermonRecorderState['sttStatus']>('idle');
  const [chunkError, setChunkError] = useState<string | null>(null);

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
  const mimeTypeRef = useRef(pickMimeType());
  const liveTranscriptRef = useRef('');
  const phaseRef = useRef<SermonRecorderPhase>('idle');

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
    if (!SR) {
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
      // 'no-speech' is non-fatal and expected during pauses — don't surface it
      if (code !== 'no-speech') {
        setSttStatus(code);
      }
    };
    rec.onend = () => {
      // Auto-restart while still recording (browser kills after ~60s silence)
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
    // timer
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // chunk upload timer
    if (chunkUploadTimerRef.current !== null) {
      window.clearInterval(chunkUploadTimerRef.current);
      chunkUploadTimerRef.current = null;
    }
    // visualizer
    stopVizLoop();
    // speech
    stopSpeechRecognition();
    // audio graph
    try { analyserRef.current?.disconnect(); } catch { /* no-op */ }
    analyserRef.current = null;
    try { audioCtxRef.current?.close(); } catch { /* no-op */ }
    audioCtxRef.current = null;
    // mic stream
    stopStreamSafely(micStreamRef.current);
    micStreamRef.current = null;
    // media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* no-op */ }
    }
    mediaRecorderRef.current = null;
  }, [stopVizLoop, stopSpeechRecognition]);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Periodic chunk upload for interim cloud corrections ──────────────────
  const scheduleChunkUpload = useCallback(() => {
    if (chunkUploadTimerRef.current !== null) return;
    chunkUploadTimerRef.current = window.setInterval(async () => {
      if (phaseRef.current !== 'recording') return;
      const chunks = audioChunksRef.current;
      if (chunks.length === 0) return;
      const blob = new Blob([...chunks], { type: mimeTypeRef.current });
      if (blob.size < 8192) return; // too small to bother
      const result = await transcribeSermonChunk({
        audioBase64: await blobToBase64(blob),
        mimeType: mimeTypeRef.current as any,
        locale,
        accentHint,
      });
      if (result.ok && result.transcript) {
        setCloudTranscript(prev => prev ? `${prev} ${result.transcript}` : result.transcript);
        setChunkError(null);
      } else if (!result.ok) {
        const failResult = result as { ok: false; message: string; error: string };
        setChunkError(failResult.message || failResult.error || 'Cloud transcription failed.');
      }
    }, CHUNK_UPLOAD_INTERVAL_MS);
  }, [locale]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null);
    setSttStatus('idle');
    setChunkError(null);
    setPhase('recording');
    setLiveTranscript('');
    setCloudTranscript('');
    setInterimText('');
    setElapsedSeconds(0);
    audioChunksRef.current = [];

    let micStream: MediaStream;
    try {
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        sampleRate: 48000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      if (audioDeviceId) {
        audioConstraints.deviceId = { exact: audioDeviceId };
      }
      micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    } catch (err: any) {
      // If exact deviceId failed, retry with default mic
      if (audioDeviceId && err?.name === 'OverconstrainedError') {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, sampleRate: 48000, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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

    micStreamRef.current = micStream;

    // ── AudioContext + processing chain ──────────────────────────────────────
    // Chain: source → highpass (80Hz cuts PA rumble) → compressor (handles
    // volume swings common in preaching) → analyser (for visualizer)
    // Separate destination stream for MediaRecorder captures processed audio.
    const ctx = new AudioContext({ sampleRate: 48000 });
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(micStream);

    // High-pass filter: remove low-frequency PA rumble below 80Hz
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 80;
    hpf.Q.value = 0.7;

    // Dynamics compressor: tame loud peaks, lift quiet sections
    // threshold: -24dB, knee: 10, ratio: 4:1, fast attack, medium release
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Wire: source → hpf → compressor → analyser
    source.connect(hpf);
    hpf.connect(compressor);
    compressor.connect(analyser);
    startVizLoop();

    // ── MediaRecorder — record from processed stream via MediaStreamDestination ──
    const destination = ctx.createMediaStreamDestination();
    compressor.connect(destination);
    const processedStream = destination.stream;

    const mimeType = mimeTypeRef.current;
    const recorder = new MediaRecorder(processedStream, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };
    recorder.start(1000); // 1s chunks for crash resilience

    // ── Elapsed timer ──
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, TIMER_INTERVAL_MS);

    // ── Speech recognition ──
    startSpeechRecognition();

    // ── Periodic cloud chunk upload ──
    scheduleChunkUpload();
  }, [startVizLoop, startSpeechRecognition, scheduleChunkUpload]);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    stopSpeechRecognition();
    stopVizLoop();
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase('paused');
  }, [stopSpeechRecognition, stopVizLoop]);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    startVizLoop();
    startSpeechRecognition();
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, TIMER_INTERVAL_MS);
    setPhase('recording');
  }, [startVizLoop, startSpeechRecognition]);

  const stop = useCallback(async () => {
    // Stop MediaRecorder and collect remaining chunks
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

    const chunks = audioChunksRef.current;
    if (chunks.length === 0) {
      setPhase('done');
      return;
    }

    const mimeType = mimeTypeRef.current;
    const blob = new Blob(chunks, { type: mimeType });

    try {
      const result = await transcribeSermonAudio(blob, mimeType, locale, accentHint);
      if (result.ok && result.transcript) {
        setCloudTranscript(result.transcript);
      }
    } catch {
      // Non-fatal — live transcript still usable
    }

    setPhase('done');
  }, [cleanup, locale]);

  const clearTranscript = useCallback(() => {
    setLiveTranscript('');
    setCloudTranscript('');
    setInterimText('');
    liveTranscriptRef.current = '';
  }, []);

  const setTranscript = useCallback((text: string) => {
    setLiveTranscript(text);
    setCloudTranscript('');
    liveTranscriptRef.current = text;
  }, []);

  // Merged best transcript
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
  };

  const actions: SermonRecorderActions = {
    start,
    pause,
    resume,
    stop,
    clearTranscript,
    setTranscript,
  };

  return [state, actions];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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
