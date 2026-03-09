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
}

export const TextElementEditor: React.FC<TextElementEditorProps> = ({
  element,
  selected,
  onSelect,
  onDragStart,
  onResizeStart,
}) => {
  return (
    <>
      <div
        data-testid={`smart-canvas-element-${element.id}`}
        className="absolute cursor-move"
        style={{
          left: `${element.frame.x * 100}%`,
          top: `${element.frame.y * 100}%`,
          width: `${element.frame.width * 100}%`,
          height: `${element.frame.height * 100}%`,
          zIndex: element.frame.zIndex + 50,
        }}
        onPointerDown={(event) => {
          if (element.locked) {
            onSelect(element.id);
            return;
          }
          onSelect(element.id);
          onDragStart(element.id, event);
        }}
      >
        <TextElementRenderer element={element} isSelected={selected} layoutMode="fill-parent" />
      </div>
      {selected && (
        <CanvasChrome frame={element.frame} locked={element.locked} onResizeStart={(handle, event) => onResizeStart(element.id, handle, event)} />
      )}
    </>
  );
};

