import React from 'react';
import type { WebSearchResult } from '../../services/lyricSources/types';

export type CaptureStatus = 'idle' | 'armed' | 'captured';

interface WebSearchResultCardProps {
  results: WebSearchResult[];
  captureStatus: CaptureStatus;
  manualLyrics: string;
  onOpenSource: (result: WebSearchResult) => void;
  onManualLyricsChange: (value: string) => void;
  onGenerate: () => void;
}

export function WebSearchResultCard({
  results,
  captureStatus,
  manualLyrics,
  onOpenSource,
  onManualLyricsChange,
  onGenerate,
}: WebSearchResultCardProps) {
  if (!results.length) return null;
  const hasLyrics = captureStatus === 'captured' || manualLyrics.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">Web results - open a source, then paste the exact lyrics before generating.</p>
      <ul className="flex flex-col gap-2">
        {results.map((r, i) => (
          <li key={r.url + i} className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-slate-100">{r.title}</span>
              <span className="shrink-0 text-xs text-slate-500">{r.provider || 'web'} - {r.domain}</span>
            </div>
            <p className="text-sm text-slate-300">{r.snippet}</p>
            <div className="mt-1 flex items-center justify-end">
              <button
                type="button"
                data-role="open-source"
                className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500"
                onClick={() => onOpenSource(r)}
              >
                Open Source
              </button>
            </div>
          </li>
        ))}
      </ul>

      <textarea
        data-testid="web-lyrics-manual-paste"
        value={manualLyrics}
        onChange={(event) => onManualLyricsChange(event.target.value)}
        className="h-24 w-full resize-none rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-xs leading-relaxed text-slate-100 placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none"
        placeholder="Paste exact lyrics here after opening a source"
      />

      <div className="mt-1 flex items-center justify-between border-t border-slate-800 pt-3">
        <span className="text-xs text-slate-400">
          {captureStatus === 'armed' ? 'Waiting for copied lyrics, or paste them here.' :
            captureStatus === 'captured' ? 'Lyrics detected - ready to generate.' :
            manualLyrics.trim() ? 'Pasted lyrics ready to generate.' :
            'No lyrics pasted yet.'}
        </span>
        <button
          type="button"
          data-role="generate"
          disabled={!hasLyrics}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onGenerate}
        >
          Generate slides
        </button>
      </div>
    </div>
  );
}
