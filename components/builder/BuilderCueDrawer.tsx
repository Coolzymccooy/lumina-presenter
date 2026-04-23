import React from 'react';
import type { ServiceItem, SpeakerTimerPreset } from '../../types';
import { XIcon } from '../Icons';
import { BuilderCuePanel } from './BuilderCuePanel';

interface BuilderCueDrawerProps {
  item: ServiceItem | null;
  speakerPresets: SpeakerTimerPreset[];
  onUpdateItem: (item: ServiceItem) => void;
  onClose: () => void;
}

export const BuilderCueDrawer: React.FC<BuilderCueDrawerProps> = ({
  item,
  speakerPresets,
  onUpdateItem,
  onClose,
}) => (
  <div
    data-testid="builder-cue-drawer"
    className="relative flex h-full min-h-0 items-center gap-3 border-y border-zinc-700/80 bg-[linear-gradient(180deg,rgba(39,39,42,0.98)_0%,rgba(24,24,27,0.98)_100%)] px-3 py-2 pr-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_-10px_24px_rgba(0,0,0,0.26)]"
  >
    <div className="flex h-full w-32 shrink-0 flex-col justify-center border-r border-zinc-700/70 pr-3">
      <div className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-300">Cue Engine</div>
      <div className="mt-1 truncate text-[11px] font-bold text-zinc-100">{item?.title || 'No item selected'}</div>
    </div>
    <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
      <div className="h-full min-w-[840px]">
        <BuilderCuePanel item={item} speakerPresets={speakerPresets} onUpdateItem={onUpdateItem} surface="drawer" />
      </div>
    </div>
    <button
      type="button"
      onClick={onClose}
      className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 text-zinc-300 shadow-lg hover:border-zinc-400 hover:text-white"
      aria-label="Close cue drawer"
      title="Close"
    >
      <XIcon className="h-3.5 w-3.5" />
    </button>
  </div>
);
