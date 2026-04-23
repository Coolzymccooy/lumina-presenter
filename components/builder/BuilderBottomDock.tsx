import React from 'react';
import type { ServiceItem, Slide, SpeakerTimerPreset } from '../../types';

interface BuilderBottomDockProps {
  item: ServiceItem | null;
  slide: Slide | null;
  slideIndex: number;
  slideCount: number;
  outputEnabled: boolean;
  speakerPresets: SpeakerTimerPreset[];
  onOpenCueDrawer: () => void;
}

export const BuilderBottomDock: React.FC<BuilderBottomDockProps> = ({
  item,
  slide,
  slideIndex,
  slideCount,
  outputEnabled,
  speakerPresets,
  onOpenCueDrawer,
}) => {
  const timerCue = item?.timerCue || { enabled: false, durationSec: 300 };
  const cueMinutes = Math.max(1, Math.round((timerCue.durationSec || 300) / 60));
  const cuePreset = timerCue.presetId ? speakerPresets.find((preset) => preset.id === timerCue.presetId) : null;
  const cueLabel = timerCue.enabled
    ? (cuePreset?.name || `Cue ${cueMinutes}m`)
    : '+ Enable Cue';

  return (
    <div data-testid="builder-bottom-dock" className="flex h-full min-h-0 items-stretch justify-between gap-3 bg-[linear-gradient(180deg,rgba(24,24,27,1)_0%,rgba(12,13,18,1)_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex min-w-0 flex-1 flex-col justify-between rounded-xl border border-zinc-800/80 bg-[#111218]/70 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-emerald-800/70 bg-emerald-950/40 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
            Saved
          </span>
          <span className={`rounded-md border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
            outputEnabled ? 'border-red-800/70 bg-red-950/40 text-red-200' : 'border-zinc-700 bg-[#15161b] text-zinc-300'
          }`}>
            Output {outputEnabled ? 'live' : 'off'}
          </span>
          <button
            type="button"
            data-testid="builder-open-cue-drawer"
            disabled={!item}
            onClick={onOpenCueDrawer}
            title={timerCue.enabled ? 'Adjust or disable the speaker cue timer' : 'Enable a speaker cue timer for this item'}
            className={`rounded-md border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-35 ${
              timerCue.enabled ? 'border-amber-700/70 bg-amber-950/40 text-amber-200' : 'border-cyan-700/60 bg-cyan-950/30 text-cyan-200 hover:border-cyan-500 hover:text-cyan-100'
            }`}
          >
            {cueLabel}
          </button>
        </div>
        <div className="mt-3 min-w-0">
          <div className="truncate text-base font-black text-zinc-100">{item?.title || 'No item selected'}</div>
          <div className="mt-0.5 truncate text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">
            {slide ? `${slideIndex + 1} of ${slideCount} - ${slide.label || `Slide ${slideIndex + 1}`}` : 'No slide selected'}
          </div>
        </div>
      </div>
    </div>
  );
};
