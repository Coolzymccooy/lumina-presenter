import React from 'react';

export type FindReplaceMode = 'find' | 'replace';

interface FindReplaceModalProps {
  mode: FindReplaceMode;
  query: string;
  replacement: string;
  matchCase: boolean;
  matchCount: number;
  currentIndex: number;
  onQueryChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onMatchCaseChange: (value: boolean) => void;
  onNavigate: (direction: -1 | 1) => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
  onSwitchMode: (mode: FindReplaceMode) => void;
  onClose: () => void;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  mode,
  query,
  replacement,
  matchCase,
  matchCount,
  currentIndex,
  onQueryChange,
  onReplacementChange,
  onMatchCaseChange,
  onNavigate,
  onReplaceCurrent,
  onReplaceAll,
  onSwitchMode,
  onClose,
}) => {
  const findInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [mode]);

  const hasMatches = matchCount > 0;
  const displayIndex = hasMatches ? currentIndex + 1 : 0;

  const handleFindKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onNavigate(event.shiftKey ? -1 : 1);
    }
  };

  const handleReplaceKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) onReplaceAll();
      else onReplaceCurrent();
    }
  };

  return (
    <div
      className="absolute left-1/2 top-3 z-30 w-[min(30rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-950/95 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur"
      role="dialog"
      aria-label={mode === 'replace' ? 'Find and replace text' : 'Find text'}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 p-0.5 text-[10px] font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => onSwitchMode('find')}
            className={`h-6 rounded px-2 transition-colors ${mode === 'find' ? 'bg-blue-600/40 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            title="Find only"
          >
            Find
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('replace')}
            className={`h-6 rounded px-2 transition-colors ${mode === 'replace' ? 'bg-blue-600/40 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            title="Find and replace"
          >
            Replace
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-800 bg-zinc-900 text-[11px] font-black text-zinc-400 hover:border-zinc-600 hover:text-white active:scale-[0.94] transition-all"
          title="Close (Esc)"
          aria-label="Close find and replace"
        >
          X
        </button>
      </div>

      <div className="px-3 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <label className="w-16 shrink-0 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">Find</label>
          <input
            ref={findInputRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleFindKeyDown}
            placeholder="Search text…"
            className="h-7 min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
            aria-label="Find text"
          />
          <div
            className={`inline-flex h-7 w-16 shrink-0 items-center justify-center rounded border px-2 text-[10px] font-bold uppercase tracking-wider tabular-nums ${hasMatches ? 'border-zinc-700 bg-zinc-900 text-zinc-200' : 'border-zinc-900 bg-zinc-950 text-zinc-600'}`}
            title="Current match / total matches"
          >
            {query.trim() ? `${displayIndex}/${matchCount}` : '–'}
          </div>
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            disabled={!hasMatches}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-[11px] font-black text-zinc-300 hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.94] transition-all"
            title="Previous match (Shift+Enter)"
            aria-label="Previous match"
          >
            {'<'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            disabled={!hasMatches}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-[11px] font-black text-zinc-300 hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.94] transition-all"
            title="Next match (Enter)"
            aria-label="Next match"
          >
            {'>'}
          </button>
        </div>

        {mode === 'replace' ? (
          <div className="flex items-center gap-2">
            <label className="w-16 shrink-0 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">Replace</label>
            <input
              type="text"
              value={replacement}
              onChange={(event) => onReplacementChange(event.target.value)}
              onKeyDown={handleReplaceKeyDown}
              placeholder="Replacement text…"
              className="h-7 min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
              aria-label="Replacement text"
            />
            <button
              type="button"
              onClick={onReplaceCurrent}
              disabled={!hasMatches || !query.trim()}
              className="inline-flex h-7 shrink-0 items-center rounded border border-blue-700/60 bg-blue-950/40 px-2 text-[10px] font-bold uppercase tracking-wider text-blue-200 hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.94] transition-all"
              title="Replace current match (Enter)"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onReplaceAll}
              disabled={!hasMatches || !query.trim()}
              className="inline-flex h-7 shrink-0 items-center rounded border border-blue-500 bg-blue-600/40 px-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-blue-600/60 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.94] transition-all"
              title="Replace every match (Shift+Enter)"
            >
              All
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-3 pt-0.5">
          <button
            type="button"
            onClick={() => onMatchCaseChange(!matchCase)}
            className={`inline-flex h-6 items-center gap-1.5 rounded border px-2 text-[10px] font-bold uppercase tracking-wider transition-colors active:scale-[0.94] duration-100 ${matchCase ? 'border-cyan-600 bg-cyan-950/40 text-cyan-200' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'}`}
            title="Match case"
            aria-pressed={matchCase}
          >
            <span aria-hidden>Aa</span>
            <span>Case</span>
          </button>
          <div className="ml-auto text-[9px] uppercase tracking-[0.18em] text-zinc-600">
            Enter next · Shift+Enter prev · Esc close
          </div>
        </div>
      </div>
    </div>
  );
};
