import React from 'react';
import { Slide, ServiceItem } from '../../../types.ts';
import { BackgroundRenderer } from '../render/BackgroundRenderer';
import { getRenderableElements } from '../utils/slideHydration.ts';
import { sortElementsByLayer } from '../utils/frameMath.ts';
import { SafeAreaOverlay } from './SafeAreaOverlay.tsx';
import { TextElementEditor } from './TextElementEditor.tsx';
import { ResizeHandle, resizeFrame } from '../utils/resizeMath.ts';
import { nudgeFrame } from '../utils/frameMath.ts';

interface SlideCanvasProps {
  slide: Slide | null;
  item: ServiceItem | null;
  selectedElementId: string | null;
  showGrid: boolean;
  showSafeArea: boolean;
  onSelectElement: (elementId: string | null) => void;
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  item,
  selectedElementId,
  showGrid,
  showSafeArea,
  onSelectElement,
  onUpdateSlide,
}) => {
  const dragRef = React.useRef<{ type: 'move' | 'resize'; elementId: string; handle?: ResizeHandle; originX: number; originY: number } | null>(null);
  const hostRef = React.useRef<HTMLDivElement | null>(null);

  const elements = React.useMemo(() => (slide ? sortElementsByLayer(getRenderableElements(slide, item)) : []), [slide, item]);

  const commitPointerMove = React.useCallback((event: PointerEvent) => {
    const active = dragRef.current;
    const host = hostRef.current;
    if (!active || !host || !slide) return;
    const rect = host.getBoundingClientRect();
    const deltaX = (event.clientX - active.originX) / rect.width;
    const deltaY = (event.clientY - active.originY) / rect.height;
    dragRef.current = { ...active, originX: event.clientX, originY: event.clientY };

    onUpdateSlide((currentSlide) => {
      const currentElements = getRenderableElements(currentSlide, item);
      const nextElements = currentElements.map((element) => {
        if (element.id !== active.elementId || element.type !== 'text') return element;
        const nextFrame = active.type === 'move'
          ? nudgeFrame(element.frame, deltaX, deltaY)
          : resizeFrame(element.frame, active.handle || 'se', deltaX, deltaY);
        return { ...element, frame: nextFrame };
      });
      return { ...currentSlide, elements: nextElements };
    });
  }, [item, onUpdateSlide, slide]);

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => commitPointerMove(event);
    const handlePointerUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [commitPointerMove]);

  if (!slide || !item) {
    return <div className="aspect-video w-full rounded-lg border border-zinc-800 bg-black" />;
  }

  return (
    <div className="w-full">
      <div ref={hostRef} className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
        <BackgroundRenderer backgroundUrl={slide.backgroundUrl || item.theme.backgroundUrl} mediaType={slide.mediaType || item.theme.mediaType} mediaFit={slide.mediaFit || 'cover'} />
        <div className="absolute inset-0 bg-black/10" />
        <SafeAreaOverlay showGrid={showGrid} showSafeArea={showSafeArea} />
        <div className="absolute inset-0" onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelectElement(null);
        }}>
          {elements.map((element) => {
            if (element.type !== 'text') return null;
            return (
              <TextElementEditor
                key={element.id}
                element={element}
                selected={selectedElementId === element.id}
                onSelect={onSelectElement}
                onDragStart={(elementId, event) => {
                  event.preventDefault();
                  dragRef.current = { type: 'move', elementId, originX: event.clientX, originY: event.clientY };
                }}
                onResizeStart={(elementId, handle, event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dragRef.current = { type: 'resize', elementId, handle, originX: event.clientX, originY: event.clientY };
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

