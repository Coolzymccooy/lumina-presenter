import React from 'react';

interface GuideProgressProps {
  stepIndex: number;
  totalSteps: number;
  journeyTitle: string;
  onExit: () => void;
}

export function GuideProgress({ stepIndex, totalSteps, journeyTitle, onExit }: GuideProgressProps) {
  const pct = totalSteps > 1 ? (stepIndex / (totalSteps - 1)) * 100 : 100;

  return (
    <div
      data-testid="guide-progress"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9200] flex items-center gap-3 bg-zinc-900/95 border border-zinc-700/60 rounded-full px-4 py-2 shadow-xl backdrop-blur-sm"
    >
      {/* Dot indicators */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`block rounded-full transition-all duration-300 ${
              i < stepIndex
                ? 'w-1.5 h-1.5 bg-indigo-400'
                : i === stepIndex
                ? 'w-2.5 h-2.5 bg-indigo-500'
                : 'w-1.5 h-1.5 bg-zinc-600'
            }`}
          />
        ))}
      </div>

      <span className="text-[11px] text-zinc-400 font-medium hidden sm:block">
        {journeyTitle} · {stepIndex + 1}/{totalSteps}
      </span>

      <button
        data-testid="guide-btn-exit"
        onClick={onExit}
        className="text-zinc-600 hover:text-zinc-300 text-[11px] font-semibold ml-1 transition-colors"
        aria-label="Exit guide"
      >
        ✕
      </button>
    </div>
  );
}
