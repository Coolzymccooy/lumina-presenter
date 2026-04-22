import React from 'react';
import type { BatchSongResolution, WebSearchResult } from '../../services/lyricSources/types';

interface BatchLyricResolverPanelProps {
  serviceList: string;
  resolutions: BatchSongResolution[];
  isResolving: boolean;
  generatingSongId: string | null;
  onServiceListChange: (value: string) => void;
  onResolve: () => void;
  onOpenSource: (songId: string, result: WebSearchResult) => void;
  onPastedLyricsChange: (songId: string, value: string) => void;
  onGenerate: (resolution: BatchSongResolution) => void;
}

const SERVICE_LIST_TEMPLATE = [
  'Call to worship',
  '1. Olowogbogboro',
  '2. Wetin I go give to You',
  '',
  'Praise',
  '- Amazing Grace',
  '- Na You Dey Reign',
  '',
  'Offering',
  'a) We bring the sacrifice of praise',
].join('\n');

const STATUS_LABEL: Record<BatchSongResolution['status'], string> = {
  idle: 'Queued',
  resolving: 'Resolving',
  catalog: 'Local',
  lrclib: 'LRCLIB',
  sources: 'Sources',
  empty: 'Needs paste',
  error: 'Error',
};

function canGenerate(resolution: BatchSongResolution) {
  return resolution.status === 'catalog' ||
    resolution.status === 'lrclib' ||
    Boolean(resolution.pastedLyrics?.trim());
}

export function BatchLyricResolverPanel({
  serviceList,
  resolutions,
  isResolving,
  generatingSongId,
  onServiceListChange,
  onResolve,
  onOpenSource,
  onPastedLyricsChange,
  onGenerate,
}: BatchLyricResolverPanelProps) {
  const handleUseTemplate = () => {
    const hasContent = serviceList.trim().length > 0;
    if (hasContent && !window.confirm('Replace current list with the template?')) return;
    onServiceListChange(SERVICE_LIST_TEMPLATE);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Service List Resolver</p>
          <p className="mt-0.5 text-[9px] text-zinc-600">Paste today&apos;s song list. Lumina finds sources; you paste exact lyrics before generating.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            data-testid="batch-use-template"
            onClick={handleUseTemplate}
            title="Insert an example service list showing supported formatting (sections + numbered/bulleted songs)"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Template
          </button>
          <button
            type="button"
            onClick={onResolve}
            disabled={isResolving || !serviceList.trim()}
            className="rounded-md bg-purple-700 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isResolving ? 'Resolving...' : 'Resolve'}
          </button>
        </div>
      </div>

      <textarea
        data-testid="batch-service-list-input"
        value={serviceList}
        onChange={(event) => onServiceListChange(event.target.value)}
        className="h-24 w-full resize-none rounded-md border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-200 placeholder-zinc-600 focus:border-purple-500/60 focus:outline-none"
        placeholder={'Call to worship\n-Worthy is your name Jesus\n\nPraise\n1) Joy overflow'}
      />

      {resolutions.length > 0 && (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar" data-testid="batch-results">
          {resolutions.map((resolution) => (
            <div key={resolution.song.id} className="rounded-lg border border-zinc-800 bg-zinc-900/55 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">{resolution.song.section}</div>
                  <div className="truncate text-[11px] font-semibold text-zinc-100">{resolution.song.title}</div>
                </div>
                <span className="shrink-0 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-zinc-400">
                  {STATUS_LABEL[resolution.status]}
                </span>
              </div>

              {resolution.sources?.length ? (
                <div className="mt-2 space-y-1.5">
                  {resolution.sources.slice(0, 3).map((source) => (
                    <div key={source.url} className="rounded-md border border-zinc-800 bg-black/25 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[10px] font-semibold text-zinc-200">{source.title}</div>
                          <div className="mt-0.5 text-[8px] uppercase tracking-wide text-zinc-600">{source.provider || 'web'} - {source.domain}</div>
                        </div>
                        <button
                          type="button"
                          data-testid="batch-open-source"
                          onClick={() => onOpenSource(resolution.song.id, source)}
                          className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-zinc-300 hover:border-zinc-500 hover:text-white"
                        >
                          Open
                        </button>
                      </div>
                      {source.snippet && <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-zinc-500">{source.snippet}</p>}
                    </div>
                  ))}
                </div>
              ) : null}

              {(resolution.status === 'sources' || resolution.status === 'empty' || resolution.status === 'error') && (
                <textarea
                  data-testid={`batch-lyrics-paste-${resolution.song.id}`}
                  value={resolution.pastedLyrics || ''}
                  onChange={(event) => onPastedLyricsChange(resolution.song.id, event.target.value)}
                  className="mt-2 h-20 w-full resize-none rounded border border-zinc-800 bg-black/35 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/50 focus:outline-none"
                  placeholder="Paste exact lyrics here after opening a source"
                />
              )}

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[9px] text-zinc-600">
                  {resolution.status === 'lrclib' && resolution.lrclibHit ? `${resolution.lrclibHit.trackName} - ${resolution.lrclibHit.artistName}` : null}
                  {resolution.status === 'empty' ? 'No source found. Paste lyrics manually.' : null}
                  {resolution.status === 'error' ? resolution.error : null}
                </span>
                <button
                  type="button"
                  data-testid="batch-generate"
                  disabled={!canGenerate(resolution) || generatingSongId === resolution.song.id}
                  onClick={() => onGenerate(resolution)}
                  className="shrink-0 rounded bg-emerald-700 px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generatingSongId === resolution.song.id ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
