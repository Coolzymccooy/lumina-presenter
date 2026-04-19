import React, { useCallback, useRef, useState } from 'react';
import { analyseStream, type RecordCheckResult } from '../../services/audioCapture/recordCheck';
import type { CaptureModePreset } from '../../services/audioCapture/capturePresets';
import {
  createAudioInputDiagnostic,
  probeAudioInput,
  type AudioInputDiagnostic,
  type AudioInputProbeResult,
} from '../../services/audioCapture/mediaDiagnostics';

interface RecordCheckPanelProps {
  selectedDeviceId: string | undefined;
  resolvedDeviceId: string | undefined;
  preset: CaptureModePreset;
  onResult?: (result: RecordCheckResult) => void;
  onDiagnostic?: (diagnostic: AudioInputDiagnostic | null) => void;
}

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  good: { bg: 'bg-emerald-950/40', text: 'text-emerald-300', border: 'border-emerald-800/50' },
  'low-signal': { bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-800/50' },
  'too-noisy': { bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-800/50' },
  'no-signal': { bg: 'bg-red-950/40', text: 'text-red-300', border: 'border-red-800/50' },
  clipping: { bg: 'bg-red-950/40', text: 'text-red-300', border: 'border-red-800/50' },
};

const VERDICT_LABELS: Record<string, string> = {
  good: 'Good to Record',
  'low-signal': 'Low Signal',
  'too-noisy': 'Too Noisy',
  'no-signal': 'No Signal',
  clipping: 'Clipping',
};

const toDb = (linear: number): number => (
  linear <= 0 ? -Infinity : 20 * Math.log10(linear)
);

function buildProbeFailureResult(probe: AudioInputProbeResult): RecordCheckResult {
  let suggestion: string;
  switch (probe.status) {
    case 'muted-live':
      suggestion = 'The selected source returned a live but muted track, so no usable audio samples were captured.';
      break;
    case 'ended':
      suggestion = 'The selected source ended before Lumina captured any usable audio samples.';
      break;
    case 'silent-raw':
      suggestion = 'The selected source returned digital silence. Try another source or use the default microphone.';
      break;
    case 'request-failed':
      suggestion = probe.errorMessage || 'Could not access microphone.';
      break;
    default:
      suggestion = 'No audio detected. Check that the mic is connected and not muted.';
      break;
  }

  return {
    verdict: 'no-signal',
    rmsDb: toDb(probe.rawRms),
    peakDb: toDb(probe.rawPeak),
    noiseFloorDb: -Infinity,
    clipFrames: 0,
    speechLikelihood: 0,
    qualityScore: 0,
    suggestion,
  };
}

export const RecordCheckPanel: React.FC<RecordCheckPanelProps> = ({
  selectedDeviceId,
  resolvedDeviceId,
  preset,
  onResult,
  onDiagnostic,
}) => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<RecordCheckResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const runCheck = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setChecking(true);
    setResult(null);
    onDiagnostic?.(null);

    try {
      const probe = await probeAudioInput({
        deviceId: resolvedDeviceId,
        preset,
        mode: 'record-check',
        signal: ac.signal,
        strictRawSignal: false,
      });
      onDiagnostic?.(
        createAudioInputDiagnostic('record-check', selectedDeviceId ?? resolvedDeviceId, probe),
      );

      if (!probe.stream || probe.status !== 'usable') {
        const failedResult = buildProbeFailureResult(probe);
        setResult(failedResult);
        onResult?.(failedResult);
        return;
      }

      streamRef.current = probe.stream;
      let checkResult = await analyseStream(probe.stream, preset, 4000, ac.signal);
      if (probe.warning) {
        checkResult = {
          ...checkResult,
          suggestion: `${checkResult.suggestion} ${probe.warning}`.trim(),
        };
      }
      setResult(checkResult);
      onResult?.(checkResult);
    } catch (err) {
      if (!ac.signal.aborted) {
        setResult({
          verdict: 'no-signal',
          rmsDb: -Infinity,
          peakDb: -Infinity,
          noiseFloorDb: -Infinity,
          clipFrames: 0,
          speechLikelihood: 0,
          qualityScore: 0,
          suggestion: err instanceof Error ? err.message : 'Could not access microphone.',
        });
      }
    } finally {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => { try { track.stop(); } catch { /* no-op */ } });
        streamRef.current = null;
      }
      if (!ac.signal.aborted) {
        setChecking(false);
      }
    }
  }, [onDiagnostic, onResult, preset, resolvedDeviceId, selectedDeviceId]);

  const style = result ? VERDICT_STYLES[result.verdict] : null;

  return (
    <div className="space-y-1">
      <p className="text-[9px] text-zinc-500 leading-relaxed">
        Speak normally for a few seconds while the check runs.
      </p>
      <button
        onClick={runCheck}
        disabled={checking}
        className="w-full py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-medium hover:bg-zinc-750 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {checking ? 'Checking... speak now' : 'Run Record Check'}
      </button>

      {result && style && (
        <div className={`rounded-lg px-2.5 py-2 border ${style.bg} ${style.border}`}>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold ${style.text}`}>
              {VERDICT_LABELS[result.verdict]}
            </span>
            <span className="text-[8px] text-zinc-500">
              {result.qualityScore >= 0.01
                ? `Quality: ${Math.round(result.qualityScore * 100)}%`
                : ''}
              {result.peakDb > -Infinity
                ? ` · Peak: ${Math.round(result.peakDb)} dB`
                : ''}
            </span>
          </div>
          <p className="text-[9px] text-zinc-400 mt-0.5">{result.suggestion}</p>
        </div>
      )}
    </div>
  );
};
