import React, { useEffect } from 'react';

export interface ContextMenuAction {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, title, actions, onClose }) => {
  useEffect(() => {
    const handlePointer = () => onClose();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-[180] min-w-[200px] rounded-xl border border-zinc-800 bg-zinc-950/98 p-2 shadow-[0_18px_44px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {title && (
        <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          {title}
        </div>
      )}
      <div className="space-y-1">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => {
              if (action.disabled) return;
              action.onSelect();
              onClose();
            }}
            disabled={action.disabled}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[11px] font-bold transition-all ${
              action.danger
                ? 'border-rose-900/60 bg-rose-950/20 text-rose-200 hover:border-rose-700/80'
                : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/70'
            } ${action.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
