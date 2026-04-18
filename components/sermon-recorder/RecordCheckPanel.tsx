import React, { useCallback, useRef, useState } from 'react';
import { analyseStream, type RecordCheckResult } from '../../services/audioCapture/recordCheck';
import type { CaptureModePreset } from '../../services/audioCapture/capturePresets';

interface RecordCheckPanelProps {
  deviceId: string | undefined;
  preset: CaptureModePreset;
  onResult?: (result: RecordCheckResult) => void;
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

export const RecordCheckPanel: React.FC<RecordCheckPanelProps> = ({
  deviceId,
  preset,
  onResult,
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

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          echoCancellation: preset.constraints.echoCancellation,
          noiseSuppression: preset.constraints.noiseSuppression,
          autoGainControl: preset.constraints.autoGainControl,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const checkResult = await analyseStream(stream, preset, 4000, ac.signal);
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
        stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* no-op */ } });
        streamRef.current = null;
      }
      if (!ac.signal.aborted) {
        setChecking(false);
      }
    }
  }, [deviceId, preset, onResult]);

  const style = result ? VERDICT_STYLES[result.verdict] : null;

  return (
    <div className="space-y-1">
      <button
        onClick={runCheck}
        disabled={checking}
        className="w-full py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-medium hover:bg-zinc-750 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {checking ? 'Checking…' : 'Run Record Check'}
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
