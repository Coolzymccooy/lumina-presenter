import React from 'react';
import { Slide, ServiceItem } from '../../../types.ts';
import { SlideRenderer } from '../../SlideRenderer';

interface SlideThumbnailsPanelProps {
  item: ServiceItem;
  slides: Slide[];
  activeSlideId: string | null;
  compact?: boolean;
  rail?: boolean;
  onSelectSlide: (slideId: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onMoveSlide: (slideId: string, direction: -1 | 1) => void;
}

export const SlideThumbnailsPanel: React.FC<SlideThumbnailsPanelProps> = ({
  item,
  slides,
  activeSlideId,
  compact = false,
  rail = false,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
}) => {
  if (rail) {
    return (
      <div className="flex h-full min-h-0 flex-col border-r border-zinc-800 bg-[#05070e]">
        <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Slides</div>
          <button type="button" onClick={onAddSlide} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[9px] font-bold text-zinc-200">+</button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-2 custom-scrollbar">
          {slides.map((slide, index) => (
            <div key={slide.id} className={`rounded-lg border ${activeSlideId === slide.id ? 'border-cyan-500 bg-cyan-950/15' : 'border-zinc-800 bg-zinc-900/50'}`}>
              <button type="button" onClick={() => onSelectSlide(slide.id)} className="w-full p-1.5 text-left">
                <div className="aspect-video overflow-hidden rounded border border-zinc-800 bg-black">
                  <SlideRenderer slide={slide} item={{ ...item, slides }} fitContainer={true} isThumbnail={true} />
                </div>
                <div className="mt-1 truncate text-[10px] font-bold text-zinc-200">{index + 1}. {slide.label || `Slide ${index + 1}`}</div>
              </button>
              <div className="grid grid-cols-2 gap-px border-t border-zinc-800 bg-zinc-800">
                <button type="button" onClick={() => onMoveSlide(slide.id, -1)} className="bg-zinc-950 px-1.5 py-1 text-[8px] font-bold text-zinc-400 hover:text-white">UP</button>
                <button type="button" onClick={() => onMoveSlide(slide.id, 1)} className="bg-zinc-950 px-1.5 py-1 text-[8px] font-bold text-zinc-400 hover:text-white">DN</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto custom-scrollbar">
        {slides.map((slide, index) => (
          <div key={slide.id} className={`min-w-[10rem] max-w-[10rem] rounded-lg border ${activeSlideId === slide.id ? 'border-cyan-500 bg-cyan-950/10' : 'border-zinc-800 bg-zinc-900/60'}`}>
            <button type="button" onClick={() => onSelectSlide(slide.id)} className="w-full p-2 text-left">
              <div className="aspect-video overflow-hidden rounded border border-zinc-800 bg-black">
                <SlideRenderer slide={slide} item={{ ...item, slides }} fitContainer={true} isThumbnail={true} />
              </div>
              <div className="mt-2 truncate text-xs font-bold text-zinc-200">{slide.label || `Slide ${index + 1}`}</div>
            </button>
            <div className="grid grid-cols-4 gap-px border-t border-zinc-800 bg-zinc-800">
              <button type="button" onClick={() => onMoveSlide(slide.id, -1)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">UP</button>
              <button type="button" onClick={() => onMoveSlide(slide.id, 1)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">DN</button>
              <button type="button" onClick={() => onDuplicateSlide(slide.id)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">COPY</button>
              <button type="button" onClick={() => onDeleteSlide(slide.id)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-rose-300 hover:text-rose-200">DEL</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={onAddSlide} className="flex min-h-[7rem] min-w-[8rem] items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-950/80 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 hover:text-zinc-200">
          Add Slide
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Slides</div>
          <div className="mt-1 text-xs text-zinc-300">{item.title}</div>
        </div>
        <button type="button" onClick={onAddSlide} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-100">ADD</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {slides.map((slide, index) => (
          <div key={slide.id} className={`rounded-lg border ${activeSlideId === slide.id ? 'border-cyan-500 bg-cyan-950/10' : 'border-zinc-800 bg-zinc-900/60'}`}>
            <button type="button" onClick={() => onSelectSlide(slide.id)} className="w-full p-2 text-left">
              <div className="aspect-video overflow-hidden rounded border border-zinc-800 bg-black">
                <SlideRenderer slide={slide} item={{ ...item, slides }} fitContainer={true} isThumbnail={true} />
              </div>
              <div className="mt-2 truncate text-xs font-bold text-zinc-200">{slide.label || `Slide ${index + 1}`}</div>
              <div className="truncate text-[10px] text-zinc-500">{slide.layoutType || slide.type || 'custom'}</div>
            </button>
            <div className="grid grid-cols-4 gap-px border-t border-zinc-800 bg-zinc-800">
              <button type="button" onClick={() => onMoveSlide(slide.id, -1)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">UP</button>
              <button type="button" onClick={() => onMoveSlide(slide.id, 1)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">DN</button>
              <button type="button" onClick={() => onDuplicateSlide(slide.id)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">COPY</button>
              <button type="button" onClick={() => onDeleteSlide(slide.id)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-rose-300 hover:text-rose-200">DEL</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

