
import React, { useCallback, useRef, useState } from 'react';
import { ServiceItem, SpeakerTimerPreset } from '../types';
import { DEFAULT_BACKGROUNDS, LUMINA_MOTION_BACKGROUNDS } from '../constants';
import { PlusIcon } from './Icons';
import { searchPexelsMotion } from '../services/serverApi';
import type { RemoteMotionAsset } from '../services/serverApi';
import { MotionCanvas } from './MotionCanvas';
import { isMotionUrl } from '../services/motionEngine';
import { Tooltip } from './ui';

const DEFAULT_TITLE_RE = /^(new item|untitled|new slide|new song|new sermon)$/i;
const isDefaultItemTitle = (title: string): boolean => {
  const trimmed = title.trim();
  return trimmed.length === 0 || DEFAULT_TITLE_RE.test(trimmed);
};

const BG_PRESETS = [
  { label: 'Worship',     query: 'worship background' },
  { label: 'Church',      query: 'church light background' },
  { label: 'Celebration', query: 'celebration confetti background' },
  { label: 'Cross',       query: 'cross light background' },
  { label: 'Nature',      query: 'nature sky background' },
  { label: 'Abstract',    query: 'abstract light background' },
  { label: 'Fire',        query: 'fire flame background' },
  { label: 'Water',       query: 'water waves background' },
  { label: 'Stars',       query: 'stars galaxy background' },
  { label: 'Sunrise',     query: 'sunrise sky background' },
];

export type QuickBackgroundSelection = {
  url: string;
  thumb: string;
  mediaType: 'video' | 'image' | 'motion';
  provider: string;
  category: string;
  title: string;
  sourceUrl: string;
};

export function SmartBgSearch({ onApply }: { onApply: (selection: QuickBackgroundSelection) => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [showLumina, setShowLumina] = useState(false);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Quick BG');
  const [results, setResults] = useState<RemoteMotionAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applyingAssetId, setApplyingAssetId] = useState<string | null>(null);
  const [hoveredLuminaId, setHoveredLuminaId] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, RemoteMotionAsset[]>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string) => {
    const key = q.trim().toLowerCase();
    if (!key) return;
    setActiveQuery(q);
    setError('');
    if (cacheRef.current[key]) {
      setResults(cacheRef.current[key]);
      return;
    }
    setLoading(true);
    try {
      const res = await searchPexelsMotion(q, 6);
      const assets = res?.assets || [];
      cacheRef.current[key] = assets;
      setResults(assets);
      if (!assets.length) setError('No results found.');
    } catch {
      setError('Search failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePreset = (preset: typeof BG_PRESETS[0]) => {
    setQuery(preset.query);
    setOpen(true);
    setActiveCategory(preset.label);
    runSearch(preset.query);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setOpen(true);
      setActiveCategory(query.trim());
      runSearch(query.trim());
    }
  };

  const handleApply = useCallback(async (asset: RemoteMotionAsset) => {
    if (applyingAssetId) return;
    setError('');
    setApplyingAssetId(asset.id);
    try {
      await onApply({
        url: asset.url,
        thumb: asset.thumb,
        mediaType: asset.mediaType,
        provider: asset.provider,
        category: activeCategory,
        title: asset.name,
        sourceUrl: asset.url,
      });
      setOpen(false);
      setActiveQuery('');
    } catch {
      setError('Could not apply that background. Try again.');
    } finally {
      setApplyingAssetId(null);
    }
  }, [activeCategory, applyingAssetId, onApply]);

  const handleLuminaToggle = useCallback(() => {
    setShowLumina((prev) => !prev);
    setOpen(false);
    setActiveQuery('');
  }, []);

  const handleLuminaApply = useCallback(async (bg: typeof LUMINA_MOTION_BACKGROUNDS[0]) => {
    if (applyingAssetId) return;
    setApplyingAssetId(bg.id);
    try {
      await onApply({
        url: bg.url,
        thumb: bg.poster,
        mediaType: 'motion',
        provider: 'lumina',
        category: 'Lumina',
        title: bg.name,
        sourceUrl: bg.url,
      });
      setShowLumina(false);
    } catch {
      setError('Could not apply that background.');
    } finally {
      setApplyingAssetId(null);
    }
  }, [applyingAssetId, onApply]);

  return (
    <div className="flex flex-col gap-2">
      {/* Preset chips + search row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600 shrink-0">Quick BG</span>
        <button
          disabled={!!applyingAssetId}
          onClick={handleLuminaToggle}
          className={`h-6 px-2 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${showLumina ? 'border-purple-500/60 bg-purple-950/40 text-purple-300' : 'border-purple-800/50 bg-purple-950/20 text-purple-400 hover:border-purple-500 hover:text-purple-200'}`}
        >Lumina</button>
        {BG_PRESETS.map((p) => (
          <button
            key={p.label}
            disabled={!!applyingAssetId}
            onClick={() => { setShowLumina(false); handlePreset(p); }}
            className={`h-6 px-2 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${activeQuery === p.query && open ? 'border-blue-600/60 bg-blue-950/40 text-blue-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'}`}
          >{p.label}</button>
        ))}
        <form onSubmit={handleSubmit} className="flex items-center gap-1 ml-auto">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!!applyingAssetId}
            placeholder="Search Pexels…"
            className="h-6 w-28 bg-zinc-900 border border-zinc-700 rounded-md px-2 text-[10px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-600/60 transition-colors disabled:opacity-50"
          />
          <button type="submit" disabled={!!applyingAssetId} className="h-6 px-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-[9px] font-bold text-zinc-300 transition-colors disabled:opacity-50">Go</button>
        </form>
      </div>

      {/* Pexels results panel */}
      {open && !showLumina && (
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/80 p-2">
          {loading && (
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-md bg-zinc-800 animate-pulse" />
              ))}
            </div>
          )}
          {error && !loading && (
            <div className="text-[10px] text-zinc-500 text-center py-3">{error}</div>
          )}
          {!loading && !error && results.length > 0 && (
            <>
              <div className="grid grid-cols-6 gap-1.5">
                {results.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => void handleApply(asset)}
                    disabled={!!applyingAssetId}
                    className="group relative aspect-video rounded-md overflow-hidden border border-zinc-800 hover:border-blue-500 transition-all shadow-md"
                    title={asset.name}
                  >
                    <img src={asset.thumb} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-[8px] font-black uppercase tracking-wider bg-blue-600/80 rounded px-1.5 py-0.5 transition-all">
                        {applyingAssetId === asset.id ? 'Applying...' : 'Apply'}
                      </span>
                    </div>
                    {asset.mediaType === 'video' && (
                      <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded px-1 py-0.5 text-[7px] font-bold text-zinc-300 uppercase">VID</div>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-[8px] text-zinc-700 text-right">Powered by Pexels</div>
            </>
          )}
        </div>
      )}

      {/* Lumina Quick BG panel */}
      {showLumina && (
        <div className="rounded-xl border border-purple-900/40 bg-purple-950/20 p-2">
          <div className="grid grid-cols-6 gap-1.5">
            {LUMINA_MOTION_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => void handleLuminaApply(bg)}
                onMouseEnter={() => setHoveredLuminaId(bg.id)}
                onMouseLeave={() => setHoveredLuminaId((current) => (current === bg.id ? null : current))}
                onFocus={() => setHoveredLuminaId(bg.id)}
                onBlur={() => setHoveredLuminaId((current) => (current === bg.id ? null : current))}
                disabled={!!applyingAssetId}
                className="group relative aspect-video rounded-md overflow-hidden border border-zinc-800 hover:border-purple-500 transition-all shadow-md"
                title={bg.name}
              >
                <div className="w-full h-full">
                  {hoveredLuminaId === bg.id ? (
                    <MotionCanvas motionUrl={bg.url} isPlaying pauseWhenOffscreen />
                  ) : (
                    <img src={bg.poster} alt={bg.name} className="w-full h-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 text-white text-[8px] font-black uppercase tracking-wider bg-purple-600/80 rounded px-1.5 py-0.5 transition-all">
                    {applyingAssetId === bg.id ? 'Applying...' : bg.name}
                  </span>
                </div>
                <div className="absolute bottom-0.5 right-0.5 bg-purple-900/60 rounded px-1 py-0.5 text-[7px] font-bold text-purple-200 uppercase">Lumina</div>
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-[8px] text-purple-400/60 text-right">Lumina Motion — always available offline</div>
        </div>
      )}
    </div>
  );
}

interface ItemEditorPanelProps {
  item: ServiceItem;
  onUpdate: (updatedItem: ServiceItem) => void;
  onApplyQuickBackground?: (item: ServiceItem, selection: QuickBackgroundSelection) => Promise<void> | void;
  onOpenLibrary?: () => void;
  speakerPresets?: SpeakerTimerPreset[];
}

export const ItemEditorPanel: React.FC<ItemEditorPanelProps> = ({ item, onUpdate, onApplyQuickBackground, onOpenLibrary, speakerPresets = [] }) => {
  const defaultTimerCue = {
    enabled: false,
    durationSec: 300,
    speakerName: '',
    autoStartNext: false,
    amberPercent: 25,
    redPercent: 10,
    presetId: '',
  };

  const updateTheme = (updates: Partial<typeof item.theme>) => {
    onUpdate({
      ...item,
      theme: { ...item.theme, ...updates }
    });
  };

  const updateTimerCue = (updates: Partial<typeof defaultTimerCue>) => {
    const merged = { ...defaultTimerCue, ...(item.timerCue || {}), ...updates };
    onUpdate({
      ...item,
      timerCue: merged,
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = speakerPresets.find((entry) => entry.id === presetId);
    if (!preset) return;
    updateTimerCue({
      enabled: true,
      durationSec: Math.max(1, Math.round(preset.durationSec)),
      speakerName: typeof preset.speakerName === 'string' ? preset.speakerName : (item.timerCue?.speakerName || ''),
      autoStartNext: !!preset.autoStartNextDefault,
      amberPercent: Math.max(1, Math.min(99, Math.round(preset.amberPercent || 25))),
      redPercent: Math.max(1, Math.min(99, Math.round(preset.redPercent || 10))),
      presetId: preset.id,
    });
  };

  const updateTitle = (newTitle: string) => {
    onUpdate({ ...item, title: newTitle });
  };

  return (
    <div className="bg-zinc-950 border-b border-zinc-900 p-3 flex flex-col gap-3">
      {/* Title Editor */}
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-1 px-1">
          <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">
            Run Sheet Item Name
          </span>
          {isDefaultItemTitle(item.title) && (
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.6)]"
            />
          )}
        </div>
        <Tooltip
          variant="info"
          placement="bottom"
          content={
            isDefaultItemTitle(item.title)
              ? 'Give this item a clear name so it\u2019s easy to find later \u2014 e.g. \u201CWelcome\u201D, \u201CSermon \u2014 Title\u201D, \u201CClosing Prayer\u201D.'
              : 'Click to rename this item. A clear name makes your Run Sheet easier to scan.'
          }
        >
          <input
            type="text"
            value={item.title}
            onChange={(e) => updateTitle(e.target.value)}
            title={
              isDefaultItemTitle(item.title)
                ? 'Rename this item \u2014 e.g. \u201CWelcome\u201D, \u201CSermon \u2014 Title\u201D'
                : 'Rename this item'
            }
            aria-label="Run Sheet item name"
            data-testid="item-editor-title-input"
            className={`bg-zinc-900 text-lg font-bold text-zinc-200 focus:outline-none border w-full px-3 py-1.5 rounded-sm placeholder-zinc-700 transition-colors focus:border-blue-600 ${
              isDefaultItemTitle(item.title)
                ? 'border-amber-500/40 focus:border-amber-400'
                : 'border-zinc-800'
            }`}
            placeholder="Item Title — e.g. Welcome, Sermon, Closing Prayer"
          />
        </Tooltip>
      </div>

      {/* Theme Controls Bar */}
      <div className="flex items-center gap-6 overflow-x-auto pb-1">
        
        {/* Font Size */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Size</span>
          <div className="flex bg-zinc-900 rounded-sm border border-zinc-800 p-0.5">
             {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                <button 
                  key={size}
                  onClick={() => updateTheme({ fontSize: size })}
                  className={`px-2 py-0.5 text-[10px] rounded-sm font-medium transition-colors ${item.theme.fontSize === size ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title={size}
                >
                  {size === 'small' ? 'SM' : size === 'medium' ? 'MD' : size === 'large' ? 'LG' : 'XL'}
                </button>
             ))}
          </div>
        </div>

        {/* Font Family */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Typeface</span>
          <div className="flex bg-zinc-900 rounded-sm border border-zinc-800 p-0.5">
             <button 
               onClick={() => updateTheme({ fontFamily: 'sans-serif' })}
               className={`px-3 py-0.5 text-[10px] rounded-sm font-medium transition-colors ${item.theme.fontFamily === 'sans-serif' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Sans
             </button>
             <button 
               onClick={() => updateTheme({ fontFamily: 'serif' })}
               className={`px-3 py-0.5 text-[10px] rounded-sm font-medium transition-colors ${item.theme.fontFamily === 'serif' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Serif
             </button>
          </div>
        </div>

        {/* Background Picker */}
        <div className="flex flex-col gap-1">
           <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Background</span>
           <div className="flex gap-1">
              {DEFAULT_BACKGROUNDS.slice(0, 5).map((url, i) => (
                  <button 
                    key={i}
                    onClick={() => updateTheme({ backgroundUrl: url, mediaType: 'image' })}
                    className={`w-6 h-6 rounded-sm border ${item.theme.backgroundUrl === url ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-800 opacity-60 hover:opacity-100'} bg-cover bg-center transition-all`}
                    style={{ backgroundImage: `url(${url})` }}
                  />
              ))}
              {onOpenLibrary && (
                <button 
                    onClick={onOpenLibrary}
                    className="w-6 h-6 rounded-sm border border-zinc-700 bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-500 transition-all"
                    title="Open Motion Library"
                >
                    <PlusIcon className="w-3 h-3" />
                </button>
              )}
           </div>
        </div>

      </div>

      {/* Smart Background Search */}
      <SmartBgSearch
        onApply={(selection) => {
          if (onApplyQuickBackground) {
            return onApplyQuickBackground(item, selection);
          }
        }}
      />

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(24,24,27,0.82),rgba(10,10,14,0.96))] p-2.5 shadow-[0_14px_28px_rgba(0,0,0,0.2)] sm:grid-cols-2 xl:grid-cols-12">
        <label className="flex items-center gap-2 rounded-lg border border-blue-900/40 bg-blue-950/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300 sm:col-span-2 xl:col-span-2">
          <input
            type="checkbox"
            checked={!!item.timerCue?.enabled}
            onChange={(e) => updateTimerCue({ enabled: e.target.checked })}
            className="accent-blue-600"
          />
          Cue Timer
        </label>
        <div className="min-w-0 sm:col-span-2 xl:col-span-3">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Speaker Preset</div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
            <select
              value={item.timerCue?.presetId || ''}
              onChange={(e) => {
                const nextPresetId = e.target.value || '';
                updateTimerCue({ presetId: nextPresetId });
                if (nextPresetId) applyPreset(nextPresetId);
              }}
              className="min-w-0 rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-2 text-[11px] text-zinc-200 shadow-inner shadow-black/20"
            >
              <option value="">None</option>
              {speakerPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({Math.max(1, Math.round(preset.durationSec / 60))}m)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => applyPreset(item.timerCue?.presetId || '')}
              disabled={!item.timerCue?.presetId}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-[10px] font-bold tracking-[0.12em] text-zinc-200 disabled:opacity-40"
            >
              APPLY
            </button>
          </div>
        </div>
        <div className="xl:col-span-2">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Duration (sec)</div>
          <input
            type="number"
            min={10}
            max={7200}
            value={Math.max(10, Number(item.timerCue?.durationSec || defaultTimerCue.durationSec))}
            onChange={(e) => updateTimerCue({ durationSec: Math.max(10, Math.min(7200, Number(e.target.value) || 10)) })}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-2 text-[11px] text-zinc-200 shadow-inner shadow-black/20"
          />
        </div>
        <div className="min-w-0 sm:col-span-2 xl:col-span-2">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Speaker</div>
          <input
            type="text"
            value={item.timerCue?.speakerName || ''}
            onChange={(e) => updateTimerCue({ speakerName: e.target.value })}
            placeholder="Optional speaker name"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-2 text-[11px] text-zinc-200 shadow-inner shadow-black/20"
          />
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-cyan-900/40 bg-cyan-950/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300 xl:col-span-1">
          <input
            type="checkbox"
            checked={!!item.timerCue?.autoStartNext}
            onChange={(e) => updateTimerCue({ autoStartNext: e.target.checked })}
            className="accent-cyan-600"
          />
          Auto Next
        </label>
        <div className="sm:col-span-2 xl:col-span-2">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Cue Thresholds</div>
          <div className="grid grid-cols-2 gap-1">
            <div className="min-w-0 rounded-lg border border-amber-900/30 bg-amber-950/10 p-2">
              <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-amber-300/80">Amber %</div>
            <input
              type="number"
              min={1}
              max={99}
              value={Math.max(1, Math.min(99, Number(item.timerCue?.amberPercent ?? defaultTimerCue.amberPercent)))}
              onChange={(e) => updateTimerCue({ amberPercent: Math.max(1, Math.min(99, Number(e.target.value) || 25)) })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-1.5 text-[11px] text-zinc-200"
            />
          </div>
            <div className="min-w-0 rounded-lg border border-red-900/30 bg-red-950/10 p-2">
              <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-red-300/80">Red %</div>
            <input
              type="number"
              min={1}
              max={99}
              value={Math.max(1, Math.min(99, Number(item.timerCue?.redPercent ?? defaultTimerCue.redPercent)))}
              onChange={(e) => updateTimerCue({ redPercent: Math.max(1, Math.min(99, Number(e.target.value) || 10)) })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-1.5 text-[11px] text-zinc-200"
            />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
