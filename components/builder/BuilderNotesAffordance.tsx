import React, { useEffect, useRef, useState } from 'react';
import type { Slide } from '../../types';

interface BuilderNotesAffordanceProps {
  slide: Slide | null;
  onUpdateSlide: (updater: (slide: Slide) => Slide) => void;
  /**
   * 'floating' (default) renders absolute-positioned at the top-right of its
   * relative ancestor (historical placement over the canvas).
   * 'inline' renders as a plain inline element so the button can live inside
   * a toolbar row — e.g. the slide timeline strip header.
   */
  variant?: 'floating' | 'inline';
  /**
   * Which side the popover opens on. Defaults to 'below'. Use 'above' when
   * the trigger lives near the bottom of the viewport (e.g. slide strip).
   */
  popoverSide?: 'above' | 'below';
}

const NotesIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M14 3v5h5" />
    <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5Z" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </svg>
);

export const BuilderNotesAffordance: React.FC<BuilderNotesAffordanceProps> = ({
  slide,
  onUpdateSlide,
  variant = 'floating',
  popoverSide = 'below',
}) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const notesValue = slide?.notes ?? slide?.metadata?.notes ?? '';
  const hasNotes = notesValue.trim().length > 0;
  const disabled = !slide;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!slide) setOpen(false);
  }, [slide]);

  const handleChange = (value: string) => {
    onUpdateSlide((current) => ({
      ...current,
      notes: value,
      metadata: { ...(current.metadata || {}), notes: value },
    }));
  };

  const wrapperClass = variant === 'inline'
    ? 'relative inline-flex'
    : 'pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-2';
  const triggerButtonClass = variant === 'inline'
    ? `inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[9px] font-black uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        open
          ? 'border-amber-500/70 bg-amber-500/20 text-amber-100'
          : hasNotes
            ? 'border-amber-700/70 bg-amber-950/50 text-amber-200 hover:border-amber-500 hover:text-amber-100'
            : 'border-cyan-700/60 bg-cyan-950/30 text-cyan-200 hover:border-cyan-500 hover:text-cyan-100'
      }`
    : `pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] font-black uppercase tracking-[0.14em] shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        open
          ? 'border-amber-500/70 bg-amber-500/20 text-amber-100'
          : hasNotes
            ? 'border-amber-700/70 bg-amber-950/50 text-amber-200 hover:border-amber-500 hover:text-amber-100'
            : 'border-white/15 bg-[rgba(14,15,20,0.82)] text-zinc-200 hover:border-white/30 hover:text-white'
      }`;
  const popoverClass = variant === 'inline'
    ? `absolute right-0 z-30 w-[320px] rounded-xl border border-zinc-800 bg-[rgba(14,15,20,0.96)] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
        popoverSide === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
      }`
    : 'pointer-events-auto w-[320px] rounded-xl border border-zinc-800 bg-[rgba(14,15,20,0.96)] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl';

  return (
    <div className={wrapperClass}>
      <button
        ref={triggerRef}
        type="button"
        data-testid="builder-notes-trigger"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={hasNotes ? 'Edit speaker notes' : 'Add speaker notes'}
        title={hasNotes ? 'Edit speaker notes' : 'Add speaker notes'}
        className={triggerButtonClass}
      >
        <NotesIcon className={variant === 'inline' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        <span>{hasNotes ? 'Notes' : 'Add Notes'}</span>
        {hasNotes && !open && (
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
        )}
      </button>
      {open && (
        <div
          ref={popoverRef}
          data-testid="builder-notes-popover"
          className={popoverClass}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">Speaker Notes</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close speaker notes"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:text-zinc-200"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <textarea
            ref={textareaRef}
            data-testid="builder-notes-textarea"
            value={notesValue}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Tap to add notes for the presenter..."
            className="min-h-[140px] w-full resize-y rounded-lg border border-zinc-800 bg-[#0c0d12] px-3 py-2 text-xs leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-600"
          />
          <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-zinc-500">
            <span>Saved to this slide</span>
            <span>{notesValue.length} chars</span>
          </div>
        </div>
      )}
    </div>
  );
};
