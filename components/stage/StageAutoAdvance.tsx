import React, { useEffect, useRef, useState } from 'react';

interface StageAutoAdvanceProps {
  enabled: boolean;
  delaySec: number;
  onToggle: () => void;
  onDelayChange: (secs: number) => void;
  onAdvance: () => void;
  compact?: boolean;
}

const DELAY_PRESETS = [5, 10, 15, 30];

export const StageAutoAdvance: React.FC<StageAutoAdvanceProps> = ({
  enabled,
  delaySec,
  onToggle,
  onDelayChange,
  onAdvance,
  compact = false,
}) => {
  const [countdown, setCountdown] = useState(delaySec);
  const advanceRef = useRef(onAdvance);
  advanceRef.current = onAdvance;

  useEffect(() => {
    setCountdown(delaySec);
  }, [delaySec]);

  useEffect(() => {
    if (!enabled) {
      setCountdown(delaySec);
      return;
    }
    setCountdown(delaySec);
    const id = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          advanceRef.current();
          return delaySec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled, delaySec]);

  const progressPct = enabled ? Math.round(((delaySec - countdown) / Math.max(1, delaySec)) * 100) : 0;
  const bottomClass = compact ? 'bottom-12 right-3' : 'bottom-16 right-5';

  return (
    <div className={`absolute ${bottomClass} z-30 bg-zinc-950/92 border border-zinc-700 rounded-xl p-3 shadow-xl backdrop-blur-sm w-44`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Auto-Advance</span>
        <button
          onClick={onToggle}
          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors ${
            enabled
              ? 'border-green-600 text-green-400 bg-green-950/40'
              : 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
          }`}
          title="Toggle auto-advance (A)"
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {enabled && (
        <>
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-2xl font-mono font-black text-white tabular-nums">{countdown}</span>
            <span className="text-xs text-zinc-500">sec</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[9px] text-zinc-600 mr-0.5">Delay:</span>
        {DELAY_PRESETS.map((secs) => (
          <button
            key={secs}
            onClick={() => onDelayChange(secs)}
            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
              delaySec === secs
                ? 'border-zinc-300 text-white bg-zinc-800'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
            }`}
          >
            {secs}s
          </button>
        ))}
      </div>
    </div>
  );
};
