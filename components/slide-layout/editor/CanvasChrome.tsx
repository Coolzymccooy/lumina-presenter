import React from 'react';
import { ElementFrame } from '../../../types.ts';
import { ResizeHandle } from '../utils/resizeMath.ts';

interface CanvasChromeProps {
  frame: ElementFrame;
  locked?: boolean;
  onResizeStart: (handle: ResizeHandle, event: React.PointerEvent<HTMLButtonElement>) => void;
}

const handles: Array<{ handle: ResizeHandle; className: string }> = [
  { handle: 'nw', className: 'left-[-4px] top-[-4px] cursor-nwse-resize' },
  { handle: 'n', className: 'left-1/2 top-[-4px] -translate-x-1/2 cursor-ns-resize' },
  { handle: 'ne', className: 'right-[-4px] top-[-4px] cursor-nesw-resize' },
  { handle: 'e', className: 'right-[-4px] top-1/2 -translate-y-1/2 cursor-ew-resize' },
  { handle: 'se', className: 'bottom-[-4px] right-[-4px] cursor-nwse-resize' },
  { handle: 's', className: 'bottom-[-4px] left-1/2 -translate-x-1/2 cursor-ns-resize' },
  { handle: 'sw', className: 'bottom-[-4px] left-[-4px] cursor-nesw-resize' },
  { handle: 'w', className: 'left-[-4px] top-1/2 -translate-y-1/2 cursor-ew-resize' },
];

export const CanvasChrome: React.FC<CanvasChromeProps> = ({ frame, locked = false, onResizeStart }) => {
  return (
    <div
      className="pointer-events-none absolute border border-cyan-400/90 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
      style={{
        left: `${frame.x * 100}%`,
        top: `${frame.y * 100}%`,
        width: `${frame.width * 100}%`,
        height: `${frame.height * 100}%`,
        zIndex: frame.zIndex + 100,
      }}
    >
      {!locked && handles.map(({ handle, className }) => (
        <button
          key={handle}
          type="button"
          className={`pointer-events-auto absolute h-2.5 w-2.5 rounded-full border border-black/70 bg-white ${className}`}
          onPointerDown={(event) => onResizeStart(handle, event)}
        />
      ))}
    </div>
  );
};

