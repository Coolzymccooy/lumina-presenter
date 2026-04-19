import React from 'react';
import { TextSlideElement } from '../../../types.ts';
import { TextElementRenderer } from '../render/TextElementRenderer';
import { CanvasChrome } from './CanvasChrome.tsx';
import { ResizeHandle } from '../utils/resizeMath.ts';

interface TextElementEditorProps {
  element: TextSlideElement;
  selected: boolean;
  onSelect: (elementId: string) => void;
  onDragStart: (elementId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onResizeStart: (elementId: string, handle: ResizeHandle, event: React.PointerEvent<HTMLButtonElement>) => void;
  onUpdateElement?: (elementId: string, updater: (element: TextSlideElement) => TextSlideElement) => void;
}

const CLICK_VS_DRAG_THRESHOLD_PX = 4;

export const TextElementEditor: React.FC<TextElementEditorProps> = ({
  element,
  selected,
  onSelect,
  onDragStart,
  onResizeStart,
  onUpdateElement,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const originalContentRef = React.useRef<string>(String(element.content ?? ''));
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const pointerOriginRef = React.useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const dragStartedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isEditing) return;
    const node = textareaRef.current;
    if (!node) return;
    node.focus();
    const length = node.value.length;
    node.setSelectionRange(length, length);
  }, [isEditing]);

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

  const isFocusLeavingEditor = React.useCallback((event: React.FocusEvent<HTMLTextAreaElement>): boolean => {
    const next = event.relatedTarget as HTMLElement | null;
    if (!next) return true;
    // Keep edit mode when focus moves to ribbon/inspector controls so Format
    // buttons (bold/italic/font/etc.) can operate on the text without kicking
    // the user out of the textarea.
    if (next.closest('[data-ribbon-root]') || next.closest('[data-inspector-root]')) return false;
    return true;
  }, []);

  const style = element.style || {};

  return (
    <>
      <div
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
          // Canva-style: pure click → edit, click-drag → move. Decide at pointer-up.
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
          <textarea
            ref={textareaRef}
            data-testid={`smart-canvas-element-${element.id}-input`}
            value={String(element.content ?? '')}
            onChange={(event) => {
              const next = event.target.value;
              onUpdateElement?.(element.id, (current) => ({ ...current, content: next }));
            }}
            onBlur={(event) => {
              if (isFocusLeavingEditor(event)) setIsEditing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
                return;
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setIsEditing(false);
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute inset-0 h-full w-full resize-none rounded border border-cyan-400/70 bg-black/20 px-2 py-1 outline-none focus:border-cyan-300"
            style={{
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              fontStyle: style.fontStyle,
              color: style.color || '#ffffff',
              textAlign: style.textAlign || 'left',
              lineHeight: style.lineHeight,
              letterSpacing: Number.isFinite(style.letterSpacing) ? Number(style.letterSpacing) : undefined,
              textTransform: style.textTransform,
            }}
          />
        ) : (
          <TextElementRenderer element={element} isSelected={selected} layoutMode="fill-parent" />
        )}
      </div>
      {selected && !isEditing && (
        <CanvasChrome frame={element.frame} locked={element.locked} onResizeStart={(handle, event) => onResizeStart(element.id, handle, event)} />
      )}
    </>
  );
};
