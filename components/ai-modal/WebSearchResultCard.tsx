// components/ai-modal/WebSearchResultCard.tsx
import React from 'react';
import type { WebSearchResult } from '../../services/lyricSources/types';

export type CaptureStatus = 'idle' | 'armed' | 'captured';

interface WebSearchResultCardProps {
  results: WebSearchResult[];
  captureStatus: CaptureStatus;
  onOpenSource: (result: WebSearchResult) => void;
  onGenerate: () => void;
}

export function WebSearchResultCard({ results, captureStatus, onOpenSource, onGenerate }: WebSearchResultCardProps) {
  if (!results.length) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">Web results — click Open Source, then copy the lyrics; Lumina will detect the paste.</p>
      <ul className="flex flex-col gap-2">
        {results.map((r, i) => (
          <li key={r.url + i} className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-slate-100">{r.title}</span>
              <span className="shrink-0 text-xs text-slate-500">{r.domain}</span>
            </div>
            <p className="text-sm text-slate-300">{r.snippet}</p>
            <div className="mt-1 flex items-center justify-end">
              <button
                type="button"
                data-role="open-source"
                className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500"
                onClick={() => onOpenSource(r)}
              >
                Open Source ↗
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-center justify-between border-t border-slate-800 pt-3">
        <span className="text-xs text-slate-400">
          {captureStatus === 'armed' ? 'Waiting for you to copy lyrics…' :
            captureStatus === 'captured' ? 'Lyrics detected — ready to generate.' :
            'No lyrics captured yet.'}
        </span>
        <button
          type="button"
          data-role="generate"
          disabled={captureStatus !== 'captured'}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onGenerate}
        >
          Generate slides
        </button>
      </div>
    </div>
  );
}
