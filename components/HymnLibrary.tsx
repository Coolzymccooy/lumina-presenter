import React, { useDeferredValue, useMemo, useState } from 'react';
import { HYMN_TYPOGRAPHY_PRESETS } from '../presets/hymnTypographyPresets';
import { getCatalogHymnById, listCatalogHymns, searchCatalogHymns } from '../services/hymnCatalog';
import { generateSlidesFromHymn } from '../services/hymnGenerator';
import { HYMN_THEME_BACKGROUND_MAPPINGS, getSuggestedBackgroundForHymn } from '../services/hymnThemeRouter';
import { insertGeneratedHymnIntoRunSheet, type RunSheetInsertionResult } from '../services/runSheetInsertion';
import type { ServiceItem } from '../types';
import type { HymnChorusStrategy, HymnThemeCategory } from '../types/hymns';
import { MusicIcon, PlayIcon, PlusIcon, SearchIcon } from './Icons';

const DEFAULT_VISIBLE_HYMNS = listCatalogHymns();
const DEFAULT_HYMN_ID = DEFAULT_VISIBLE_HYMNS[0]?.id || '';

interface HymnLibraryProps {
  schedule: ServiceItem[];
  selectedItemId: string;
  onApplyInsertion: (result: RunSheetInsertionResult, options?: { goLive?: boolean }) => void;
}

const CHORUS_STRATEGIES: Array<{ id: HymnChorusStrategy; label: string; description: string }> = [
  { id: 'smart', label: 'Smart Repeat', description: 'Repeat chorus after verses when the hymn indicates it.' },
  { id: 'explicit-only', label: 'Explicit Only', description: 'Only use chorus placements stored in the hymn text.' },
  { id: 'repeat-after-every-verse', label: 'After Every Verse', description: 'Force repeatable choruses after each verse.' },
  { id: 'suppress-repeats', label: 'Suppress Repeats', description: 'Use a compact preview flow with repeated choruses removed.' },
];

export const HymnLibrary: React.FC<HymnLibraryProps> = ({
  schedule,
  selectedItemId,
  onApplyInsertion,
}) => {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedHymnId, setSelectedHymnId] = useState(DEFAULT_HYMN_ID);
  const [typographyPresetId, setTypographyPresetId] = useState(HYMN_TYPOGRAPHY_PRESETS[0]?.id || '');
  const [chorusStrategy, setChorusStrategy] = useState<HymnChorusStrategy>('smart');
  const [themeOverride, setThemeOverride] = useState<HymnThemeCategory | ''>('');
  const [status, setStatus] = useState('');

  const results = useMemo(() => (
    deferredQuery.trim()
      ? searchCatalogHymns(deferredQuery, { limit: 25 }).map((entry) => entry.hymn)
      : [...DEFAULT_VISIBLE_HYMNS].sort((left, right) => left.title.localeCompare(right.title))
  ), [deferredQuery]);

  const selectedHymn = useMemo(() => (
    results.find((entry) => entry.id === selectedHymnId)
    || getCatalogHymnById(selectedHymnId)
    || results[0]
    || DEFAULT_VISIBLE_HYMNS[0]
  ), [results, selectedHymnId]);

  const suggestion = useMemo(() => (
    selectedHymn
      ? getSuggestedBackgroundForHymn(selectedHymn, themeOverride || undefined)
      : null
  ), [selectedHymn, themeOverride]);

  const themeOptions = useMemo(() => (
    selectedHymn
      ? Array.from(new Set([selectedHymn.presentationDefaults.defaultThemeCategory, ...selectedHymn.themes]))
      : []
  ), [selectedHymn]);

  const candidateBackgrounds = useMemo(() => (
    suggestion
      ? HYMN_THEME_BACKGROUND_MAPPINGS.find((entry) => entry.category === suggestion.category)?.candidates || [suggestion.candidate]
      : []
  ), [suggestion]);

  const [selectedBackgroundId, setSelectedBackgroundId] = useState('');

  React.useEffect(() => {
    if (!selectedHymn) return;
    setTypographyPresetId(selectedHymn.presentationDefaults.defaultTypographyPresetId);
    setChorusStrategy(selectedHymn.presentationDefaults.defaultChorusStrategy);
  }, [selectedHymn?.id]);

  React.useEffect(() => {
    if (!suggestion) return;
    setSelectedBackgroundId(suggestion.candidate.id);
  }, [suggestion?.candidate.id]);

  const preview = useMemo(() => {
    if (!selectedHymn || !suggestion) return null;
    const selectedBackground = candidateBackgrounds.find((entry) => entry.id === selectedBackgroundId) || suggestion.candidate;
    return generateSlidesFromHymn(selectedHymn, {
      typographyPresetId,
      chorusStrategy,
      backgroundOverride: selectedBackground,
      suppressRepeatedChorusInPreview: chorusStrategy === 'suppress-repeats',
    });
  }, [selectedHymn, suggestion, candidateBackgrounds, selectedBackgroundId, typographyPresetId, chorusStrategy]);

  const applyInsertion = (goLive = false) => {
    if (!preview) return;
    const result = insertGeneratedHymnIntoRunSheet(schedule, preview.item, {
      afterItemId: selectedItemId || null,
    });
    onApplyInsertion(result, { goLive });
    setStatus(goLive ? 'Hymn inserted and sent live.' : 'Hymn inserted into run sheet.');
  };

  return (
    <div data-testid="hymn-library" className="flex h-full min-h-0 min-w-0 flex-col bg-zinc-950">
      <div className="border-b border-zinc-900 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Hymn Library</div>
            <div className="mt-1 text-xs text-zinc-400">25 bundled hymns with structured generation.</div>
          </div>
          <div className="shrink-0 rounded-full border border-emerald-700/60 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
            Bundled
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, first line, author, tune, theme..."
            className="w-full min-w-0 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 min-w-0 flex-col overflow-y-auto custom-scrollbar p-3">
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/60">
            <div className="border-b border-zinc-800 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Bundled Library</div>
              <div className="mt-1 text-xs text-zinc-400">Search by title, first line, tune, author, or theme.</div>
            </div>
            <div data-testid="hymn-results" className="max-h-80 overflow-y-auto custom-scrollbar">
              {results.map((hymn) => (
                <button
                  key={hymn.id}
                  data-testid={`hymn-result-${hymn.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedHymnId(hymn.id);
                    setStatus('');
                  }}
                  className={`w-full border-b border-zinc-900 px-4 py-3 text-left transition-colors last:border-b-0 ${selectedHymn?.id === hymn.id ? 'bg-zinc-900' : 'hover:bg-zinc-900/60'}`}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <MusicIcon className={`mt-0.5 h-4 w-4 shrink-0 ${selectedHymn?.id === hymn.id ? 'text-blue-300' : 'text-zinc-600'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-100">{hymn.title}</div>
                      <div className="mt-1 truncate text-[11px] text-zinc-500">{hymn.firstLine}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {hymn.themes.slice(0, 3).map((theme) => (
                          <span key={theme} className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-400">
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {results.length === 0 && (
                <div className="p-4 text-xs text-zinc-500">No hymns matched this search.</div>
              )}
            </div>
          </section>

          {!selectedHymn || !preview || !suggestion ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-500">
              Select a hymn to preview generation.
            </div>
          ) : (
            <>
              <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-black text-zinc-100">{selectedHymn.title}</div>
                    <div className="mt-1 text-sm text-zinc-400">{selectedHymn.firstLine}</div>
                    <div className="mt-2 text-[11px] text-zinc-500">
                      {selectedHymn.authors.map((entry) => entry.name).join(' / ')}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-700/60 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                      PD Text/Tune
                    </span>
                    {selectedHymn.copyright.requiresReview && (
                      <span className="rounded-full border border-amber-700/60 bg-amber-950/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                        Review Note
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid min-w-0 gap-3">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Tune</div>
                    <div className="mt-1 text-sm text-zinc-200">{selectedHymn.tunes.map((entry) => entry.name).join(' / ')}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">{selectedHymn.meter || 'Meter not set'}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Themes</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedHymn.themes.map((theme) => (
                        <span key={theme} className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Generator</div>
                    <div className="mt-1 text-sm text-zinc-200">{preview.generatedSlides.length} slides</div>
                    <div className="mt-1 text-[11px] text-zinc-500">{selectedHymn.sections.length} structured sections</div>
                  </div>
                </div>
              </section>

              <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Generation Controls</div>
                <div className="mt-3 grid min-w-0 gap-3">
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Typography</span>
                    <select
                      value={typographyPresetId}
                      onChange={(event) => setTypographyPresetId(event.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                    >
                      {HYMN_TYPOGRAPHY_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Chorus Handling</span>
                    <select
                      value={chorusStrategy}
                      onChange={(event) => setChorusStrategy(event.target.value as HymnChorusStrategy)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                    >
                      {CHORUS_STRATEGIES.map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Theme Route</span>
                    <select
                      value={themeOverride}
                      onChange={(event) => setThemeOverride(event.target.value as HymnThemeCategory | '')}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                    >
                      <option value="">Auto from hymn</option>
                      {themeOptions.map((entry) => (
                        <option key={entry} value={entry}>{entry}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Suggested Background</div>
                      <div className="mt-1 text-sm text-zinc-100">{suggestion.label}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">{suggestion.summary}</div>
                    </div>
                    <div className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-400">
                      {suggestion.category}
                    </div>
                  </div>
                  <div className="mt-3 grid min-w-0 gap-2">
                    {candidateBackgrounds.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelectedBackgroundId(candidate.id)}
                        className={`min-w-0 rounded-xl border p-2 text-left transition-colors ${selectedBackgroundId === candidate.id ? 'border-blue-500 bg-blue-950/25' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}
                      >
                        <div className="aspect-video overflow-hidden rounded-lg border border-zinc-800">
                          {candidate.mediaType === 'image' ? (
                            <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${candidate.backgroundUrl})` }} />
                          ) : (
                            <video src={candidate.backgroundUrl} className="h-full w-full object-cover" muted autoPlay loop playsInline />
                          )}
                        </div>
                        <div className="mt-2 truncate text-xs font-semibold text-zinc-200">{candidate.label}</div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{candidate.mediaType}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Slide Preview</div>
                  <div className="text-[11px] text-zinc-500">{preview.generatedSlides.length} generated slides</div>
                </div>
                <div className="mt-3 grid min-w-0 gap-3">
                  {preview.generatedSlides.map((slide) => (
                    <div key={slide.id} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{slide.label}</div>
                        {slide.repeated && <span className="text-[9px] uppercase tracking-widest text-cyan-300">Repeat</span>}
                      </div>
                      <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-100">{slide.content}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Section Structure</div>
                <div className="mt-3 space-y-2">
                  {selectedHymn.sections.map((section) => (
                    <div key={section.id} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 truncate text-xs font-semibold text-zinc-100">{section.label}</div>
                        <div className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">{section.type}</div>
                      </div>
                      <div className="mt-2 line-clamp-4 whitespace-pre-line text-[11px] leading-relaxed text-zinc-400">
                        {section.text}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Insert</div>
                <div className="mt-2 text-sm text-zinc-400">
                  Generated hymn items are inserted after the currently selected run-sheet item and keep a style snapshot so later preset changes do not rewrite scheduled services.
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    data-testid="hymn-insert-button"
                    type="button"
                    onClick={() => applyInsertion(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black tracking-wider text-zinc-100 hover:border-zinc-500"
                  >
                    <PlusIcon className="h-4 w-4" /> INSERT INTO RUN SHEET
                  </button>
                  <button
                    type="button"
                    onClick={() => applyInsertion(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600/20 px-4 py-3 text-sm font-black tracking-wider text-blue-200 hover:bg-blue-600/30"
                  >
                    <PlayIcon className="h-4 w-4" /> INSERT AND GO LIVE
                  </button>
                </div>
                {status && <div className="mt-3 text-[11px] text-emerald-300">{status}</div>}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
