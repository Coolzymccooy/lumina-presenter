import React from 'react';
import type { ServiceItem, Slide } from '../../types';
import { SlideRenderer } from '../SlideRenderer';
import { PlusIcon, TrashIcon, CopyIcon } from '../Icons';

interface SlideTimelineStripProps {
  item: ServiceItem | null;
  selectedSlideId: string | null;
  activeItemId: string | null;
  activeSlideIndex: number;
  onSelectSlide: (slideId: string) => void;
  onGoLive: (slideIndex: number) => void;
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
}

export const SlideTimelineStrip: React.FC<SlideTimelineStripProps> = ({
  item,
  selectedSlideId,
  activeItemId,
  activeSlideIndex,
  onSelectSlide,
  onGoLive,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
}) => {
  const slides = item?.slides || [];

  const renderSlide = (slide: Slide, index: number) => {
    const selected = slide.id === selectedSlideId;
    const live = item?.id === activeItemId && index === activeSlideIndex;
    const slideName = slide.label || `Slide ${index + 1}`;

    return (
      <button
        key={slide.id}
        type="button"
        data-testid={`builder-slide-strip-item-${slide.id}`}
        title={`${index + 1}. ${slideName}`}
        onClick={() => onSelectSlide(slide.id)}
        onDoubleClick={() => onGoLive(index)}
        className={`group relative h-[90px] w-32 shrink-0 rounded-xl border bg-[linear-gradient(180deg,rgba(39,39,42,0.96)_0%,rgba(21,22,27,1)_100%)] p-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_20px_rgba(0,0,0,0.2)] transition-all ${
          live
            ? 'border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]'
            : selected
              ? 'border-zinc-200 shadow-[0_0_0_1px_rgba(255,255,255,0.26),inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'border-zinc-700/70 hover:border-zinc-500'
        }`}
      >
        <div className="rounded-lg border border-zinc-600/70 bg-[#202127] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="relative aspect-video overflow-hidden rounded-md border border-zinc-800/80 bg-[#090a0f] shadow-[0_8px_18px_rgba(0,0,0,0.28)]">
            <div className="pointer-events-none absolute inset-0 z-[1] rounded-md border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
            <div className="absolute inset-0 pointer-events-none">
              <SlideRenderer slide={slide} item={item} fitContainer isThumbnail />
            </div>
          </div>
          {live && (
            <div className="absolute left-1 top-1 rounded bg-red-600 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.16em] text-white">
              Live
            </div>
          )}
        </div>
        <div className="mt-1 flex min-h-[13px] items-center justify-between gap-1">
          <div className="min-w-0 truncate text-[9px] font-mono font-black leading-none text-zinc-100">
            {index + 1}. {slideName}
          </div>
          {selected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />}
        </div>
      </button>
    );
  };

  return (
    <div data-testid="builder-slide-timeline" className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(24,24,27,0.98)_0%,rgba(12,13,18,1)_100%)]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">Slide Strip</div>
          <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400">{slides.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAddSlide}
            disabled={!item}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-cyan-700/60 bg-cyan-950/30 px-2 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200 hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <PlusIcon className="h-3 w-3" />
            Add
          </button>
          <button
            type="button"
            onClick={onDuplicateSlide}
            disabled={!selectedSlideId}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-600 bg-[#15161b] px-2 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <CopyIcon className="h-3 w-3" />
            Dupe
          </button>
          <button
            type="button"
            onClick={onDeleteSlide}
            disabled={!selectedSlideId}
            className="inline-flex h-7 items-center justify-center rounded-lg border border-zinc-600 bg-[#15161b] px-2 text-rose-300 hover:border-rose-700 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Delete selected slide"
            title="Delete selected slide"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-start gap-2 overflow-x-auto bg-[#15161b]/78 px-3 py-2 custom-scrollbar">
        {slides.map(renderSlide)}
        {!slides.length && (
          <button
            type="button"
            onClick={onAddSlide}
            disabled={!item}
            className="flex h-[90px] w-32 shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-[#15161b] text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 hover:border-cyan-700 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Add Slide
          </button>
        )}
      </div>
    </div>
  );
};
