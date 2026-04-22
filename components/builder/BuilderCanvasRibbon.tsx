import React from 'react';
import type { ServiceItem, Slide } from '../../types';
import { EditIcon, PlusIcon } from '../Icons';
import { BuilderSlideQuickEdit } from './BuilderSlideQuickEdit';

interface BuilderCanvasRibbonProps {
  item: ServiceItem | null;
  slide: Slide | null;
  selectedElementId: string | null;
  selectedElementName?: string | null;
  showGrid: boolean;
  showSafeArea: boolean;
  zoom: number;
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
  onAddTextBlock: () => void;
  onToggleGrid: () => void;
  onToggleSafeArea: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onOpenBackgroundDrawer: () => void;
  onOpenFullEditor: () => void;
}

const RibbonButton = ({
  children,
  active = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => (
  <button
    type="button"
    {...props}
    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[9px] font-black uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
      active
        ? 'border-cyan-500 bg-cyan-950/45 text-cyan-200'
        : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white'
    } ${className}`}
  >
    {children}
  </button>
);

export const BuilderCanvasRibbon: React.FC<BuilderCanvasRibbonProps> = ({
  item,
  slide,
  selectedElementId,
  selectedElementName,
  showGrid,
  showSafeArea,
  zoom,
  onUpdateSlide,
  onAddTextBlock,
  onToggleGrid,
  onToggleSafeArea,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onOpenBackgroundDrawer,
  onOpenFullEditor,
}) => (
  <BuilderCanvasRibbonInner
    item={item}
    slide={slide}
    selectedElementId={selectedElementId}
    selectedElementName={selectedElementName}
    showGrid={showGrid}
    showSafeArea={showSafeArea}
    zoom={zoom}
    onUpdateSlide={onUpdateSlide}
    onAddTextBlock={onAddTextBlock}
    onToggleGrid={onToggleGrid}
    onToggleSafeArea={onToggleSafeArea}
    onZoomIn={onZoomIn}
    onZoomOut={onZoomOut}
    onZoomReset={onZoomReset}
    onOpenBackgroundDrawer={onOpenBackgroundDrawer}
    onOpenFullEditor={onOpenFullEditor}
  />
);

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const BuilderCanvasRibbonInner: React.FC<BuilderCanvasRibbonProps> = ({
  item,
  slide,
  selectedElementId,
  selectedElementName,
  showGrid,
  showSafeArea,
  zoom,
  onUpdateSlide,
  onAddTextBlock,
  onToggleGrid,
  onToggleSafeArea,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onOpenBackgroundDrawer,
  onOpenFullEditor,
}) => {
  const [quickEditOpen, setQuickEditOpen] = React.useState(false);
  React.useEffect(() => {
    setQuickEditOpen(false);
  }, [slide?.id]);

  const slidePreview = stripHtml(String(slide?.content || '')) || 'Type slide content here...';

  return (
  <div data-testid="builder-canvas-ribbon" className="relative shrink-0 border-b border-zinc-800 bg-[linear-gradient(180deg,rgba(31,32,38,0.98)_0%,rgba(17,18,24,0.98)_100%)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
    <div className="grid min-h-[50px] grid-cols-[minmax(130px,190px)_minmax(220px,1fr)_auto] items-start gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">Canvas</span>
          <span className="rounded border border-cyan-800 bg-cyan-950/40 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-cyan-200">
            Edit
          </span>
        </div>
        <div className="mt-1 truncate text-lg font-black text-white">{item?.title || 'Builder'}</div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">
          <span>{slide?.label || 'No slide'}</span>
          {selectedElementName && <span className="truncate text-cyan-300">Layer: {selectedElementName}</span>}
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-1 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">Slide Content</div>
        <button
          type="button"
          data-testid="builder-slide-content-trigger"
          disabled={!slide}
          onClick={() => setQuickEditOpen((value) => !value)}
          className="flex h-9 w-full items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-[#111218] px-3 text-left text-xs font-semibold text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="min-w-0 truncate">{slidePreview}</span>
          <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.16em] text-cyan-300">Edit</span>
        </button>
      </div>

      <div className="flex max-w-[430px] flex-wrap justify-end gap-1.5">
        <RibbonButton onClick={onAddTextBlock} disabled={!slide}>
          <PlusIcon className="h-3.5 w-3.5" />
          Text
        </RibbonButton>
        <RibbonButton data-testid="builder-open-background-drawer" onClick={onOpenBackgroundDrawer} disabled={!item}>
          BG
        </RibbonButton>
        <RibbonButton onClick={onToggleGrid} active={showGrid}>
          Grid
        </RibbonButton>
        <RibbonButton onClick={onToggleSafeArea} active={showSafeArea}>
          Safe
        </RibbonButton>
        <div className="flex h-8 items-center overflow-hidden rounded-lg border border-zinc-600 bg-[#111218]">
          <button type="button" onClick={onZoomOut} className="h-full px-2 text-xs font-black text-zinc-400 hover:bg-zinc-800 hover:text-white">-</button>
          <button type="button" onClick={onZoomReset} className="h-full border-x border-zinc-800 px-2 text-[9px] font-bold text-zinc-300">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={onZoomIn} className="h-full px-2 text-xs font-black text-zinc-400 hover:bg-zinc-800 hover:text-white">+</button>
        </div>
        <RibbonButton onClick={onOpenFullEditor} disabled={!item} className="border-blue-700/60 bg-blue-950/30 text-blue-200 hover:border-blue-500">
          <EditIcon className="h-3.5 w-3.5" />
          Full Editor
        </RibbonButton>
      </div>
    </div>
    {quickEditOpen && (
      <div className="absolute left-[204px] top-[62px] z-40 w-[520px] max-w-[calc(100%-220px)] rounded-xl border border-zinc-600 bg-[#15161b] p-2 shadow-2xl">
        <BuilderSlideQuickEdit
          item={item}
          slide={slide}
          selectedElementId={selectedElementId}
          onUpdateSlide={onUpdateSlide}
          variant="ribbon"
          showNotes={false}
        />
      </div>
    )}
  </div>
  );
};
