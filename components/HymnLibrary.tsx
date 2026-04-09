import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { HYMN_TYPOGRAPHY_PRESETS } from '../presets/hymnTypographyPresets';
import { getCatalogHymnById, listCatalogHymns, searchCatalogHymns } from '../services/hymnCatalog';
import { ccliCatalogProvider } from '../services/ccliCatalogProvider';
import { generateSlidesFromHymn } from '../services/hymnGenerator';
import { HYMN_THEME_BACKGROUND_MAPPINGS, getSuggestedBackgroundForHymn } from '../services/hymnThemeRouter';
import { insertGeneratedHymnIntoRunSheet, type RunSheetInsertionResult } from '../services/runSheetInsertion';
import { stampItemBackgroundSource } from '../services/backgroundPersistence';
import type { ServiceItem } from '../types';
import type { Hymn, HymnChorusStrategy, HymnThemeCategory } from '../types/hymns';
import { MusicIcon, PlayIcon, PlusIcon, SearchIcon } from './Icons';

const DEFAULT_VISIBLE_HYMNS = listCatalogHymns();
const DEFAULT_HYMN_ID = DEFAULT_VISIBLE_HYMNS[0]?.id || '';

interface HymnLibraryProps {
  schedule: ServiceItem[];
  selectedItemId: string;
  onApplyInsertion: (result: RunSheetInsertionResult, options?: { goLive?: boolean }) => void;
  compact?: boolean;
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
  compact = false,
}) => {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedHymnId, setSelectedHymnId] = useState(DEFAULT_HYMN_ID);
  const [typographyPresetId, setTypographyPresetId] = useState(HYMN_TYPOGRAPHY_PRESETS[0]?.id || '');
  const [chorusStrategy, setChorusStrategy] = useState<HymnChorusStrategy>('smart');
  const [themeOverride, setThemeOverride] = useState<HymnThemeCategory | ''>('');
  const [status, setStatus] = useState('');
  const [ccliSearching, setCcliSearching] = useState(false);
  const [ccliHymns, setCcliHymns] = useState<Hymn[]>([]);

  // Async CCLI search — fires whenever the debounced query changes
  useEffect(() => {
    if (!deferredQuery.trim() || !ccliCatalogProvider.isVisibleInLibrary) {
      setCcliHymns([]);
      return;
    }
    let cancelled = false;
    setCcliSearching(true);
    ccliCatalogProvider.asyncSearch(deferredQuery, { limit: 25 }).then((results) => {
      if (!cancelled) setCcliHymns(results.map((r) => r.hymn));
    }).catch(() => {
      if (!cancelled) setCcliHymns([]);
    }).finally(() => {
      if (!cancelled) setCcliSearching(false);
    });
    return () => { cancelled = true; };
  }, [deferredQuery]);

  const syncResults = useMemo(() => (
    deferredQuery.trim()
      ? searchCatalogHymns(deferredQuery, { limit: 200 }).map((entry) => entry.hymn)
      : [...DEFAULT_VISIBLE_HYMNS].sort((left, right) => left.title.localeCompare(right.title))
  ), [deferredQuery]);

  // Merge sync catalog results with async CCLI results (CCLI results appended, deduplicated by id)
  const results = useMemo(() => {
    const seen = new Set(syncResults.map((h) => h.id));
    const merged = [...syncResults];
    for (const hymn of ccliHymns) {
      if (!seen.has(hymn.id)) {
        seen.add(hymn.id);
        merged.push(hymn);
      }
    }
    return merged;
  }, [syncResults, ccliHymns]);

  // Holds CCLI hymns hydrated with full lyrics after selection
  const [hydratedCcliHymns, setHydratedCcliHymns] = useState<Map<string, Hymn>>(new Map());

  const selectedHymn = useMemo(() => {
    // Prefer a fully-hydrated CCLI hymn (with lyrics) over the stub from search
    const hydrated = hydratedCcliHymns.get(selectedHymnId);
    if (hydrated) return hydrated;
    return (
      results.find((entry) => entry.id === selectedHymnId)
      || getCatalogHymnById(selectedHymnId)
      || results[0]
      || DEFAULT_VISIBLE_HYMNS[0]
    );
  }, [results, selectedHymnId, hydratedCcliHymns]);

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

  // When a CCLI stub hymn is selected, fetch full lyrics in the background
  useEffect(() => {
    if (!selectedHymnId.startsWith('ccli-')) return;
    const already = hydratedCcliHymns.get(selectedHymnId);
    if (already && already.sections.length > 0) return;
    ccliCatalogProvider.asyncGetById(selectedHymnId).then((hymn) => {
      if (hymn) {
        setHydratedCcliHymns((prev) => new Map(prev).set(hymn.id, hymn));
      }
    }).catch(() => { /* best-effort */ });
  }, [selectedHymnId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const generated = generateSlidesFromHymn(selectedHymn, {
      typographyPresetId,
      chorusStrategy,
      backgroundOverride: selectedBackground,
      suppressRepeatedChorusInPreview: chorusStrategy === 'suppress-repeats',
    });
    const backgroundWasExplicitlyChosen = Boolean(themeOverride) || selectedBackground.id !== suggestion.candidate.id;
    return {
      ...generated,
      item: stampItemBackgroundSource(generated.item, backgroundWasExplicitlyChosen ? 'user' : 'system'),
    };
  }, [selectedHymn, suggestion, candidateBackgrounds, selectedBackgroundId, typographyPresetId, chorusStrategy, themeOverride]);

  const applyInsertion = (goLive = false) => {
    if (!preview) return;
    const result = insertGeneratedHymnIntoRunSheet(schedule, preview.item, {
      afterItemId: selectedItemId || null,
    });
    onApplyInsertion(result, { goLive });
    setStatus(goLive ? 'Hymn inserted and sent live.' : 'Hymn inserted into run sheet.');
  };

  if (compact) {
    return (
      <div data-testid="hymn-library" className="flex h-full min-h-0 min-w-0 flex-col bg-zinc-950">
        <div className="border-b border-zinc-900 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Songs</div>
              <div className="mt-1 text-[11px] text-zinc-500">Bundled hymn browser.</div>
            </div>
            <div className="shrink-0 rounded-full border border-emerald-700/60 bg-emerald-950/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
              Bundled
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            <SearchIcon className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search hymns..."
              className="w-full min-w-0 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-2.5 py-2.5">
          <div className="grid min-h-0 gap-3 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/60 xl:self-start">
              <div className="border-b border-zinc-800 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Library</div>
                  <div className="flex items-center gap-2">
                    {ccliSearching && (
                      <span className="text-[9px] text-amber-400 animate-pulse">CCLI…</span>
                    )}
                    <div className="text-[10px] text-zinc-400">
                      {deferredQuery.trim() ? `${results.length} results` : `${DEFAULT_VISIBLE_HYMNS.length} hymns`}
                    </div>
                  </div>
                </div>
              </div>
              <div data-testid="hymn-results" className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {results.map((hymn) => (
                  <button
                    key={hymn.id}
                    data-testid={`hymn-result-${hymn.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedHymnId(hymn.id);
                      setStatus('');
                    }}
                    className={`w-full border-b border-zinc-900 px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                      selectedHymn?.id === hymn.id ? 'bg-zinc-900' : 'hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <MusicIcon className={`mt-0.5 h-4 w-4 shrink-0 ${selectedHymn?.id === hymn.id ? 'text-blue-300' : 'text-zinc-600'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-baseline gap-1.5">
                          <span className="truncate text-[13px] font-semibold text-zinc-100">{hymn.title}</span>
                          {hymn.librarySource?.providerId === 'ccli' && (
                            <span className="shrink-0 rounded border border-amber-800/40 bg-amber-900/30 px-1 py-px text-[8px] font-black uppercase tracking-wide text-amber-300">CCLI</span>
                          )}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-500">{hymn.firstLine}</div>
                      </div>
                    </div>
                  </button>
                ))}
                {results.length === 0 && !ccliSearching && (
                  <div className="p-4 text-[11px] text-zinc-500">No hymns matched this search.</div>
                )}
                {results.length === 0 && ccliSearching && (
                  <div className="p-4 text-[11px] text-zinc-500 animate-pulse">Searching CCLI SongSelect…</div>
                )}
              </div>
            </section>

            {!selectedHymn || !preview || !suggestion ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-8 text-center text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                Select a hymn to build preview slides
              </div>
            ) : (
              <div className="min-w-0 space-y-3">
                <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-black text-zinc-100">{selectedHymn.title}</div>
                      <div className="mt-1 truncate text-[12px] text-zinc-400">{selectedHymn.firstLine}</div>
                      <div className="mt-2 line-clamp-1 text-[11px] text-zinc-500">
                        {selectedHymn.authors.map((entry) => entry.name).join(' / ')}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-zinc-500">Slides</div>
                        <div className="mt-1 text-sm font-bold text-zinc-100">{preview.generatedSlides.length}</div>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-zinc-500">Sections</div>
                        <div className="mt-1 text-sm font-bold text-zinc-100">{selectedHymn.sections.length}</div>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-zinc-500">Tune</div>
                        <div className="mt-1 truncate text-sm font-bold text-zinc-100">{selectedHymn.tunes.map((entry) => entry.name).join(' / ')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedHymn.themes.map((theme) => (
                      <span key={theme} className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-400">
                        {theme}
                      </span>
                    ))}
                    {selectedHymn.copyright.requiresReview && (
                      <span className="rounded border border-amber-700/50 bg-amber-950/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-300">
                        Review
                      </span>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Style</div>
                  <div className="mt-3 grid gap-2 lg:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-500">Type</span>
                      <select
                        value={typographyPresetId}
                        onChange={(event) => setTypographyPresetId(event.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[12px] text-zinc-200"
                      >
                        {HYMN_TYPOGRAPHY_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>{preset.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-500">Chorus</span>
                      <select
                        value={chorusStrategy}
                        onChange={(event) => setChorusStrategy(event.target.value as HymnChorusStrategy)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[12px] text-zinc-200"
                      >
                        {CHORUS_STRATEGIES.map((entry) => (
                          <option key={entry.id} value={entry.id}>{entry.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-500">Theme</span>
                      <select
                        value={themeOverride}
                        onChange={(event) => setThemeOverride(event.target.value as HymnThemeCategory | '')}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[12px] text-zinc-200"
                      >
                        <option value="">Auto</option>
                        {themeOptions.map((entry) => (
                          <option key={entry} value={entry}>{entry}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-500">Background</div>
                        <div className="mt-1 truncate text-[12px] text-zinc-100">{suggestion.label}</div>
                      </div>
                      <div className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-zinc-400">
                        {suggestion.category}
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] leading-4 text-zinc-500">{suggestion.summary}</div>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                      {candidateBackgrounds.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => setSelectedBackgroundId(candidate.id)}
                          className={`w-36 shrink-0 rounded-xl border p-2 text-left transition-colors ${
                            selectedBackgroundId === candidate.id ? 'border-blue-500 bg-blue-950/25' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                          }`}
                        >
                          <div className="aspect-video overflow-hidden rounded-lg border border-zinc-800">
                            {candidate.mediaType === 'image' ? (
                              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${candidate.backgroundUrl})` }} />
                            ) : (
                              <video src={candidate.backgroundUrl} className="h-full w-full object-cover" muted autoPlay loop playsInline />
                            )}
                          </div>
                          <div className="mt-2 truncate text-[11px] font-semibold text-zinc-200">{candidate.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)]">
                  <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Preview</div>
                      <div className="text-[10px] text-zinc-500">{preview.generatedSlides.length} slides</div>
                    </div>
                    <div className="mt-3 max-h-[17rem] space-y-2 overflow-y-auto custom-scrollbar pr-1">
                      {preview.generatedSlides.map((slide) => (
                        <div key={slide.id} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">{slide.label}</div>
                            {slide.repeated && <span className="text-[8px] uppercase tracking-[0.16em] text-cyan-300">Repeat</span>}
                          </div>
                          <div className="mt-2 whitespace-pre-line text-[12px] leading-5 text-zinc-100">{slide.content}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <details className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Outline</span>
                      <span className="text-[10px] text-zinc-600">{selectedHymn.sections.length} sections</span>
                    </summary>
                    <div className="mt-3 max-h-[17rem] space-y-2 overflow-y-auto custom-scrollbar pr-1">
                      {selectedHymn.sections.map((section) => (
                        <div key={section.id} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 truncate text-[11px] font-semibold text-zinc-100">{section.label}</div>
                            <div className="shrink-0 text-[9px] uppercase tracking-wider text-zinc-500">{section.type}</div>
                          </div>
                          <div className="mt-2 line-clamp-4 whitespace-pre-line text-[10px] leading-4 text-zinc-400">
                            {section.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedHymn && preview && suggestion && (
          <div className="border-t border-zinc-800/80 bg-zinc-950/95 px-2.5 py-2 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5 shadow-[0_-12px_28px_rgba(0,0,0,0.24)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Insert</div>
                  <div className="mt-1 text-[10px] leading-4 text-zinc-400">Add after the selected run-sheet item.</div>
                </div>
                <div className="shrink-0 rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-zinc-500">
                  {preview.generatedSlides.length} slides
                </div>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  data-testid="hymn-insert-button"
                  type="button"
                  onClick={() => applyInsertion(false)}
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-[11px] font-black tracking-[0.08em] text-zinc-100 hover:border-zinc-500"
                >
                  <PlusIcon className="h-4 w-4 shrink-0" /> <span className="truncate">Insert</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyInsertion(true)}
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600/20 px-3 py-2 text-[11px] font-black tracking-[0.08em] text-blue-200 hover:bg-blue-600/30"
                >
                  <PlayIcon className="h-4 w-4 shrink-0" /> <span className="truncate">Insert + Live</span>
                </button>
              </div>
              {status && <div className="mt-2 text-[10px] text-emerald-300">{status}</div>}
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="hymn-library" className="flex h-full min-h-0 min-w-0 flex-col bg-zinc-950">
      <div className="border-b border-zinc-900 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Hymn Library</div>
            <div className="mt-1 text-xs text-zinc-400">{DEFAULT_VISIBLE_HYMNS.length} bundled hymns with structured generation.</div>
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

      <div className="flex min-h-0 flex-1 min-w-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-3 pb-32">
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/60">
            <div className="border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Song Library</div>
                  <div className="mt-1 text-xs text-zinc-400">Search by title, first line, tune, author, or theme.</div>
                </div>
                {ccliSearching && (
                  <span className="shrink-0 text-[9px] font-semibold text-amber-400 animate-pulse">CCLI…</span>
                )}
              </div>
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
                      <div className="flex min-w-0 items-baseline gap-1.5">
                        <span className="truncate text-sm font-semibold text-zinc-100">{hymn.title}</span>
                        {hymn.librarySource?.providerId === 'ccli' && (
                          <span className="shrink-0 rounded border border-amber-800/40 bg-amber-900/30 px-1 py-px text-[8px] font-black uppercase tracking-wide text-amber-300">CCLI</span>
                        )}
                      </div>
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
              {results.length === 0 && !ccliSearching && (
                <div className="p-4 text-xs text-zinc-500">No hymns matched this search.</div>
              )}
              {results.length === 0 && ccliSearching && (
                <div className="p-4 text-xs text-zinc-500 animate-pulse">Searching CCLI SongSelect…</div>
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

            </>
          )}
        </div>
      </div>
      {selectedHymn && preview && suggestion && (
        <div className="border-t border-zinc-800/80 bg-zinc-950/95 px-3 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 shadow-[0_-12px_28px_rgba(0,0,0,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Insert</div>
                <div className="mt-1 pr-2 text-[11px] leading-4 text-zinc-400">
                  Insert after the selected run-sheet item and keep this hymn&apos;s style snapshot locked for the scheduled service.
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                {preview.generatedSlides.length} slides
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <button
                data-testid="hymn-insert-button"
                type="button"
                onClick={() => applyInsertion(false)}
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-[12px] font-black tracking-[0.08em] text-zinc-100 hover:border-zinc-500"
              >
                <PlusIcon className="h-4 w-4 shrink-0" /> <span className="whitespace-normal text-center">Insert Into Run Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => applyInsertion(true)}
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600/20 px-3 py-2.5 text-[12px] font-black tracking-[0.08em] text-blue-200 hover:bg-blue-600/30"
              >
                <PlayIcon className="h-4 w-4 shrink-0" /> <span className="whitespace-normal text-center">Insert And Go Live</span>
              </button>
            </div>
            {status && <div className="mt-2 text-[11px] text-emerald-300">{status}</div>}
          </section>
        </div>
      )}
      </div>
    </div>
  );
};
