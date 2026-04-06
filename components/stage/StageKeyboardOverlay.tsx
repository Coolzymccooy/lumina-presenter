import React from 'react';

interface StageKeyboardOverlayProps {
  onClose: () => void;
}

const SHORTCUTS: { key: string; description: string; category: string }[] = [
  { key: 'Space', description: 'Next slide', category: 'Navigation' },
  { key: '→', description: 'Next slide', category: 'Navigation' },
  { key: '←', description: 'Previous slide', category: 'Navigation' },
  { key: 'B', description: 'Toggle blackout', category: 'Display' },
  { key: 'R', description: 'Toggle run order panel', category: 'Panels' },
  { key: 'A', description: 'Toggle auto-advance', category: 'Panels' },
  { key: 'T', description: 'Toggle sermon recording', category: 'Panels' },
  { key: '?', description: 'Toggle this overlay', category: 'Panels' },
  { key: 'Esc', description: 'Close all panels', category: 'Panels' },
];

const categories = ['Navigation', 'Display', 'Panels'];

export const StageKeyboardOverlay: React.FC<StageKeyboardOverlayProps> = ({ onClose }) => (
  <div
    className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
  >
    <div
      className="bg-zinc-950 border border-zinc-700 rounded-2xl shadow-2xl p-6 w-88 max-w-[90vw]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Keyboard Shortcuts</span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white text-xl leading-none"
          aria-label="Close keyboard shortcuts"
        >
          ×
        </button>
      </div>
      {categories.map((cat) => (
        <div key={cat} className="mb-4">
          <div className="text-[9px] uppercase tracking-[0.25em] font-black text-zinc-600 mb-2">{cat}</div>
          <div className="space-y-1.5">
            {SHORTCUTS.filter((s) => s.category === cat).map(({ key, description }) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-[11px] font-mono text-zinc-200 min-w-[52px] text-center shrink-0">
                  {key}
                </kbd>
                <span className="text-sm text-zinc-300">{description}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-4 pt-3 border-t border-zinc-800 text-[10px] text-zinc-600 text-center">
        Click anywhere or press ? to dismiss
      </div>
    </div>
  </div>
);
