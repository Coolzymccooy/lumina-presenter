import React from 'react';
import type { ServiceItem, Slide } from '../../types';
import { EditIcon, PlusIcon } from '../Icons';

interface BuilderCanvasRibbonProps {
  item: ServiceItem | null;
  slide: Slide | null;
  selectedElementId: string | null;
  selectedElementName?: string | null;
  showGrid: boolean;
  showSafeArea: boolean;
  zoom: number;
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
  onRenameItem?: (itemId: string, title: string) => void;
  onAddTextBlock: () => void;
  onToggleGrid: () => void;
  onToggleSafeArea: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onOpenBackgroundDrawer: () => void;
}

const RibbonButton = ({
  children,
  active = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => (
  <button
    type="button"
    {...props}
    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[9px] font-black uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
      active
        ? 'border-cyan-500 bg-cyan-950/45 text-cyan-200'
        : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white'
    } ${className}`}
  >
    {children}
  </button>
);

interface InlineTitleEditorProps {
  item: ServiceItem | null;
  onRenameItem?: (itemId: string, title: string) => void;
}

const InlineTitleEditor: React.FC<InlineTitleEditorProps> = ({ item, onRenameItem }) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const fallback = 'Builder';
  const current = item?.title || fallback;
  const canEdit = Boolean(item && onRenameItem);

  React.useEffect(() => {
    if (!editing) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [editing]);

  const beginEdit = () => {
    if (!canEdit) return;
    setDraft(item?.title || '');
    setEditing(true);
  };

  const commit = () => {
    if (!item || !onRenameItem) {
      setEditing(false);
      return;
    }
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.title) {
      onRenameItem(item.id, trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-testid="builder-canvas-ribbon-title-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        className="mt-1 w-full rounded border border-cyan-400/70 bg-black/30 px-1.5 py-0.5 text-lg font-black text-white outline-none focus:border-cyan-300"
        aria-label="Edit item title"
      />
    );
  }

  return (
    <button
      type="button"
      data-testid="builder-canvas-ribbon-title"
      onClick={beginEdit}
      disabled={!canEdit}
      title={canEdit ? 'Click to rename' : undefined}
      className={`mt-1 inline-flex max-w-full items-center gap-1 truncate rounded px-1 text-lg font-black text-white transition-colors ${
        canEdit ? 'hover:bg-white/5' : 'cursor-default'
      }`}
    >
      <span className="truncate">{current}</span>
      {canEdit && <EditIcon className="h-3 w-3 shrink-0 text-zinc-500" />}
    </button>
  );
};

export const BuilderCanvasRibbon: React.FC<BuilderCanvasRibbonProps> = ({
  item,
  slide,
  selectedElementName,
  showGrid,
  showSafeArea,
  zoom,
  onRenameItem,
  onAddTextBlock,
  onToggleGrid,
  onToggleSafeArea,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onOpenBackgroundDrawer,
}) => (
  <div
    data-testid="builder-canvas-ribbon"
    className="relative shrink-0 border-b border-zinc-800 bg-[linear-gradient(180deg,rgba(31,32,38,0.98)_0%,rgba(17,18,24,0.98)_100%)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
  >
    <div className="grid min-h-[50px] grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(160px,240px)_minmax(0,1fr)_auto]">
      <div className="order-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">Canvas</span>
          <span className="rounded border border-cyan-800 bg-cyan-950/40 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-cyan-200">
            Edit
          </span>
        </div>
        <InlineTitleEditor item={item} onRenameItem={onRenameItem} />
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">
          <span>{slide?.label || 'No slide'}</span>
          {selectedElementName && <span className="truncate text-cyan-300">Layer: {selectedElementName}</span>}
        </div>
      </div>

      <div className="order-3 min-w-0 self-center xl:order-2" aria-hidden="true" />

      <div className="order-2 flex flex-wrap gap-1.5 xl:order-3 xl:max-w-[430px] xl:justify-end">
        <RibbonButton onClick={onAddTextBlock} disabled={!slide}>
          <PlusIcon className="h-3.5 w-3.5" />
          Text
        </RibbonButton>
        <RibbonButton data-testid="builder-open-background-drawer" onClick={onOpenBackgroundDrawer} disabled={!item}>
          BG
        </RibbonButton>
        <RibbonButton onClick={onToggleGrid} active={showGrid}>
          Grid
        </RibbonButton>
        <RibbonButton onClick={onToggleSafeArea} active={showSafeArea}>
          Safe
        </RibbonButton>
        <div className="flex h-8 items-center overflow-hidden rounded-lg border border-zinc-600 bg-[#111218]">
          <button type="button" onClick={onZoomOut} className="h-full px-2 text-xs font-black text-zinc-400 hover:bg-zinc-800 hover:text-white">-</button>
          <button type="button" onClick={onZoomReset} className="h-full border-x border-zinc-800 px-2 text-[9px] font-bold text-zinc-300">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={onZoomIn} className="h-full px-2 text-xs font-black text-zinc-400 hover:bg-zinc-800 hover:text-white">+</button>
        </div>
      </div>
    </div>
  </div>
);
