import React from 'react';
import { ServiceItem } from '../../types';

interface StageRunOrderPanelProps {
  schedule: ServiceItem[];
  activeItemId: string | null;
  onItemSelect: (itemId: string) => void;
  onClose: () => void;
}

const ITEM_TYPE_ICON: Record<string, string> = {
  SONG: '♪',
  HYMN: '♪',
  BIBLE: 'B',
  SCRIPTURE: 'B',
  ANNOUNCEMENT: '!',
  CUSTOM: '□',
  VIDEO: '▶',
  IMAGE: '▣',
  OFFERING: '$',
};

export const StageRunOrderPanel: React.FC<StageRunOrderPanelProps> = ({
  schedule,
  activeItemId,
  onItemSelect,
  onClose,
}) => (
  <div className="absolute right-0 top-0 bottom-0 z-50 w-72 bg-zinc-950/97 border-l border-zinc-800 flex flex-col shadow-2xl">
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Run Order</span>
      <button
        onClick={onClose}
        className="text-zinc-500 hover:text-white text-xl leading-none px-1"
        title="Close run order (R)"
        aria-label="Close run order panel"
      >
        ×
      </button>
    </div>
    <div className="flex-1 overflow-y-auto py-1">
      {schedule.length === 0 && (
        <div className="px-4 py-8 text-center text-zinc-600 text-sm">No items in service</div>
      )}
      {schedule.map((item, idx) => {
        const isActive = item.id === activeItemId;
        const icon = ITEM_TYPE_ICON[item.type] || '□';
        const slideCount = item.slides?.length ?? 0;
        return (
          <button
            key={item.id}
            onClick={() => onItemSelect(item.id)}
            className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-zinc-800/40 transition-colors ${
              isActive
                ? 'bg-green-950/50 border-l-2 border-l-green-500'
                : 'hover:bg-zinc-800/30 border-l-2 border-l-transparent'
            }`}
          >
            <span className={`text-sm mt-0.5 shrink-0 font-mono font-bold w-5 text-center ${isActive ? 'text-green-400' : 'text-zinc-600'}`}>
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-semibold leading-tight truncate ${isActive ? 'text-green-300' : 'text-zinc-200'}`}>
                {idx + 1}. {item.title}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600 mt-0.5">
                {item.type} · {slideCount} slide{slideCount === 1 ? '' : 's'}
              </div>
            </div>
            {isActive && (
              <span className="text-[9px] font-black uppercase tracking-widest text-green-400 bg-green-950 border border-green-700/50 rounded px-1.5 py-0.5 shrink-0">
                LIVE
              </span>
            )}
          </button>
        );
      })}
    </div>
    <div className="px-4 py-2 border-t border-zinc-800 shrink-0">
      <div className="text-[9px] text-zinc-700 text-center">Press R to toggle · click item to go live</div>
    </div>
  </div>
);
