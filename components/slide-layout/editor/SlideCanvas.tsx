import React from 'react';
import { MediaType, Slide, ServiceItem, TextSlideElement } from '../../../types.ts';
import { BackgroundRenderer } from '../render/BackgroundRenderer';
import { LogoOverlay } from '../render/LogoOverlay';
import { TEXT_CONTRAST_BACKGROUND_OVERLAY } from '../render/backgroundTone';
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
  zoom?: number;
  onSelectElement: (elementId: string | null) => void;
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
}

const clampZoom = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  return Math.min(4, Math.max(0.25, value));
};

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  item,
  selectedElementId,
  showGrid,
  showSafeArea,
  zoom = 1,
  onSelectElement,
  onUpdateSlide,
}) => {
  const safeZoom = clampZoom(zoom);
  const dragRef = React.useRef<{ type: 'move' | 'resize'; elementId: string; handle?: ResizeHandle; originX: number; originY: number } | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = React.useState({ width: 0, height: 0 });

  const elements = React.useMemo(() => (slide ? sortElementsByLayer(getRenderableElements(slide, item)) : []), [slide, item]);
  const backgroundUrl = React.useMemo(
    () => slide?.backgroundUrl || item?.theme?.backgroundUrl || '',
    [item?.theme?.backgroundUrl, slide?.backgroundUrl]
  );
  const backgroundMediaType = React.useMemo<MediaType>(
    () => {
      const effectiveUrl = String(backgroundUrl || '').trim();
      if (slide?.backgroundUrl) {
        if (slide.mediaType) return slide.mediaType;
      } else if (item?.theme?.mediaType) {
        return item.theme.mediaType;
      }
      if (effectiveUrl.startsWith('#')) return 'color';
      return 'image';
    },
    [backgroundUrl, item?.theme?.mediaType, slide?.backgroundUrl, slide?.mediaType]
  );
  const hasVisibleText = React.useMemo(
    () => elements.some((element) => element.type === 'text' && element.visible !== false && String(element.content || '').trim()),
    [elements]
  );
  const showTextContrastOverlay = Boolean(backgroundUrl && hasVisibleText && backgroundMediaType !== 'color');

  React.useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const nextWidth = entry?.contentRect?.width ?? node.clientWidth;
      const nextHeight = entry?.contentRect?.height ?? node.clientHeight;
      setViewportSize({ width: nextWidth, height: nextHeight });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const stageWidth = React.useMemo(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return 0;
    return Math.min(viewportSize.width, (viewportSize.height * 16) / 9);
  }, [viewportSize.height, viewportSize.width]);

  const stageHeight = React.useMemo(() => {
    if (stageWidth <= 0) return 0;
    return (stageWidth * 9) / 16;
  }, [stageWidth]);

  const stageStyle: React.CSSProperties | undefined = stageWidth > 0 && stageHeight > 0
    ? {
        width: `${stageWidth}px`,
        height: `${stageHeight}px`,
        transform: safeZoom === 1 ? undefined : `scale(${safeZoom})`,
        transformOrigin: 'center center',
      }
    : undefined;

  const scaledWrapperStyle: React.CSSProperties | undefined = stageWidth > 0 && stageHeight > 0
    ? {
        width: `${stageWidth * safeZoom}px`,
        height: `${stageHeight * safeZoom}px`,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }
    : undefined;

  const viewportClassName = safeZoom > 1
    ? 'flex h-full min-h-0 w-full items-center justify-center overflow-auto'
    : 'flex h-full min-h-0 w-full items-center justify-center overflow-hidden';

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

  const handleUpdateTextElement = React.useCallback(
    (elementId: string, updater: (element: TextSlideElement) => TextSlideElement) => {
      onUpdateSlide((currentSlide) => {
        const currentElements = getRenderableElements(currentSlide, item);
        const nextElements = currentElements.map((element) => {
          if (element.id !== elementId || element.type !== 'text') return element;
          return updater(element);
        });
        return { ...currentSlide, elements: nextElements };
      });
    },
    [item, onUpdateSlide]
  );

  if (!slide || !item) {
    return (
      <div ref={viewportRef} className={viewportClassName}>
        <div style={scaledWrapperStyle}>
          <div style={stageStyle} className={`rounded-lg border border-zinc-800 bg-black ${stageStyle ? '' : 'aspect-video w-full'}`} />
        </div>
      </div>
    );
  }

  return (
    <div ref={viewportRef} className={viewportClassName}>
      <div style={scaledWrapperStyle}>
      <div ref={hostRef} style={stageStyle} className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-[0_10px_30px_rgba(0,0,0,0.28)] ${stageStyle ? '' : 'aspect-video w-full'}`}>
        <BackgroundRenderer backgroundUrl={backgroundUrl} mediaType={backgroundMediaType} mediaFit={slide.mediaFit || 'cover'} />
        {showTextContrastOverlay && (
          <div className="absolute inset-0" style={{ background: TEXT_CONTRAST_BACKGROUND_OVERLAY }} />
        )}
        {slide.logoUrl ? (
          <LogoOverlay logoUrl={slide.logoUrl} position={slide.logoPosition} sizePercent={slide.logoSize} />
        ) : null}
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
                onUpdateElement={handleUpdateTextElement}
              />
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
};

