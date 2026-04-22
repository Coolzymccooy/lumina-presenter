import React from 'react';
import { DEFAULT_BACKGROUNDS, LUMINA_MOTION_BACKGROUNDS } from '../../constants';
import type { ServiceItem, Slide } from '../../types';
import type { QuickBackgroundSelection } from '../ItemEditorPanel';
import { MotionCanvas } from '../MotionCanvas';
import { XIcon } from '../Icons';
import { searchPexelsMotion, type RemoteMotionAsset } from '../../services/serverApi';

type BackgroundScope = 'slide' | 'item';
type BackgroundTab = 'quick' | 'lumina' | 'pexels' | 'saved';

interface BuilderBackgroundDrawerProps {
  item: ServiceItem | null;
  slide: Slide | null;
  onClose: () => void;
  onApplyToItem: (item: ServiceItem, selection: QuickBackgroundSelection) => Promise<void> | void;
  onApplyToSlide: (selection: QuickBackgroundSelection) => Promise<void> | void;
  onOpenLibrary: () => void;
}

const QUICK_PRESETS = [
  { label: 'Worship', query: 'worship background' },
  { label: 'Prayer', query: 'prayer light background' },
  { label: 'Sermon', query: 'sermon clean background' },
  { label: 'Celebration', query: 'celebration worship background' },
  { label: 'Nature', query: 'nature sky background' },
  { label: 'Abstract', query: 'abstract light background' },
];

const imageSelection = (url: string, title: string, category = 'Quick'): QuickBackgroundSelection => ({
  url,
  thumb: url,
  mediaType: 'image',
  provider: 'lumina',
  category,
  title,
  sourceUrl: url,
});

export const BuilderBackgroundDrawer: React.FC<BuilderBackgroundDrawerProps> = ({
  item,
  slide,
  onClose,
  onApplyToItem,
  onApplyToSlide,
  onOpenLibrary,
}) => {
  const [tab, setTab] = React.useState<BackgroundTab>('quick');
  const [scope, setScope] = React.useState<BackgroundScope>('slide');
  const [query, setQuery] = React.useState('worship background');
  const [results, setResults] = React.useState<RemoteMotionAsset[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [applyingKey, setApplyingKey] = React.useState<string | null>(null);
  const [hoveredMotionId, setHoveredMotionId] = React.useState<string | null>(null);

  const applySelection = React.useCallback(async (selection: QuickBackgroundSelection, key: string) => {
    if (!item || applyingKey) return;
    setApplyingKey(key);
    try {
      if (scope === 'item') {
        await onApplyToItem(item, selection);
      } else {
        await onApplyToSlide(selection);
      }
    } finally {
      setApplyingKey(null);
    }
  }, [applyingKey, item, onApplyToItem, onApplyToSlide, scope]);

  const runSearch = React.useCallback(async (nextQuery = query) => {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const response = await searchPexelsMotion(trimmed, 10);
      const assets = response?.assets || [];
      setResults(assets);
      if (!assets.length) setError('No backgrounds found.');
    } catch {
      setError('Search failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const applyRemoteAsset = (asset: RemoteMotionAsset) => applySelection({
    url: asset.url,
    thumb: asset.thumb,
    mediaType: asset.mediaType,
    provider: asset.provider,
    category: query || 'Pexels',
    title: asset.name,
    sourceUrl: asset.url,
  }, asset.id);

  const currentBackgrounds = [
    slide?.backgroundUrl ? { title: 'This Slide', url: slide.backgroundUrl, mediaType: slide.mediaType || 'image' } : null,
    item?.theme?.backgroundUrl ? { title: 'Item Theme', url: item.theme.backgroundUrl, mediaType: item.theme.mediaType || 'image' } : null,
  ].filter(Boolean) as Array<{ title: string; url: string; mediaType: QuickBackgroundSelection['mediaType'] }>;

  return (
    <div data-testid="builder-background-drawer" className="flex h-full min-h-0 flex-col border-t border-zinc-900 bg-[#07080d]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-900 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">Backgrounds</span>
          {(['quick', 'lumina', 'pexels', 'saved'] as BackgroundTab[]).map((entry) => (
            <button
              key={entry}
              type="button"
              data-testid={`builder-background-tab-${entry}`}
              onClick={() => setTab(entry)}
              className={`h-7 rounded-lg border px-2.5 text-[9px] font-black uppercase tracking-[0.14em] ${
                tab === entry
                  ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {entry}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-7 overflow-hidden rounded-lg border border-zinc-800 bg-black">
            {(['slide', 'item'] as BackgroundScope[]).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setScope(entry)}
                className={`px-2.5 text-[9px] font-black uppercase tracking-[0.14em] ${
                  scope === entry ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {entry}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-white"
            aria-label="Close background drawer"
            title="Close"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
        {tab === 'quick' && (
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-lg border border-zinc-800 bg-black/35 p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">Fast Search</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setQuery(preset.query);
                      setTab('pexels');
                      void runSearch(preset.query);
                    }}
                    className="h-7 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400 hover:border-cyan-700 hover:text-cyan-200"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onOpenLibrary}
                className="mt-3 h-8 w-full rounded-lg border border-blue-800/70 bg-blue-950/35 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-blue-200 hover:border-blue-500"
              >
                Motion Library
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                {DEFAULT_BACKGROUNDS.slice(0, 18).map((url, index) => (
                <button
                  key={url}
                  type="button"
                  data-testid={`builder-background-static-${index}`}
                  onClick={() => void applySelection(imageSelection(url, `Background ${index + 1}`), url)}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-left hover:border-cyan-600"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {applyingKey === url ? 'Applying' : `Use ${scope}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'lumina' && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            {LUMINA_MOTION_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => void applySelection({
                  url: bg.url,
                  thumb: bg.poster,
                  mediaType: 'motion',
                  provider: 'lumina',
                  category: 'Lumina',
                  title: bg.name,
                  sourceUrl: bg.url,
                }, bg.id)}
                onMouseEnter={() => setHoveredMotionId(bg.id)}
                onMouseLeave={() => setHoveredMotionId((current) => (current === bg.id ? null : current))}
                className="group relative aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-left hover:border-purple-500"
              >
                {hoveredMotionId === bg.id ? (
                  <MotionCanvas motionUrl={bg.url} isPlaying pauseWhenOffscreen />
                ) : (
                  <img src={bg.poster} alt={bg.name} className="h-full w-full object-cover" loading="lazy" />
                )}
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white">
                  {applyingKey === bg.id ? 'Applying' : bg.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === 'pexels' && (
          <div className="space-y-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void runSearch();
              }}
              className="flex max-w-xl items-center gap-2"
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-black px-3 text-sm text-zinc-100 outline-none focus:border-cyan-500"
                placeholder="Search Pexels backgrounds..."
              />
              <button type="submit" className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200 hover:border-zinc-500">
                Search
              </button>
            </form>
            {loading && <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Searching...</div>}
            {error && !loading && <div className="text-xs font-semibold text-amber-300">{error}</div>}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
              {results.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => void applyRemoteAsset(asset)}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-left hover:border-cyan-600"
                >
                  <img src={asset.thumb} alt={asset.name} className="h-full w-full object-cover" loading="lazy" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white">
                    {applyingKey === asset.id ? 'Applying' : asset.name}
                  </span>
                  <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] text-zinc-300">
                    {asset.mediaType}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'saved' && (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {currentBackgrounds.map((entry) => (
                <button
                  key={`${entry.title}-${entry.url}`}
                  type="button"
                  onClick={() => void applySelection({
                    url: entry.url,
                    thumb: entry.url,
                    mediaType: entry.mediaType,
                    provider: 'current',
                    category: 'Saved',
                    title: entry.title,
                    sourceUrl: entry.url,
                  }, `${entry.title}-${entry.url}`)}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-left hover:border-cyan-600"
                >
                  {entry.mediaType === 'motion' ? (
                    <MotionCanvas motionUrl={entry.url} isPlaying pauseWhenOffscreen />
                  ) : (
                    <img src={entry.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white">
                    {entry.title}
                  </span>
                </button>
              ))}
              {!currentBackgrounds.length && (
                <div className="rounded-lg border border-dashed border-zinc-800 p-5 text-center text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
                  No current backgrounds
                </div>
              )}
            </div>
            <div className="rounded-lg border border-zinc-800 bg-black/35 p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">Library</div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Use the full motion library for saved loops, alpha loops, and provider-specific browsing.
              </p>
              <button
                type="button"
                onClick={onOpenLibrary}
                className="mt-3 h-8 w-full rounded-lg border border-blue-800/70 bg-blue-950/35 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-blue-200 hover:border-blue-500"
              >
                Open Library
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
