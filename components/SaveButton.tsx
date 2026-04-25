import React, { useCallback, useEffect, useRef, useState } from 'react';

interface SaveButtonProps {
  /** Timestamp (ms) of the last successful save, or null if never saved this session. */
  lastSavedAt: number | null;
  /** Fired when the operator explicitly requests a flush. Should be idempotent. */
  onSave: () => void | Promise<void>;
}

// Compact desktop-grade save button, meant to sit directly below the native
// menu bar. The app auto-saves, so this is really a "flush + confirmation"
// action for operators who want visible proof that their changes are
// persisted. Shows the relative time since the last save.
export function SaveButton({ lastSavedAt, onSave }: SaveButtonProps) {
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // Ref guard — `saving` state can't short-circuit a second synchronous
  // click because React batches the preceding setSaving(true).
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(false), 1600);
    return () => window.clearTimeout(t);
  }, [justSaved]);

  const handleClick = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSaving(true);
    try {
      await onSave();
      setJustSaved(true);
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }, [onSave]);

  return (
    <div
      data-testid="save-button-toolbar"
      className="flex items-center gap-3 px-3 h-9 border-b border-zinc-900 bg-zinc-950/80 text-[10px] tracking-wider"
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        data-testid="save-button"
        title="Flush all pending workspace changes to the server (Ctrl+S)"
        className={`flex items-center gap-1.5 h-7 px-3 rounded-md border text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
          justSaved
            ? 'border-emerald-600/70 bg-emerald-950/40 text-emerald-200'
            : saving
              ? 'border-zinc-700 bg-zinc-900 text-zinc-500'
              : 'border-violet-700/60 bg-violet-950/30 text-violet-200 hover:border-violet-500 hover:text-violet-100'
        }`}
      >
        <SaveIcon />
        <span>{justSaved ? 'Saved' : saving ? 'Saving…' : 'Save'}</span>
      </button>
      <span data-testid="save-last-saved" className="text-zinc-500 text-[10px] uppercase tracking-[0.18em]">
        {formatLastSaved(lastSavedAt)}
      </span>
    </div>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 16 16" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path d="M3 2h8l2 2v10H3V2z" />
      <path d="M5 2v4h5V2" />
      <path d="M5 10h6" />
      <path d="M5 12h6" />
    </svg>
  );
}

function formatLastSaved(ts: number | null): string {
  if (!ts) return 'Not yet saved this session';
  const delta = Math.max(0, Date.now() - ts);
  if (delta < 5_000) return 'Saved just now';
  if (delta < 60_000) return `Saved ${Math.floor(delta / 1_000)}s ago`;
  if (delta < 3_600_000) return `Saved ${Math.floor(delta / 60_000)}m ago`;
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `Saved ${hh}:${mm}`;
}
