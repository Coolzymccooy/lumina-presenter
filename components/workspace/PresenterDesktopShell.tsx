import React from 'react';

export type WorkspaceMode = 'builder' | 'presenter' | 'stage';
type ShellPaneId = 'left' | 'center' | 'right' | 'bottom';

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
  isCompactLayout?: boolean;
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

const COMPACT_TAB_LABELS: Record<WorkspaceMode, Record<ShellPaneId, string>> = {
  builder: {
    left: 'Run Sheet',
    center: 'Canvas',
    right: 'Rail',
    bottom: 'Dock',
  },
  presenter: {
    left: 'Schedule',
    center: 'Preview',
    right: 'Live',
    bottom: 'Library',
  },
  stage: {
    left: 'Config',
    center: 'Stage',
    right: 'Ops',
    bottom: 'Dock',
  },
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
  isCompactLayout = false,
  className = '',
}) => {
  const [activeCompactPane, setActiveCompactPane] = React.useState<ShellPaneId>('center');
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

  const compactPanes = React.useMemo(() => {
    const panes: Array<{ id: ShellPaneId; label: string; node: React.ReactNode }> = [
      { id: 'left', label: COMPACT_TAB_LABELS[mode].left, node: leftPane },
      { id: 'center', label: COMPACT_TAB_LABELS[mode].center, node: centerPane },
    ];

    if (!hideRightPane && rightPane) {
      panes.push({ id: 'right', label: COMPACT_TAB_LABELS[mode].right, node: rightPane });
    }

    if (bottomPane) {
      panes.push({ id: 'bottom', label: COMPACT_TAB_LABELS[mode].bottom, node: bottomPane });
    }

    return panes;
  }, [bottomPane, centerPane, hideRightPane, leftPane, mode, rightPane]);

  React.useEffect(() => {
    const hasActivePane = compactPanes.some((pane) => pane.id === activeCompactPane);
    if (!hasActivePane) {
      setActiveCompactPane('center');
    }
  }, [activeCompactPane, compactPanes]);

  React.useEffect(() => {
    if (!isCompactLayout) return;
    setActiveCompactPane('center');
  }, [isCompactLayout, mode]);

  if (isCompactLayout) {
    return (
      <div
        data-testid={`${shellTestId}-compact`}
        data-workspace-mode={mode}
        className={`flex flex-1 min-h-0 flex-col overflow-hidden bg-black ${className}`}
      >
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {compactPanes.map((pane) => (
            <div
              key={pane.id}
              id={`compact-shell-pane-${pane.id}`}
              role="tabpanel"
              aria-hidden={pane.id !== activeCompactPane}
              data-testid={`compact-shell-pane-${pane.id}`}
              className={pane.id === activeCompactPane ? 'h-full min-h-0 min-w-0 overflow-hidden' : 'hidden'}
            >
              {pane.node}
            </div>
          ))}
        </div>
        <div
          data-testid="compact-shell-tabbar"
          className="shrink-0 border-t border-zinc-800 bg-[linear-gradient(180deg,rgba(24,24,27,0.98)_0%,rgba(12,13,18,1)_100%)] px-2 py-2"
        >
          <div
            role="tablist"
            aria-label={`${mode} workspace panes`}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${compactPanes.length}, minmax(0, 1fr))` }}
          >
            {compactPanes.map((pane) => (
              <button
                key={pane.id}
                type="button"
                role="tab"
                aria-selected={pane.id === activeCompactPane}
                aria-controls={`compact-shell-pane-${pane.id}`}
                data-testid={`compact-shell-tab-${pane.id}`}
                onClick={() => setActiveCompactPane(pane.id)}
                className={`min-w-0 rounded-lg border px-2 py-2 text-[9px] font-black uppercase tracking-[0.16em] transition-colors ${
                  pane.id === activeCompactPane
                    ? 'border-cyan-500 bg-cyan-950/45 text-cyan-200'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white'
                }`}
              >
                <span className="block truncate">{pane.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={shellTestId}
      data-workspace-mode={mode}
      className={`flex-1 min-h-0 overflow-hidden bg-black ${className}`}
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
