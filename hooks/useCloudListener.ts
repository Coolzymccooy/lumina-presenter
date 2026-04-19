/**
 * useCloudListener
 *
 * Thin React wrapper around the pure {@link createCloudListener} factory in
 * `services/audioCapture/cloudListener.ts`. Bridges the engine's subscriber
 * model to React state so consumers can render listening status and
 * cumulative transcript without manual re-render plumbing.
 *
 * The factory holds *all* logic (voice chain, dual recorder, transcribe loop,
 * cooldown handling, slot ordering). This hook only:
 *  - constructs/disposes the engine on mount/unmount
 *  - mirrors `state` and `cumulativeTranscript` into `useState`
 *  - re-creates the engine when option deps change (e.g. captureMode flip)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createCloudListener,
  type CloudListenerError,
  type CloudListenerHandle,
  type CloudListenerOptions,
  type CloudListenerState,
} from '../services/audioCapture/cloudListener';
import type { CaptureModeId } from '../services/audioCapture/capturePresets';
import type { AudioInputDiagnostic } from '../services/audioCapture/mediaDiagnostics';

export interface UseCloudListenerOptions {
  /** deviceId from enumerateDevices — falls back to default mic when omitted */
  audioDeviceId?: string;
  /** deviceId explicitly chosen by the user; differs from audioDeviceId when "Default microphone" is resolved safely */
  selectedAudioDeviceId?: string;
  /** Voice chain preset id; defaults to engine's `DEFAULT_CAPTURE_MODE` */
  captureMode?: CaptureModeId;
  /** BCP-47 locale used by the cloud transcriber */
  locale: 'en-US' | 'en-GB';
  /** Optional accent hint for transcription accuracy */
  accentHint?: string;
  /** Sliding-segment length in ms (default 12_000) */
  segmentMs?: number;
  /** Recorder bitrate in bps (default 32_000) */
  audioBitsPerSecond?: number;
  /** Provenance metadata propagated to the transcribe API */
  workspaceId?: string;
  sessionId?: string;
  clientId?: string;
  /** Streaming append callback — fires per successful segment transcription */
  onTranscript: (text: string, slotIdx: number) => void;
  /** Optional consumer-facing error surface */
  onError?: (err: CloudListenerError) => void;
}

export interface UseCloudListenerReturn {
  /** Idempotent — safe to call repeatedly; resolves false on permission/recorder failure */
  start: () => Promise<boolean>;
  /** Idempotent — releases mic + voice chain + recorder */
  stop: () => void;
  /** Mirrored engine state for render */
  state: CloudListenerState;
  /** Joined transcript (positional slot array, filter-Boolean joined with ' ') */
  cumulativeTranscript: string;
  /** Temporary V2 input debug state for selected vs actual capture source */
  inputDiagnostic: AudioInputDiagnostic | null;
}

/**
 * Stable identity callbacks for the engine. We capture the latest user
 * callbacks in refs so the engine can call them without us having to rebuild
 * the engine on every parent re-render.
 */
function useLatestCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}

export function useCloudListener(opts: UseCloudListenerOptions): UseCloudListenerReturn {
  const onTranscript = useLatestCallback(opts.onTranscript);
  const onError = useLatestCallback(opts.onError ?? (() => {}));

  const handleRef = useRef<CloudListenerHandle | null>(null);
  const [state, setState] = useState<CloudListenerState>('idle');
  const [cumulativeTranscript, setCumulativeTranscript] = useState<string>('');
  const [inputDiagnostic, setInputDiagnostic] = useState<AudioInputDiagnostic | null>(null);

  const engineOptions = useMemo<CloudListenerOptions>(
    () => ({
      audioDeviceId: opts.audioDeviceId,
      selectedAudioDeviceId: opts.selectedAudioDeviceId,
      captureMode: opts.captureMode,
      locale: opts.locale,
      accentHint: opts.accentHint,
      segmentMs: opts.segmentMs,
      audioBitsPerSecond: opts.audioBitsPerSecond,
      workspaceId: opts.workspaceId,
      sessionId: opts.sessionId,
      clientId: opts.clientId,
      onTranscript: (text, slotIdx) => onTranscript(text, slotIdx),
      onError: (err) => onError(err),
    }),
    [
      opts.audioDeviceId,
      opts.selectedAudioDeviceId,
      opts.captureMode,
      opts.locale,
      opts.accentHint,
      opts.segmentMs,
      opts.audioBitsPerSecond,
      opts.workspaceId,
      opts.sessionId,
      opts.clientId,
      onTranscript,
      onError,
    ],
  );

  useEffect(() => {
    const handle = createCloudListener(engineOptions);
    handleRef.current = handle;
    setState(handle.getState());
    setCumulativeTranscript(handle.getCumulativeTranscript());
    setInputDiagnostic(handle.getInputDiagnostic());
    const unsubscribe = handle.onChange(() => {
      setState(handle.getState());
      setCumulativeTranscript(handle.getCumulativeTranscript());
      setInputDiagnostic(handle.getInputDiagnostic());
    });
    return () => {
      unsubscribe();
      try {
        handle.stop();
      } catch {
        /* swallow disposal errors */
      }
      if (handleRef.current === handle) {
        handleRef.current = null;
      }
    };
  }, [engineOptions]);

  const start = useCallback(async (): Promise<boolean> => {
    const handle = handleRef.current;
    if (!handle) return false;
    return handle.start();
  }, []);

  const stop = useCallback((): void => {
    handleRef.current?.stop();
  }, []);

  return { start, stop, state, cumulativeTranscript, inputDiagnostic };
}
