import React from 'react';

interface EditorToolbarProps {
  canActOnElement: boolean;
  activeTool: 'select' | 'add-text';
  onSetTool: (tool: 'select' | 'add-text') => void;
  onAddText: () => void;
  onDuplicateElement: () => void;
  onDeleteElement: () => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onAlign: (mode: 'left' | 'center' | 'right') => void;
  showGrid: boolean;
  showSafeArea: boolean;
  onToggleGrid: () => void;
  onToggleSafeArea: () => void;
}

const Button = ({ disabled = false, onClick, children, active = false }: { disabled?: boolean; onClick?: () => void; children: React.ReactNode; active?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex h-8 items-center gap-2 rounded border px-2.5 text-[10px] font-bold tracking-wide transition-colors ${active ? 'border-cyan-600 bg-cyan-950/40 text-cyan-200' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600'} disabled:opacity-35`}
  >
    {children}
  </button>
);

const ToolGlyph = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-black/20 text-[10px] leading-none">{children}</span>
);

const ToolGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
    <div className="min-w-[4rem] text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">{title}</div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

export const EditorToolbar: React.FC<EditorToolbarProps> = (props) => {
  const { canActOnElement, activeTool } = props;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-2">
      <ToolGroup title="Mode">
        <Button active={activeTool === 'select'} onClick={() => props.onSetTool('select')}><ToolGlyph>S</ToolGlyph>SELECT</Button>
        <Button active={activeTool === 'add-text'} onClick={() => props.onSetTool('add-text')}><ToolGlyph>T</ToolGlyph>ADD TEXT</Button>
        <Button onClick={props.onAddText}><ToolGlyph>T</ToolGlyph>NEW BLOCK</Button>
      </ToolGroup>
      <ToolGroup title="Block">
        <Button disabled={!canActOnElement} onClick={props.onDuplicateElement}><ToolGlyph>D</ToolGlyph>DUPLICATE</Button>
        <Button disabled={!canActOnElement} onClick={props.onDeleteElement}><ToolGlyph>X</ToolGlyph>DELETE</Button>
        <Button disabled={!canActOnElement} onClick={props.onToggleLock}><ToolGlyph>L</ToolGlyph>LOCK</Button>
        <Button disabled={!canActOnElement} onClick={props.onToggleVisibility}><ToolGlyph>V</ToolGlyph>VISIBLE</Button>
      </ToolGroup>
      <ToolGroup title="Arrange">
        <Button disabled={!canActOnElement} onClick={props.onBringForward}><ToolGlyph>F</ToolGlyph>FORWARD</Button>
        <Button disabled={!canActOnElement} onClick={props.onSendBackward}><ToolGlyph>B</ToolGlyph>BACK</Button>
        <Button disabled={!canActOnElement} onClick={() => props.onAlign('left')}><ToolGlyph>L</ToolGlyph>ALIGN L</Button>
        <Button disabled={!canActOnElement} onClick={() => props.onAlign('center')}><ToolGlyph>C</ToolGlyph>ALIGN C</Button>
        <Button disabled={!canActOnElement} onClick={() => props.onAlign('right')}><ToolGlyph>R</ToolGlyph>ALIGN R</Button>
      </ToolGroup>
      <ToolGroup title="View">
        <Button active={props.showGrid} onClick={props.onToggleGrid}><ToolGlyph>G</ToolGlyph>GRID</Button>
        <Button active={props.showSafeArea} onClick={props.onToggleSafeArea}><ToolGlyph>A</ToolGlyph>SAFE AREA</Button>
      </ToolGroup>
    </div>
  );
};

