import React from 'react';

export type WorkspaceMode = 'builder' | 'presenter' | 'stage';

interface PresenterDesktopShellProps {
  mode: WorkspaceMode;
  leftPane: React.ReactNode;
  centerPane: React.ReactNode;
  rightPane?: React.ReactNode;
  bottomPane?: React.ReactNode;
  leftWidth?: number;
  rightWidth?: number;
  bottomHeight?: number;
  onResizeLeft?: (delta: number) => void;
  onResizeRight?: (delta: number) => void;
  onResizeBottom?: (delta: number) => void;
  hideRightPane?: boolean;
  className?: string;
}

interface ResizeHandleProps {
  orientation: 'vertical' | 'horizontal';
  onResize: (delta: number) => void;
  className?: string;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ orientation, onResize, className }) => {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    let lastX = event.clientX;
    let lastY = event.clientY;
    const ownerDocument = event.currentTarget.ownerDocument;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = orientation === 'vertical'
        ? moveEvent.clientX - lastX
        : lastY - moveEvent.clientY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
      onResize(delta);
    };

    const handlePointerUp = () => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove);
      ownerDocument.removeEventListener('pointerup', handlePointerUp);
    };

    ownerDocument.addEventListener('pointermove', handlePointerMove);
    ownerDocument.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className={className}
      role="separator"
      aria-orientation={orientation}
    />
  );
};

export const PresenterDesktopShell: React.FC<PresenterDesktopShellProps> = ({
  mode,
  leftPane,
  centerPane,
  rightPane,
  bottomPane,
  leftWidth = 320,
  rightWidth = 340,
  bottomHeight = 148,
  onResizeLeft,
  onResizeRight,
  onResizeBottom,
  hideRightPane = false,
  className = '',
}) => {
  const bottomSpansShell = false;
  const columns = hideRightPane
    ? `${leftWidth}px minmax(0, 1fr)`
    : `${leftWidth}px minmax(0, 1fr) ${rightWidth}px`;
  const areas = bottomSpansShell
    ? (hideRightPane ? '"left center" "bottom bottom"' : '"left center right" "bottom bottom bottom"')
    : (hideRightPane ? '"left center" "left bottom"' : '"left center right" "left bottom bottom"');

  const shellTestId = mode === 'presenter'
    ? 'presenter-beta-shell'
    : mode === 'builder'
      ? 'builder-desktop-shell'
      : 'stage-desktop-shell';

  return (
    <div
      data-testid={shellTestId}
      data-workspace-mode={mode}
      className={`flex-1 min-h-0 bg-black overflow-hidden ${className}`}
    >
      <div
        className="grid h-full min-h-0 w-full gap-0"
        style={{
          gridTemplateColumns: columns,
          gridTemplateRows: `minmax(0, 1fr) ${bottomHeight}px`,
          gridTemplateAreas: areas,
        }}
      >
        <div style={{ gridArea: 'left' }} className="min-h-0 min-w-0 overflow-hidden">
          {leftPane}
        </div>
        {onResizeLeft && (
          <ResizeHandle
            orientation="vertical"
            onResize={onResizeLeft}
            className="col-start-2 row-span-2 -ml-1 z-20 w-2 cursor-col-resize bg-transparent hover:bg-cyan-500/15 active:bg-cyan-500/25"
          />
        )}
        <div style={{ gridArea: 'center' }} className="min-h-0 min-w-0 overflow-hidden">
          {centerPane}
        </div>
        {!hideRightPane && rightPane && (
          <>
            {onResizeRight && (
              <ResizeHandle
                orientation="vertical"
                onResize={(delta) => onResizeRight(-delta)}
                className="col-start-3 row-start-1 -ml-1 z-20 w-2 cursor-col-resize bg-transparent hover:bg-cyan-500/15 active:bg-cyan-500/25"
              />
            )}
            <div style={{ gridArea: 'right' }} className="min-h-0 min-w-0 overflow-hidden">
              {rightPane}
            </div>
          </>
        )}
        {bottomPane && (
          <div style={{ gridArea: 'bottom' }} className="min-h-0 min-w-0 overflow-hidden border-t border-zinc-900">
            {bottomPane}
          </div>
        )}
        {bottomPane && onResizeBottom && (
          <ResizeHandle
            orientation="horizontal"
            onResize={onResizeBottom}
            className={`${bottomSpansShell ? (hideRightPane ? 'col-start-1 col-end-3' : 'col-start-1 col-end-4') : (hideRightPane ? 'col-start-2' : 'col-start-2 col-end-4')} row-start-2 -mt-1 z-20 h-2 cursor-row-resize bg-transparent hover:bg-cyan-500/15 active:bg-cyan-500/25`}
          />
        )}
      </div>
    </div>
  );
};
