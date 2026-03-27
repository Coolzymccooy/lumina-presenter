import React from 'react';

interface EditorToolbarProps {
  canActOnSlide: boolean;
  canDeleteSlide: boolean;
  canPasteSlide: boolean;
  canActOnElement: boolean;
  activeTool: 'select' | 'add-text';
  onSetTool: (tool: 'select' | 'add-text') => void;
  onCopySlide: () => void;
  onPasteSlide: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
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
    className={`inline-flex h-7 items-center gap-2 rounded border px-2 text-[10px] font-bold tracking-wide transition-colors ${active ? 'border-cyan-600 bg-cyan-950/40 text-cyan-200' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600'} disabled:cursor-not-allowed disabled:opacity-35`}
  >
    {children}
  </button>
);

const ToolGlyph = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-black/20 text-[9px] leading-none">{children}</span>
);

const ToolGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
    <div className="min-w-[3.7rem] text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">{title}</div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

export const EditorToolbar: React.FC<EditorToolbarProps> = (props) => {
  const { canActOnElement, activeTool } = props;
  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
      <ToolGroup title="Mode">
        <Button active={activeTool === 'select'} onClick={() => props.onSetTool('select')}><ToolGlyph>S</ToolGlyph>SELECT</Button>
        <Button active={activeTool === 'add-text'} onClick={() => props.onSetTool('add-text')}><ToolGlyph>T</ToolGlyph>ADD TEXT</Button>
        <Button onClick={props.onAddText}><ToolGlyph>T</ToolGlyph>NEW BLOCK</Button>
      </ToolGroup>
      <ToolGroup title="Slide">
        <Button disabled={!props.canActOnSlide} onClick={props.onCopySlide}><ToolGlyph>C</ToolGlyph>COPY</Button>
        <Button disabled={!props.canPasteSlide} onClick={props.onPasteSlide}><ToolGlyph>P</ToolGlyph>PASTE</Button>
        <Button disabled={!props.canActOnSlide} onClick={props.onDuplicateSlide}><ToolGlyph>D</ToolGlyph>DUP</Button>
        <Button disabled={!props.canDeleteSlide} onClick={props.onDeleteSlide}><ToolGlyph>X</ToolGlyph>DELETE</Button>
      </ToolGroup>
      <ToolGroup title="Text Box">
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

