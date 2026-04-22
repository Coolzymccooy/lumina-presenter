import React from 'react';
import type { ServiceItem, Slide } from '../../types';
import { SlideCanvas } from '../slide-layout/editor/SlideCanvas';
import { PlusIcon } from '../Icons';

interface EditableSlideCanvasProps {
  item: ServiceItem | null;
  slide: Slide | null;
  selectedElementId: string | null;
  showGrid: boolean;
  showSafeArea: boolean;
  zoom: number;
  onSelectElement: (elementId: string | null) => void;
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
  onAddSlide: () => void;
}

export const EditableSlideCanvas: React.FC<EditableSlideCanvasProps> = ({
  item,
  slide,
  selectedElementId,
  showGrid,
  showSafeArea,
  zoom,
  onSelectElement,
  onUpdateSlide,
  onAddSlide,
}) => {
  return (
    <div
      data-testid="builder-editable-canvas"
      className="flex h-full min-h-0 flex-col bg-[#101116] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(31,32,38,0.96)_0%,rgba(19,20,26,0.98)_46%,rgba(13,14,19,1)_100%)] p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(113,113,122,0.12),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-zinc-500/30" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_30%,rgba(0,0,0,0.18))]" />
        <div className="relative h-full min-h-0 rounded-[22px] border border-zinc-700/60 bg-[#17181e]/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.24)]">
          {item && slide ? (
            <SlideCanvas
              slide={slide}
              item={item}
              selectedElementId={selectedElementId}
              showGrid={showGrid}
              showSafeArea={showSafeArea}
              zoom={zoom}
              chromeVariant="builder"
              onSelectElement={onSelectElement}
              onUpdateSlide={onUpdateSlide}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <button
                type="button"
                onClick={onAddSlide}
                disabled={!item}
                className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-600 bg-[#15161b]/90 px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300 hover:border-cyan-600 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <PlusIcon className="h-4 w-4" />
                Add First Slide
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
