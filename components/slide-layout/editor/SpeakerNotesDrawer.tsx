import React from 'react';

interface SpeakerNotesDrawerProps {
  slideLabel: string;
  notes: string;
  onNotesChange: (value: string) => void;
  onClose: () => void;
}

export const SpeakerNotesDrawer: React.FC<SpeakerNotesDrawerProps> = ({
  slideLabel,
  notes,
  onNotesChange,
  onClose,
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const trimmed = notes.trim();
  const charCount = trimmed.length;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  return (
    <div
      className="absolute bottom-3 left-1/2 z-30 w-[min(44rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-950/95 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur"
      role="dialog"
      aria-label="Speaker notes"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 items-center rounded border border-amber-700/60 bg-amber-950/40 px-2 text-[9px] font-black uppercase tracking-[0.22em] text-amber-200">
            Speaker Notes
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {slideLabel || 'Current slide'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 tabular-nums">
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} {charCount === 1 ? 'char' : 'chars'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-800 bg-zinc-900 text-[11px] font-black text-zinc-400 hover:border-zinc-600 hover:text-white active:scale-[0.94] transition-all"
            title="Close (Esc)"
            aria-label="Close speaker notes"
          >
            X
          </button>
        </div>
      </div>

      <div className="px-3 py-3">
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Draft talking points, scripture references, transitions, or stage cues for this slide…"
          className="min-h-[9rem] w-full resize-y rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-[12px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          aria-label="Speaker notes for the current slide"
        />
        <div className="mt-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-zinc-600">
          <span>Visible on Stage view · hidden from audience</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
};
