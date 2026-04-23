import React from 'react';
import { TextSlideElement } from '../../../types.ts';
import { TextElementRenderer } from '../render/TextElementRenderer';
import { CanvasChrome } from './CanvasChrome.tsx';
import { ResizeHandle } from '../utils/resizeMath.ts';
import { CanvasFormatToolbar } from './CanvasFormatToolbar';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../utils/frameMath.ts';

interface TextElementEditorProps {
  element: TextSlideElement;
  selected: boolean;
  onSelect: (elementId: string) => void;
  onDragStart: (elementId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onResizeStart: (elementId: string, handle: ResizeHandle, event: React.PointerEvent<HTMLButtonElement>) => void;
  onUpdateElement?: (elementId: string, updater: (element: TextSlideElement) => TextSlideElement) => void;
}

const CLICK_VS_DRAG_THRESHOLD_PX = 4;

const placeCaretAtEnd = (node: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
};

export function TextElementEditor({
  element,
  selected,
  onSelect,
  onDragStart,
  onResizeStart,
  onUpdateElement,
}: TextElementEditorProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const originalContentRef = React.useRef<string>(String(element.content ?? ''));
  const outerRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const pointerOriginRef = React.useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const dragStartedRef = React.useRef(false);
  const lastEditingElementIdRef = React.useRef<string | null>(null);

  const style = element.style || {};
  const baseFontSize = Number(style.fontSize || 56);
  const [renderScale, setRenderScale] = React.useState(1);
  const [fittedFontSize, setFittedFontSize] = React.useState(baseFontSize);
  const [contentTick, setContentTick] = React.useState(0);

  // Track the outer frame size against normalized frame so the editor uses
  // the same scale the static renderer uses — keeps edit-mode text visually
  // matched to the rendered slide instead of jumping to raw style.fontSize.
  React.useLayoutEffect(() => {
    const node = outerRef.current;
    if (!node) return;
    const updateScale = () => {
      const heightScale = element.frame.height > 0 ? node.clientHeight / (element.frame.height * CANVAS_HEIGHT) : 1;
      const widthScale = element.frame.width > 0 ? node.clientWidth / (element.frame.width * CANVAS_WIDTH) : 1;
      const nextScale = Math.min(
        Number.isFinite(widthScale) && widthScale > 0 ? widthScale : 1,
        Number.isFinite(heightScale) && heightScale > 0 ? heightScale : 1,
      );
      setRenderScale((current) => (Math.abs(current - nextScale) > 0.001 ? nextScale : current));
    };
    updateScale();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(node);
    return () => observer.disconnect();
  }, [element.frame.height, element.frame.width]);

  // Binary-search the largest font size that fits the frame. Re-runs when the
  // user types, pastes, or swaps elements — bulk paste auto-compacts instead
  // of overflowing the frame.
  const fitSignature = [
    element.content,
    style.fontFamily,
    style.fontWeight,
    style.fontStyle,
    style.textDecoration,
    style.textAlign,
    style.lineHeight,
    style.letterSpacing,
    style.textTransform,
    style.padding,
  ].join('|');

  React.useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = editorRef.current;
    if (!outer || !inner) return;
    const availableWidth = outer.clientWidth;
    const availableHeight = outer.clientHeight;
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scaledBaseFontSize = Math.max(1, baseFontSize * renderScale);
    const minimumFontSize = Math.max(10 * renderScale, Math.min(scaledBaseFontSize, 18 * renderScale));

    const applySize = (value: number) => {
      inner.style.fontSize = `${value}px`;
    };
    const fits = () => inner.scrollHeight <= availableHeight + 1 && inner.scrollWidth <= availableWidth + 1;

    let nextFontSize = scaledBaseFontSize;
    applySize(nextFontSize);
    if (!fits()) {
      let low = minimumFontSize;
      let high = scaledBaseFontSize;
      let best = minimumFontSize;
      applySize(low);
      if (fits()) {
        while (high - low > 0.5) {
          const mid = (low + high) / 2;
          applySize(mid);
          if (fits()) {
            best = mid;
            low = mid;
          } else {
            high = mid;
          }
        }
        nextFontSize = best;
      } else {
        nextFontSize = minimumFontSize;
      }
    }
    setFittedFontSize((current) => (Math.abs(current - nextFontSize) > 0.2 ? nextFontSize : current));
  }, [baseFontSize, renderScale, fitSignature, contentTick, isEditing]);

  // Seed the contentEditable with current content once per edit session.
  // Do NOT re-seed on every element.content change — that would wipe the
  // selection and cursor as the user types.
  React.useEffect(() => {
    if (!isEditing) {
      lastEditingElementIdRef.current = null;
      return;
    }
    const node = editorRef.current;
    if (!node) return;
    if (lastEditingElementIdRef.current !== element.id) {
      node.innerHTML = String(element.content ?? '');
      lastEditingElementIdRef.current = element.id;
    }
    node.focus();
    placeCaretAtEnd(node);
  }, [isEditing, element.id]);

  React.useEffect(() => {
    if (!selected && isEditing) {
      setIsEditing(false);
    }
  }, [selected, isEditing]);

  const canEdit = Boolean(onUpdateElement) && !element.locked;

  const enterEditMode = React.useCallback(() => {
    if (!canEdit) return;
    originalContentRef.current = String(element.content ?? '');
    setIsEditing(true);
  }, [canEdit, element.content]);

  const cancel = React.useCallback(() => {
    if (onUpdateElement) {
      const original = originalContentRef.current;
      onUpdateElement(element.id, (current) => ({ ...current, content: original }));
    }
    setIsEditing(false);
  }, [element.id, onUpdateElement]);

  const commitContent = React.useCallback(() => {
    const node = editorRef.current;
    if (!node || !onUpdateElement) return;
    const next = node.innerHTML;
    onUpdateElement(element.id, (current) => ({ ...current, content: next }));
    setContentTick((tick) => tick + 1);
  }, [element.id, onUpdateElement]);

  const isFocusLeavingEditor = React.useCallback((event: React.FocusEvent<HTMLDivElement>): boolean => {
    const next = event.relatedTarget as HTMLElement | null;
    if (!next) return true;
    // Keep edit mode when focus moves to ribbon/inspector/canvas-toolbar controls
    // so format buttons (bold/italic/font/etc.) can operate on the text without
    // kicking the user out of edit mode.
    if (
      next.closest('[data-ribbon-root]') ||
      next.closest('[data-inspector-root]') ||
      next.closest('[data-canvas-toolbar-root]')
    ) {
      return false;
    }
    return true;
  }, []);

  const scaledLetterSpacing = Number.isFinite(style.letterSpacing as number)
    ? Number(style.letterSpacing) * renderScale
    : undefined;

  return (
    <>
      <div
        ref={outerRef}
        data-testid={`smart-canvas-element-${element.id}`}
        className={`absolute ${isEditing ? 'cursor-text' : 'cursor-move'}`}
        style={{
          left: `${element.frame.x * 100}%`,
          top: `${element.frame.y * 100}%`,
          width: `${element.frame.width * 100}%`,
          height: `${element.frame.height * 100}%`,
          zIndex: element.frame.zIndex + 50,
        }}
        onPointerDown={(event) => {
          if (isEditing) {
            event.stopPropagation();
            return;
          }
          if (element.locked) {
            onSelect(element.id);
            return;
          }
          if (!canEdit) {
            onSelect(element.id);
            onDragStart(element.id, event);
            return;
          }
          onSelect(element.id);
          pointerOriginRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
          dragStartedRef.current = false;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // setPointerCapture can throw if pointer already released — safe to ignore.
          }
        }}
        onPointerMove={(event) => {
          const origin = pointerOriginRef.current;
          if (!origin || dragStartedRef.current || isEditing) return;
          const dx = event.clientX - origin.x;
          const dy = event.clientY - origin.y;
          if (Math.hypot(dx, dy) < CLICK_VS_DRAG_THRESHOLD_PX) return;
          dragStartedRef.current = true;
          try {
            event.currentTarget.releasePointerCapture(origin.pointerId);
          } catch {
            // releasePointerCapture can throw if pointer already released — safe to ignore.
          }
          onDragStart(element.id, event);
        }}
        onPointerUp={(event) => {
          const hadOrigin = pointerOriginRef.current !== null;
          const wasDragging = dragStartedRef.current;
          pointerOriginRef.current = null;
          dragStartedRef.current = false;
          if (hadOrigin && !wasDragging && canEdit && !isEditing) {
            event.stopPropagation();
            enterEditMode();
          }
        }}
        onPointerCancel={() => {
          pointerOriginRef.current = null;
          dragStartedRef.current = false;
        }}
        onDoubleClick={(event) => {
          if (!canEdit) return;
          event.stopPropagation();
          onSelect(element.id);
          enterEditMode();
        }}
      >
        {isEditing ? (
          <div
            className="absolute inset-0 flex"
            style={{
              alignItems:
                style.verticalAlign === 'middle' ? 'center'
                : style.verticalAlign === 'bottom' ? 'flex-end'
                : 'flex-start',
              justifyContent:
                style.textAlign === 'center' ? 'center'
                : style.textAlign === 'right' ? 'flex-end'
                : 'flex-start',
            }}
          >
            <div
              ref={editorRef}
              role="textbox"
              aria-multiline="true"
              contentEditable
              suppressContentEditableWarning
              data-testid={`smart-canvas-element-${element.id}-input`}
              onInput={commitContent}
              onBlur={(event) => {
                if (isFocusLeavingEditor(event)) {
                  commitContent();
                  setIsEditing(false);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancel();
                  return;
                }
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  commitContent();
                  setIsEditing(false);
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  // Prevent browsers from wrapping new lines in <div>/<p>,
                  // which produces visible double-spacing. Force a single <br>.
                  event.preventDefault();
                  document.execCommand('insertLineBreak');
                }
              }}
              onPaste={(event) => {
                const clipboard = event.clipboardData;
                if (!clipboard) return;
                event.preventDefault();
                const raw = clipboard.getData('text/plain');
                if (!raw) return;
                const escaped = raw
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\r\n?/g, '\n');
                const html = escaped.split('\n').join('<br>');
                document.execCommand('insertHTML', false, html);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-full w-full whitespace-pre-wrap break-words outline-none ring-1 ring-cyan-400/70 focus:ring-cyan-300"
              style={{
                fontFamily: style.fontFamily,
                fontSize: fittedFontSize,
                fontWeight: style.fontWeight,
                fontStyle: style.fontStyle,
                color: style.color || '#ffffff',
                textAlign: style.textAlign || 'left',
                lineHeight: style.lineHeight,
                letterSpacing: scaledLetterSpacing,
                textTransform: style.textTransform,
              }}
            />
          </div>
        ) : (
          <TextElementRenderer element={element} isSelected={selected} layoutMode="fill-parent" />
        )}
      </div>
      {selected && !isEditing && (
        <CanvasChrome frame={element.frame} locked={element.locked} onResizeStart={(handle, event) => onResizeStart(element.id, handle, event)} />
      )}
      <CanvasFormatToolbar
        anchorRef={outerRef}
        editorRef={editorRef}
        visible={isEditing}
        align={style.textAlign as 'left' | 'center' | 'right' | undefined}
        onAlignChange={(nextAlign) => {
          onUpdateElement?.(element.id, (current) => ({
            ...current,
            style: { ...(current.style || {}), textAlign: nextAlign },
          }));
        }}
        onAfterCommand={commitContent}
      />
    </>
  );
}
