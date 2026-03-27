import React from 'react';
import { createPortal } from 'react-dom';
import { Slide, ServiceItem } from '../../../types.ts';
import { SlideRenderer } from '../../SlideRenderer';

interface SlideThumbnailsPanelProps {
  item: ServiceItem;
  slides: Slide[];
  activeSlideId: string | null;
  compact?: boolean;
  rail?: boolean;
  canPasteSlide: boolean;
  onSelectSlide: (slideId: string) => void;
  onAddSlide: () => void;
  onCopySlide: (slideId: string) => void;
  onPasteSlide: (afterSlideId: string | null) => void;
  onDuplicateSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onMoveSlide: (slideId: string, direction: -1 | 1) => void;
}

interface SlideContextMenuState {
  slideId: string;
  x: number;
  y: number;
}

const MENU_WIDTH = 188;
const MENU_HEIGHT = 244;

const ContextMenuItem = ({
  label,
  onClick,
  disabled = false,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
      destructive
        ? 'border-rose-900/60 bg-rose-950/20 text-rose-300 hover:border-rose-700 hover:text-rose-200'
        : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-600 hover:text-white'
    } disabled:cursor-not-allowed disabled:opacity-35`}
  >
    {label}
  </button>
);

export const SlideThumbnailsPanel: React.FC<SlideThumbnailsPanelProps> = ({
  item,
  slides,
  activeSlideId,
  compact = false,
  rail = false,
  canPasteSlide,
  onSelectSlide,
  onAddSlide,
  onCopySlide,
  onPasteSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
}) => {
  const [contextMenu, setContextMenu] = React.useState<SlideContextMenuState | null>(null);
  const canDeleteSlide = slides.length > 1;

  const closeContextMenu = React.useCallback(() => setContextMenu(null), []);

  React.useEffect(() => {
    if (!contextMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };
    const handleViewportChange = () => closeContextMenu();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [closeContextMenu, contextMenu]);

  const openContextMenu = React.useCallback((
    slideId: string,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectSlide(slideId);
    const x = Math.max(8, Math.min(event.clientX + 6, window.innerWidth - MENU_WIDTH - 8));
    const y = Math.max(8, Math.min(event.clientY + 6, window.innerHeight - MENU_HEIGHT - 8));
    setContextMenu({ slideId, x, y });
  }, [onSelectSlide]);

  const runMenuAction = React.useCallback((action: () => void) => {
    action();
    closeContextMenu();
  }, [closeContextMenu]);

  const contextSlide = contextMenu ? slides.find((slide) => slide.id === contextMenu.slideId) || null : null;
  const contextIndex = contextSlide ? slides.findIndex((slide) => slide.id === contextSlide.id) : -1;

  const contextMenuPortal = contextMenu && contextSlide && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="fixed inset-0 z-[170]"
        onMouseDown={closeContextMenu}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          data-testid="smart-slide-context-menu"
          className="absolute w-[188px] rounded-xl border border-zinc-700 bg-zinc-900/98 p-2 shadow-[0_14px_40px_rgba(0,0,0,0.48)] backdrop-blur-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="mb-2 border-b border-zinc-800 px-1 pb-2">
            <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Slide Menu</div>
            <div className="mt-1 truncate text-xs font-semibold text-zinc-100">{contextSlide.label || 'Slide'}</div>
          </div>
          <div className="space-y-1">
            <ContextMenuItem label="Select" onClick={() => runMenuAction(() => onSelectSlide(contextSlide.id))} />
            <ContextMenuItem label="Copy" onClick={() => runMenuAction(() => onCopySlide(contextSlide.id))} />
            <ContextMenuItem label="Paste After" disabled={!canPasteSlide} onClick={() => runMenuAction(() => onPasteSlide(contextSlide.id))} />
            <ContextMenuItem label="Duplicate" onClick={() => runMenuAction(() => onDuplicateSlide(contextSlide.id))} />
            <ContextMenuItem label="Move Up" disabled={contextIndex <= 0} onClick={() => runMenuAction(() => onMoveSlide(contextSlide.id, -1))} />
            <ContextMenuItem label="Move Down" disabled={contextIndex === -1 || contextIndex >= slides.length - 1} onClick={() => runMenuAction(() => onMoveSlide(contextSlide.id, 1))} />
            <ContextMenuItem label="Delete" destructive disabled={!canDeleteSlide} onClick={() => runMenuAction(() => onDeleteSlide(contextSlide.id))} />
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  const renderRailCard = (slide: Slide, index: number) => (
    <div
      key={slide.id}
      onContextMenu={(event) => openContextMenu(slide.id, event)}
      className={`rounded-lg border ${activeSlideId === slide.id ? 'border-cyan-500 bg-cyan-950/15' : 'border-zinc-800 bg-zinc-900/50'}`}
      title="Right-click for slide options"
    >
      <button type="button" onClick={() => onSelectSlide(slide.id)} className="w-full p-1.5 text-left">
        <div className="aspect-video overflow-hidden rounded border border-zinc-800 bg-black">
          <SlideRenderer slide={slide} item={{ ...item, slides }} fitContainer={true} isThumbnail={true} />
        </div>
        <div className="mt-1 truncate text-[10px] font-bold text-zinc-200">{index + 1}. {slide.label || `Slide ${index + 1}`}</div>
      </button>
      <div className="grid grid-cols-2 gap-px border-t border-zinc-800 bg-zinc-800">
        <button type="button" onClick={() => onMoveSlide(slide.id, -1)} className="bg-zinc-950 px-1.5 py-1 text-[8px] font-bold text-zinc-400 hover:text-white">UP</button>
        <button type="button" onClick={() => onMoveSlide(slide.id, 1)} className="bg-zinc-950 px-1.5 py-1 text-[8px] font-bold text-zinc-400 hover:text-white">DN</button>
        <button type="button" onClick={() => onCopySlide(slide.id)} className="bg-zinc-950 px-1.5 py-1 text-[8px] font-bold text-zinc-400 hover:text-white">COPY</button>
        <button type="button" onClick={() => onDeleteSlide(slide.id)} className="bg-zinc-950 px-1.5 py-1 text-[8px] font-bold text-rose-300 hover:text-rose-200">DEL</button>
      </div>
    </div>
  );

  const renderCompactCard = (slide: Slide, index: number) => (
    <div
      key={slide.id}
      onContextMenu={(event) => openContextMenu(slide.id, event)}
      className={`min-w-[10rem] max-w-[10rem] rounded-lg border ${activeSlideId === slide.id ? 'border-cyan-500 bg-cyan-950/10' : 'border-zinc-800 bg-zinc-900/60'}`}
      title="Right-click for slide options"
    >
      <button type="button" onClick={() => onSelectSlide(slide.id)} className="w-full p-2 text-left">
        <div className="aspect-video overflow-hidden rounded border border-zinc-800 bg-black">
          <SlideRenderer slide={slide} item={{ ...item, slides }} fitContainer={true} isThumbnail={true} />
        </div>
        <div className="mt-2 truncate text-xs font-bold text-zinc-200">{slide.label || `Slide ${index + 1}`}</div>
      </button>
      <div className="grid grid-cols-4 gap-px border-t border-zinc-800 bg-zinc-800">
        <button type="button" onClick={() => onMoveSlide(slide.id, -1)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">UP</button>
        <button type="button" onClick={() => onMoveSlide(slide.id, 1)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">DN</button>
        <button type="button" onClick={() => onCopySlide(slide.id)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">COPY</button>
        <button type="button" onClick={() => onDeleteSlide(slide.id)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-rose-300 hover:text-rose-200">DEL</button>
      </div>
    </div>
  );

  const renderDefaultCard = (slide: Slide, index: number) => (
    <div
      key={slide.id}
      onContextMenu={(event) => openContextMenu(slide.id, event)}
      className={`rounded-lg border ${activeSlideId === slide.id ? 'border-cyan-500 bg-cyan-950/10' : 'border-zinc-800 bg-zinc-900/60'}`}
      title="Right-click for slide options"
    >
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
        <button type="button" onClick={() => onCopySlide(slide.id)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-zinc-400 hover:text-white">COPY</button>
        <button type="button" onClick={() => onDeleteSlide(slide.id)} className="bg-zinc-950 px-2 py-2 text-[9px] font-bold text-rose-300 hover:text-rose-200">DEL</button>
      </div>
    </div>
  );

  if (rail) {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col border-r border-zinc-800 bg-[#05070e]">
          <div className="border-b border-zinc-800 px-2 py-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-2.5 py-2">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Slides</div>
              <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/20 p-1">
                <button type="button" onClick={() => onPasteSlide(activeSlideId)} disabled={!canPasteSlide} className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[9px] font-bold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-35">
                  Paste
                </button>
                <button type="button" onClick={onAddSlide} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-[11px] font-bold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white">
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2 custom-scrollbar">
            {slides.map((slide, index) => renderRailCard(slide, index))}
          </div>
        </div>
        {contextMenuPortal}
      </>
    );
  }

  if (compact) {
    return (
      <>
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto custom-scrollbar">
          {slides.map((slide, index) => renderCompactCard(slide, index))}
          <button type="button" onClick={onAddSlide} className="flex min-h-[7rem] min-w-[8rem] items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-950/80 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 hover:text-zinc-200">
            Add Slide
          </button>
        </div>
        {contextMenuPortal}
      </>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Slides</div>
            <div className="mt-1 text-xs text-zinc-300">{item.title}</div>
          </div>
          <button type="button" onClick={onAddSlide} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-100">ADD</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {slides.map((slide, index) => renderDefaultCard(slide, index))}
        </div>
      </div>
      {contextMenuPortal}
    </>
  );
};
