import React, { useEffect, useState } from 'react';
import { TextSlideElement } from '../../../types.ts';
import {
  RibbonButton,
  RibbonGlyph,
  RibbonGroup,
  RibbonRow,
} from './ribbon/RibbonPrimitives';
import { RibbonFormat } from './ribbon/RibbonFormat';

type EditorTab = 'home' | 'insert' | 'format' | 'arrange' | 'view';

interface EditorToolbarProps {
  canActOnSlide: boolean;
  canDeleteSlide: boolean;
  canPasteSlide: boolean;
  canActOnElement: boolean;
  canUndo: boolean;
  canRedo: boolean;
  activeTool: 'select' | 'add-text';
  onSetTool: (tool: 'select' | 'add-text') => void;
  onUndo: () => void;
  onRedo: () => void;
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
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomChange: (value: number) => void;
  onOpenFind: () => void;
  onOpenReplace: () => void;
  onToggleNotes: () => void;
  onTogglePaintFormat: () => void;
  paintFormatArmed: boolean;
  onInsertShape: () => void;
  onInsertImage: () => void;
  onInsertVideo: () => void;
  onInsertLogo: () => void;
  selectedTextElement: TextSlideElement | null;
  onUpdateTextElement: (elementId: string, updater: (element: TextSlideElement) => TextSlideElement) => void;
}

interface TabDef {
  id: EditorTab;
  label: string;
  tone?: 'neutral' | 'accent';
}

const BASE_TABS: TabDef[] = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'arrange', label: 'Arrange' },
  { id: 'view', label: 'View' },
];

const TabButton: React.FC<{
  label: string;
  active: boolean;
  tone?: 'neutral' | 'accent';
  onClick: () => void;
}> = ({ label, active, tone = 'neutral', onClick }) => {
  const isAccent = tone === 'accent';
  const activeClasses = isAccent
    ? 'border-amber-500/70 bg-amber-950/40 text-amber-100 shadow-inner'
    : 'border-blue-500/70 bg-blue-950/40 text-blue-100 shadow-inner';
  const idleClasses = isAccent
    ? 'border-transparent bg-transparent text-amber-300/80 hover:text-amber-100 hover:bg-amber-950/20'
    : 'border-transparent bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-6 items-center rounded-t border-b-2 px-2.5 text-[9px] font-bold uppercase tracking-[0.16em] active:scale-[0.96] transition-all duration-100 ${active ? activeClasses : idleClasses}`}
    >
      {label}
    </button>
  );
};

export const EditorToolbar: React.FC<EditorToolbarProps> = (props) => {
  const { canActOnElement, activeTool, selectedTextElement } = props;
  const [activeTab, setActiveTab] = useState<EditorTab>('home');
  const hasText = !!selectedTextElement;

  useEffect(() => {
    if (selectedTextElement) {
      setActiveTab('format');
    }
  }, [selectedTextElement?.id]);

  useEffect(() => {
    if (!selectedTextElement && activeTab === 'format') {
      setActiveTab('home');
    }
  }, [selectedTextElement, activeTab]);

  const renderHome = () => (
    <RibbonRow dense>
      <RibbonGroup title="History">
        <RibbonButton
          disabled={!props.canUndo}
          onClick={props.onUndo}
          title="Undo the last change"
          shortcut="Ctrl+Z"
          icon={<RibbonGlyph>⟲</RibbonGlyph>}
        >
          Undo
        </RibbonButton>
        <RibbonButton
          disabled={!props.canRedo}
          onClick={props.onRedo}
          title="Redo the last undone change"
          shortcut="Ctrl+Y"
          icon={<RibbonGlyph>⟳</RibbonGlyph>}
        >
          Redo
        </RibbonButton>
      </RibbonGroup>

      <RibbonGroup title="Slide">
        <RibbonButton
          disabled={!props.canActOnSlide}
          onClick={props.onCopySlide}
          title="Copy the current slide to the clipboard"
          shortcut="Ctrl+C"
          icon={<RibbonGlyph>C</RibbonGlyph>}
        >
          Copy
        </RibbonButton>
        <RibbonButton
          disabled={!props.canPasteSlide}
          onClick={props.onPasteSlide}
          title="Paste a slide from the clipboard after the current slide"
          shortcut="Ctrl+V"
          icon={<RibbonGlyph>P</RibbonGlyph>}
        >
          Paste
        </RibbonButton>
        <RibbonButton
          disabled={!props.canActOnSlide}
          onClick={props.onDuplicateSlide}
          title="Duplicate the current slide"
          shortcut="Ctrl+D"
          icon={<RibbonGlyph>D</RibbonGlyph>}
        >
          Dup
        </RibbonButton>
        <RibbonButton
          disabled={!props.canDeleteSlide}
          onClick={props.onDeleteSlide}
          title="Delete the current slide"
          shortcut="Delete"
          tone="danger"
          icon={<RibbonGlyph>X</RibbonGlyph>}
        >
          Delete
        </RibbonButton>
      </RibbonGroup>

      <RibbonGroup title="Tool">
        <RibbonButton
          active={activeTool === 'select'}
          onClick={() => props.onSetTool('select')}
          title="Select and move elements on the slide"
          shortcut="V"
          icon={<RibbonGlyph>S</RibbonGlyph>}
        >
          Select
        </RibbonButton>
        <RibbonButton
          active={activeTool === 'add-text'}
          onClick={() => props.onSetTool('add-text')}
          title="Click on the canvas to drop a new text block"
          shortcut="T"
          icon={<RibbonGlyph>T</RibbonGlyph>}
        >
          Add Text
        </RibbonButton>
        <RibbonButton
          onClick={props.onAddText}
          title="Insert a new text block at the default position"
          shortcut="Ctrl+T"
          icon={<RibbonGlyph tone="primary">+</RibbonGlyph>}
        >
          New Block
        </RibbonButton>
      </RibbonGroup>

      <RibbonGroup title="Insert">
        <RibbonButton
          onClick={props.onInsertShape}
          title="Insert a colored rectangle shape onto the slide"
          icon={<RibbonGlyph tone="accent">◼</RibbonGlyph>}
        >
          Shape
        </RibbonButton>
        <RibbonButton
          onClick={props.onInsertImage}
          title="Pick an image file to place on this slide's background"
          icon={<RibbonGlyph tone="primary">I</RibbonGlyph>}
        >
          Image
        </RibbonButton>
        <RibbonButton
          onClick={props.onInsertVideo}
          title="Pick a video file to place on this slide's background"
          icon={<RibbonGlyph tone="primary">V</RibbonGlyph>}
        >
          Video
        </RibbonButton>
        <RibbonButton
          onClick={props.onInsertLogo}
          title="Drop a logo on this slide — sits above the background in a corner"
          icon={<RibbonGlyph tone="accent">L</RibbonGlyph>}
        >
          Logo
        </RibbonButton>
      </RibbonGroup>

      <RibbonGroup title="Align">
        <RibbonButton
          disabled={!canActOnElement}
          onClick={() => props.onAlign('left')}
          title="Align the selected block to the left safe area"
          icon={<RibbonGlyph>L</RibbonGlyph>}
          size="sm"
          aria-label="Align left"
        />
        <RibbonButton
          disabled={!canActOnElement}
          onClick={() => props.onAlign('center')}
          title="Center the selected block horizontally"
          icon={<RibbonGlyph>C</RibbonGlyph>}
          size="sm"
          aria-label="Align center"
        />
        <RibbonButton
          disabled={!canActOnElement}
          onClick={() => props.onAlign('right')}
          title="Align the selected block to the right safe area"
          icon={<RibbonGlyph>R</RibbonGlyph>}
          size="sm"
          aria-label="Align right"
        />
      </RibbonGroup>

      <RibbonGroup title="Find">
        <RibbonButton
          onClick={props.onOpenFind}
          title="Find text across every slide in this item"
          shortcut="Ctrl+F"
          icon={<RibbonGlyph>?</RibbonGlyph>}
        >
          Find
        </RibbonButton>
        <RibbonButton
          onClick={props.onOpenReplace}
          title="Find and replace text across every slide in this item"
          shortcut="Ctrl+H"
          icon={<RibbonGlyph>R</RibbonGlyph>}
        >
          Replace
        </RibbonButton>
      </RibbonGroup>
    </RibbonRow>
  );

  const renderInsert = () => (
    <RibbonRow dense>
      <RibbonGroup title="Insert">
        <RibbonButton
          onClick={props.onInsertShape}
          title="Insert a colored rectangle shape onto the slide"
          icon={<RibbonGlyph tone="accent">◼</RibbonGlyph>}
        >
          Shape
        </RibbonButton>
        <RibbonButton
          onClick={props.onInsertImage}
          title="Pick an image file to place on this slide's background"
          icon={<RibbonGlyph tone="primary">I</RibbonGlyph>}
        >
          Image
        </RibbonButton>
        <RibbonButton
          onClick={props.onInsertVideo}
          title="Pick a video file to place on this slide's background"
          icon={<RibbonGlyph tone="primary">V</RibbonGlyph>}
        >
          Video
        </RibbonButton>
        <RibbonButton
          onClick={props.onInsertLogo}
          title="Drop a logo on this slide — sits above the background in a corner"
          icon={<RibbonGlyph tone="accent">L</RibbonGlyph>}
        >
          Logo
        </RibbonButton>
      </RibbonGroup>

      <RibbonGroup title="Text">
        <RibbonButton
          onClick={props.onAddText}
          title="Insert a new text block at the default position"
          shortcut="Ctrl+T"
          icon={<RibbonGlyph tone="primary">+</RibbonGlyph>}
        >
          New Block
        </RibbonButton>
        <RibbonButton
          active={activeTool === 'add-text'}
          onClick={() => props.onSetTool('add-text')}
          title="Click on the canvas to drop a new text block"
          shortcut="T"
          icon={<RibbonGlyph>T</RibbonGlyph>}
        >
          Drop Mode
        </RibbonButton>
      </RibbonGroup>
    </RibbonRow>
  );

  const renderFormat = () => (
    <RibbonRow dense>
      <RibbonGroup title="Text Box">
        <RibbonButton
          disabled={!canActOnElement}
          onClick={props.onDuplicateElement}
          title="Duplicate the selected text block"
          shortcut="Ctrl+D"
          icon={<RibbonGlyph>D</RibbonGlyph>}
          size="sm"
          aria-label="Duplicate text block"
        />
        <RibbonButton
          active={props.paintFormatArmed}
          disabled={!canActOnElement && !props.paintFormatArmed}
          onClick={props.onTogglePaintFormat}
          title="Copy the selected block's formatting, then pick another text block to paste it (Esc cancels)"
          shortcut="Ctrl+Shift+P"
          icon={<RibbonGlyph tone="primary">¶</RibbonGlyph>}
          size="sm"
          aria-label={props.paintFormatArmed ? 'Format painter armed' : 'Format painter'}
        />
        <RibbonButton
          disabled={!canActOnElement}
          onClick={props.onDeleteElement}
          title="Remove the selected text block"
          shortcut="Delete"
          tone="danger"
          icon={<RibbonGlyph>X</RibbonGlyph>}
          size="sm"
          aria-label="Delete text block"
        />
        <RibbonButton
          disabled={!canActOnElement}
          onClick={props.onToggleLock}
          title="Lock or unlock the selected text block so it cannot be edited accidentally"
          icon={<RibbonGlyph>L</RibbonGlyph>}
          size="sm"
          aria-label="Toggle lock"
        />
        <RibbonButton
          disabled={!canActOnElement}
          onClick={props.onToggleVisibility}
          title="Show or hide the selected text block on the live slide"
          icon={<RibbonGlyph>V</RibbonGlyph>}
          size="sm"
          aria-label="Toggle visibility"
        />
      </RibbonGroup>
      <RibbonFormat
        selectedElement={selectedTextElement}
        onUpdateElement={props.onUpdateTextElement}
        groupsOnly
      />
    </RibbonRow>
  );

  const renderArrange = () => (
    <RibbonRow dense>
      <RibbonGroup title="Order">
        <RibbonButton
          disabled={!canActOnElement}
          onClick={props.onBringForward}
          title="Bring the selected block one layer forward"
          icon={<RibbonGlyph>F</RibbonGlyph>}
        >
          Forward
        </RibbonButton>
        <RibbonButton
          disabled={!canActOnElement}
          onClick={props.onSendBackward}
          title="Send the selected block one layer backward"
          icon={<RibbonGlyph>B</RibbonGlyph>}
        >
          Back
        </RibbonButton>
      </RibbonGroup>
      <RibbonGroup title="Align">
        <RibbonButton
          disabled={!canActOnElement}
          onClick={() => props.onAlign('left')}
          title="Align the selected block to the left safe area"
          icon={<RibbonGlyph>L</RibbonGlyph>}
        >
          Align L
        </RibbonButton>
        <RibbonButton
          disabled={!canActOnElement}
          onClick={() => props.onAlign('center')}
          title="Center the selected block horizontally"
          icon={<RibbonGlyph>C</RibbonGlyph>}
        >
          Align C
        </RibbonButton>
        <RibbonButton
          disabled={!canActOnElement}
          onClick={() => props.onAlign('right')}
          title="Align the selected block to the right safe area"
          icon={<RibbonGlyph>R</RibbonGlyph>}
        >
          Align R
        </RibbonButton>
      </RibbonGroup>
    </RibbonRow>
  );

  const renderView = () => (
    <RibbonRow dense>
      <RibbonGroup title="Guides">
        <RibbonButton
          active={props.showGrid}
          onClick={props.onToggleGrid}
          title="Toggle the alignment grid overlay on the canvas"
          icon={<RibbonGlyph>G</RibbonGlyph>}
        >
          Grid
        </RibbonButton>
        <RibbonButton
          active={props.showSafeArea}
          onClick={props.onToggleSafeArea}
          title="Toggle the title-safe area outline so text stays visible on any screen"
          icon={<RibbonGlyph>A</RibbonGlyph>}
        >
          Safe Area
        </RibbonButton>
      </RibbonGroup>
      <RibbonGroup title="Find">
        <RibbonButton
          onClick={props.onOpenFind}
          title="Find text across every slide in this item"
          shortcut="Ctrl+F"
          icon={<RibbonGlyph>?</RibbonGlyph>}
        >
          Find
        </RibbonButton>
        <RibbonButton
          onClick={props.onOpenReplace}
          title="Find and replace text across every slide in this item"
          shortcut="Ctrl+H"
          icon={<RibbonGlyph>R</RibbonGlyph>}
        >
          Replace
        </RibbonButton>
        <RibbonButton
          onClick={props.onToggleNotes}
          title="Toggle speaker notes for this slide"
          shortcut="Ctrl+Shift+N"
          icon={<RibbonGlyph tone="primary">N</RibbonGlyph>}
        >
          Notes
        </RibbonButton>
      </RibbonGroup>
      <RibbonGroup title="Zoom">
        <RibbonButton
          onClick={props.onZoomOut}
          disabled={props.zoom <= 0.25}
          title="Zoom out"
          shortcut="Ctrl+-"
          icon={<RibbonGlyph>-</RibbonGlyph>}
        >
          Out
        </RibbonButton>
        <input
          type="range"
          min={25}
          max={400}
          step={5}
          value={Math.round(props.zoom * 100)}
          onChange={(event) => props.onZoomChange(Number(event.target.value) / 100)}
          title="Zoom the slide canvas"
          aria-label="Zoom the slide canvas"
          className="h-7 w-24 cursor-pointer accent-blue-500"
        />
        <RibbonButton
          onClick={props.onZoomIn}
          disabled={props.zoom >= 4}
          title="Zoom in"
          shortcut="Ctrl+="
          icon={<RibbonGlyph>+</RibbonGlyph>}
        >
          In
        </RibbonButton>
        <RibbonButton
          onClick={props.onZoomReset}
          active={Math.abs(props.zoom - 1) < 0.001}
          title="Reset zoom to 100%"
          shortcut="Ctrl+0"
          icon={<RibbonGlyph tone="primary">%</RibbonGlyph>}
        >
          {`${Math.round(props.zoom * 100)}%`}
        </RibbonButton>
      </RibbonGroup>
    </RibbonRow>
  );

  return (
    <div data-ribbon-root className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
      <div className="flex items-center gap-0.5 border-b border-zinc-800/80">
        <TabButton label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <TabButton label="Insert" active={activeTab === 'insert'} onClick={() => setActiveTab('insert')} />
        {hasText ? (
          <TabButton
            label="Format"
            tone="accent"
            active={activeTab === 'format'}
            onClick={() => setActiveTab('format')}
          />
        ) : null}
        <TabButton label="Arrange" active={activeTab === 'arrange'} onClick={() => setActiveTab('arrange')} />
        <TabButton label="View" active={activeTab === 'view'} onClick={() => setActiveTab('view')} />
      </div>
      <div className="min-w-0">
        {activeTab === 'home' ? renderHome() : null}
        {activeTab === 'insert' ? renderInsert() : null}
        {activeTab === 'format' ? renderFormat() : null}
        {activeTab === 'arrange' ? renderArrange() : null}
        {activeTab === 'view' ? renderView() : null}
      </div>
    </div>
  );
};
