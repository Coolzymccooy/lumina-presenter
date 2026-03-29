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
}) => {
  const textSz = compact ? 'text-[7px]' : 'text-[8px]';
  const labelSz = compact ? 'text-[6.5px]' : 'text-[7px]';
  const chipPy = compact ? 'py-0.5' : 'py-1';

  return (
    <div className="space-y-1.5">
      {/* Mode row */}
      <div className="flex items-center gap-1.5">
        <span className={`${labelSz} text-zinc-600 uppercase tracking-widest font-bold w-10 shrink-0`}>Style</span>
        {(['classic', 'smart-random', 'preset'] as BibleStyleMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-2 ${chipPy} rounded ${textSz} font-bold uppercase tracking-wide transition-all ${
              mode === m
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                : 'bg-zinc-800/80 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600'
            }`}
          >
            {m === 'classic' ? 'Classic' : m === 'smart-random' ? 'Smart' : 'Preset'}
          </button>
        ))}
        {/* Randomize button — visible in smart-random and preset modes */}
        {mode !== 'classic' && (
          <button
            onClick={onRandomize}
            title="Randomize style"
            className={`ml-auto flex items-center gap-1 px-2 ${chipPy} rounded ${textSz} font-bold uppercase tracking-wide transition-all bg-zinc-800/80 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 active:scale-95`}
          >
            <DiceIcon className="w-3 h-3" />
            Shuffle
          </button>
        )}
      </div>

      {/* Family chips — visible when not in classic mode */}
      {mode !== 'classic' && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${labelSz} text-zinc-600 uppercase tracking-widest font-bold w-10 shrink-0`}>Family</span>
          {/* Auto option */}
          <button
            onClick={() => onFamilyChange(null)}
            className={`px-2 ${chipPy} rounded ${textSz} font-bold uppercase tracking-wide transition-all ${
              family === null
                ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                : 'bg-zinc-800/80 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600'
            }`}
          >
            Auto
          </button>
          {BIBLE_STYLE_FAMILIES.map((f) => (
            <button
              key={f.id}
              onClick={() => onFamilyChange(f.id)}
              title={f.description}
              className={`flex items-center gap-1 px-2 ${chipPy} rounded ${textSz} font-bold uppercase tracking-wide transition-all ${
                family === f.id
                  ? 'text-white shadow-md'
                  : 'bg-zinc-800/80 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600'
              }`}
              style={
                family === f.id
                  ? { backgroundColor: f.previewColors[0], borderColor: f.previewColors[1], borderWidth: 1, borderStyle: 'solid', color: f.previewColors[1] }
                  : {}
              }
            >
              {/* Colour swatch */}
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: `linear-gradient(135deg, ${f.previewColors[0]}, ${f.previewColors[1]})` }}
              />
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
