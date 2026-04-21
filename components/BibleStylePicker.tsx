import React from 'react';
import {
  BIBLE_STYLE_FAMILIES,
  type BibleStyleFamily,
  type BibleStyleMode,
} from '../services/bibleStyleEngine.ts';

interface BibleStylePickerProps {
  mode: BibleStyleMode;
  family: BibleStyleFamily | null;
  onModeChange: (mode: BibleStyleMode) => void;
  onFamilyChange: (family: BibleStyleFamily | null) => void;
  onRandomize: () => void;
  compact?: boolean;
  hasPptxItems?: boolean;
}

// Dice icon inline so we avoid an extra import
const DiceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="16" height="16" rx="3" strokeWidth="1.5" stroke="currentColor" fill="none" />
    <circle cx="6.5" cy="6.5" r="1.2" />
    <circle cx="13.5" cy="13.5" r="1.2" />
    <circle cx="13.5" cy="6.5" r="1.2" />
    <circle cx="6.5" cy="13.5" r="1.2" />
    <circle cx="10" cy="10" r="1.2" />
  </svg>
);

export const BibleStylePicker: React.FC<BibleStylePickerProps> = ({
  mode,
  family,
  onModeChange,
  onFamilyChange,
  onRandomize,
  compact = false,
  hasPptxItems = false,
}) => {
  const textSz = compact ? 'text-[8px]' : 'text-[9px]';
  const labelSz = compact ? 'text-[7px]' : 'text-[8px]';
  const chipPy = compact ? 'py-0.5' : 'py-1';

  return (
    <div data-testid="bible-style-picker" className="space-y-1.5">
      {/* Mode row */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`${labelSz} text-zinc-400 uppercase tracking-widest font-black w-10 shrink-0`}>Style</span>
        {(['classic', 'smart-random', 'preset'] as BibleStyleMode[]).map((m) => (
          <button
            key={m}
            data-testid={`bible-style-mode-${m}`}
            onClick={() => onModeChange(m)}
            className={`px-2 ${chipPy} rounded-md ${textSz} font-black uppercase tracking-wide transition-all active:scale-95 ${
              mode === m
                ? 'bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-amber-900/60 ring-1 ring-amber-200/40'
                : 'bg-zinc-800/80 text-zinc-400 border border-zinc-800 hover:text-white hover:border-amber-700/50 hover:bg-zinc-800'
            }`}
          >
            {m === 'classic' ? 'Classic' : m === 'smart-random' ? 'Smart' : 'Preset'}
          </button>
        ))}
        {/* Randomize button — visible in smart-random and preset modes */}
        {mode !== 'classic' && (
          <button
            data-testid="bible-style-shuffle-btn"
            onClick={onRandomize}
            title="Randomize style"
            className={`ml-auto flex items-center gap-1 px-2 ${chipPy} rounded-md ${textSz} font-black uppercase tracking-wide transition-all bg-gradient-to-br from-zinc-800 to-zinc-900 text-amber-300 border border-amber-900/50 hover:text-white hover:border-amber-500/60 hover:from-amber-900/40 hover:to-amber-950/60 active:scale-95 shadow-sm shadow-amber-950/40`}
          >
            <DiceIcon className="w-3 h-3" />
            Shuffle
          </button>
        )}
      </div>

      {/* Family chips — visible when not in classic mode */}
      {mode !== 'classic' && (
        <>
        <div className="flex items-center gap-1 flex-wrap">
          <span className={`${labelSz} text-zinc-400 uppercase tracking-widest font-black w-10 shrink-0`}>Family</span>
          {/* Auto option */}
          <button
            data-testid="bible-style-family-auto"
            onClick={() => onFamilyChange(null)}
            className={`px-2 ${chipPy} rounded-md ${textSz} font-black uppercase tracking-wide transition-all active:scale-95 ${
              family === null
                ? 'bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-lg shadow-violet-900/60 ring-1 ring-violet-200/40'
                : 'bg-zinc-800/80 text-zinc-400 border border-zinc-800 hover:text-white hover:border-violet-700/50 hover:bg-zinc-800'
            }`}
          >
            Auto
          </button>
          {BIBLE_STYLE_FAMILIES.map((f) => {
            const isSplitWithPptx = f.id === 'split-panel' && hasPptxItems;
            const isActive = family === f.id;
            return (
              <button
                key={f.id}
                data-testid={`bible-style-family-${f.id}`}
                onClick={() => onFamilyChange(f.id)}
                title={isSplitWithPptx ? 'Split style may cause display instability when PowerPoint slides are in your schedule' : f.description}
                className={`relative flex items-center gap-1 px-2 ${chipPy} rounded-md ${textSz} font-black uppercase tracking-wide transition-all active:scale-95 ${
                  isActive
                    ? 'text-white shadow-lg ring-1'
                    : 'bg-zinc-800/80 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-600 hover:bg-zinc-800'
                }`}
                style={
                  isActive
                    ? {
                        backgroundImage: `linear-gradient(135deg, ${f.previewColors[0]}, ${f.previewColors[1]})`,
                        boxShadow: `0 8px 20px -4px ${f.previewColors[1]}66`,
                        // @ts-expect-error — Tailwind ring uses this CSS var
                        '--tw-ring-color': `${f.previewColors[0]}66`,
                      }
                    : {}
                }
              >
                {/* Colour swatch */}
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0 ring-1 ring-white/20"
                  style={{ background: `linear-gradient(135deg, ${f.previewColors[0]}, ${f.previewColors[1]})` }}
                />
                {f.label}
                {isSplitWithPptx && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-zinc-900 flex items-center justify-center text-[5px] font-black text-zinc-900 leading-none">!</span>
                )}
              </button>
            );
          })}
        </div>
        {/* Inline advisory when Split is selected alongside PPTX slides */}
        {hasPptxItems && family === 'split-panel' && (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-amber-950/40 border border-amber-800/50 mt-0.5">
            <span className="text-amber-400 font-black shrink-0" style={{ fontSize: '9px' }}>!</span>
            <p className={`${labelSz} text-amber-300 leading-snug`}>
              Split style may cause display instability with PowerPoint slides in your schedule. Switch to Classic or remove the PPTX item to avoid this.
            </p>
          </div>
        )}
        </>
      )}
    </div>
  );
};
