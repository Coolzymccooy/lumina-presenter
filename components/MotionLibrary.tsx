import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PlayIcon } from './Icons';
import { DEFAULT_BACKGROUNDS, VIDEO_BACKGROUNDS } from '../constants';
import { MediaType } from '../types';
import { searchPexelsMotion } from '../services/serverApi';
import { getCachedMedia, getMedia, listSavedBackgrounds } from '../services/localMedia';

type MotionTab = 'curated' | 'stills' | 'alpha' | 'pexels' | 'pixabay' | 'saved';

export interface MotionLibrarySelection {
  url: string;
  thumb: string;
  name: string;
  mediaType: MediaType;
  provider: string;
  attribution?: string;
  category?: string;
  sourceUrl?: string;
  /** When set, apply as alpha-channel overlay (WebM VP9) instead of replacing background */
  alphaOverlayUrl?: string;
}

interface MotionAsset extends MotionLibrarySelection {
  id: string;
}

interface MotionLibraryProps {
  onSelect: (asset: MotionLibrarySelection) => void;
  onClose: () => void;
}

const CURATED_VIDEO_ASSETS: MotionAsset[] = VIDEO_BACKGROUNDS.map((url, idx) => ({
  id: `curated-video-${idx + 1}-${url.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`,
  name: url.startsWith('/assets/')
    ? `Local Motion ${idx + 1}`
    : `Motion Loop ${idx + 1}`,
  thumb: DEFAULT_BACKGROUNDS[idx % DEFAULT_BACKGROUNDS.length],
  url,
  mediaType: 'video' as MediaType,
  provider: 'curated',
  category: 'Built-in',
  attribution: url.startsWith('/assets/') ? 'Local library' : 'Built-in',
}))
  .filter((asset) => /\.(mp4|webm|mov)(\?|$)/i.test(asset.url));

const ALPHA_VIDEO_ASSETS: MotionAsset[] = VIDEO_BACKGROUNDS
  .filter((url) => /alpha/i.test(url) || /-alpha\.webm(\?|$)/i.test(url))
  .map((url, idx) => ({
    id: `alpha-${idx + 1}-${url.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`,
    name: `Alpha Loop ${idx + 1}`,
    thumb: DEFAULT_BACKGROUNDS[idx % DEFAULT_BACKGROUNDS.length],
    url,
    mediaType: 'video-alpha' as MediaType,
    provider: 'alpha',
    category: 'Overlay',
    attribution: 'Alpha channel (WebM VP9)',
  }));

const CURATED_STILL_ASSETS: MotionAsset[] = DEFAULT_BACKGROUNDS.map((url, idx) => ({
  id: `curated-still-${idx + 1}`,
  name: `Safe Gradient ${idx + 1}`,
  thumb: url,
  url,
  mediaType: 'image',
  provider: 'stills',
  category: 'Built-in',
  attribution: 'Built-in',
}));

const resolvePrettyCategory = (value: string) => (
  String(value || '').trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1).toLowerCase())
    .join(' ') || 'Used'
);

const MotionTile: React.FC<{ motion: MotionAsset; onSelect: (asset: MotionAsset) => void }> = ({ motion, onSelect }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => (
    motion.url.startsWith('local://') ? (getCachedMedia(motion.url) || '') : motion.url
  ));
  const [resolvedThumb, setResolvedThumb] = useState<string>(() => (
    motion.thumb.startsWith('local://') ? (getCachedMedia(motion.thumb) || '') : motion.thumb
  ));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!motion.url.startsWith('local://')) {
        setResolvedUrl(motion.url);
        return;
      }
      const cached = getCachedMedia(motion.url);
      if (cached) {
        setResolvedUrl(cached);
        return;
      }
      const resolved = await getMedia(motion.url);
      if (!cancelled) setResolvedUrl(resolved || '');
    };
    void run();
    return () => { cancelled = true; };
  }, [motion.url]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!motion.thumb.startsWith('local://')) {
        setResolvedThumb(motion.thumb);
        return;
      }
      const cached = getCachedMedia(motion.thumb);
      if (cached) {
        setResolvedThumb(cached);
        return;
      }
      const resolved = await getMedia(motion.thumb);
      if (!cancelled) setResolvedThumb(resolved || '');
    };
    void run();
    return () => { cancelled = true; };
  }, [motion.thumb]);

  const poster = resolvedThumb || DEFAULT_BACKGROUNDS[0];
  const playableUrl = resolvedUrl || motion.url;

  return (
    <div
      className="group relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-blue-500 transition-all cursor-pointer"
      onClick={() => onSelect(motion)}
    >
      {motion.mediaType === 'video' && playableUrl && !playableUrl.startsWith('local://') ? (
        <video
          src={playableUrl}
          poster={poster}
          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={poster}
          loading="lazy"
          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
          alt={motion.name}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
        <PlayIcon className="w-8 h-8 text-white drop-shadow-lg" />
      </div>
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <div className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/60 text-zinc-200 border border-zinc-700">
          {motion.provider}
        </div>
        {motion.category && (
          <div className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-950/65 text-blue-200 border border-blue-700/40">
            {motion.category}
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
        <span className="block text-[10px] font-bold text-white truncate">{motion.name}</span>
        {motion.attribution && <span className="block text-[9px] text-zinc-400 truncate">{motion.attribution}</span>}
      </div>
    </div>
  );
};

export const MotionLibrary: React.FC<MotionLibraryProps> = ({ onSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState<MotionTab>('curated');
  const [queryInput, setQueryInput] = useState('worship background');
  const [debouncedQuery, setDebouncedQuery] = useState('worship background');
  const [assets, setAssets] = useState<MotionAsset[]>(CURATED_VIDEO_ASSETS);
  const [savedAssets, setSavedAssets] = useState<MotionAsset[]>([]);
  const [savedCategoryFilter, setSavedCategoryFilter] = useState('all');
  const [savedProviderFilter, setSavedProviderFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cacheRef = useRef<Record<string, MotionAsset[]>>({});

  const pixabayKey = (import.meta.env.VITE_PIXABAY_API_KEY as string | undefined)?.trim();

  const providerStatus = useMemo(() => {
    if (activeTab === 'pexels') return '';
    if (activeTab === 'pixabay') return pixabayKey ? '' : 'Missing VITE_PIXABAY_API_KEY in the frontend build environment';
    return '';
  }, [activeTab, pixabayKey]);

  const savedCategories = useMemo(
    () => Array.from(new Set(savedAssets.map((asset) => resolvePrettyCategory(asset.category || 'Used')))).sort(),
    [savedAssets],
  );
  const savedProviders = useMemo(
    () => Array.from(new Set(savedAssets.map((asset) => asset.provider))).sort(),
    [savedAssets],
  );

  const visibleAssets = useMemo(() => {
    if (activeTab !== 'saved') return assets;
    return savedAssets.filter((asset) => {
      if (savedCategoryFilter !== 'all' && resolvePrettyCategory(asset.category || 'Used') !== savedCategoryFilter) return false;
      if (savedProviderFilter !== 'all' && asset.provider !== savedProviderFilter) return false;
      return true;
    });
  }, [activeTab, assets, savedAssets, savedCategoryFilter, savedProviderFilter]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQuery(queryInput.trim() || 'worship background');
    }, 380);
    return () => window.clearTimeout(id);
  }, [queryInput]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const requestTimeout = window.setTimeout(() => controller.abort(), 10000);

    const run = async () => {
      setError('');

      if (activeTab === 'curated') {
        setLoading(false);
        setAssets(CURATED_VIDEO_ASSETS);
        return;
      }

      if (activeTab === 'stills') {
        setLoading(false);
        setAssets(CURATED_STILL_ASSETS);
        return;
      }

      if (activeTab === 'alpha') {
        setLoading(false);
        setAssets(ALPHA_VIDEO_ASSETS);
        return;
      }

      if (activeTab === 'saved') {
        setLoading(true);
        try {
          const saved = await listSavedBackgrounds();
          if (!cancelled) {
            setSavedAssets(saved.map((asset) => ({
              id: asset.id,
              name: asset.title || asset.name,
              thumb: asset.localUrl,
              url: asset.localUrl,
              mediaType: asset.mediaType,
              provider: asset.provider || 'saved',
              category: resolvePrettyCategory(asset.category || 'Used'),
              attribution: asset.sourceUrl || 'Saved for offline reuse',
              sourceUrl: asset.sourceUrl,
            })));
          }
        } catch (err: any) {
          if (!cancelled) {
            setError(err?.message || 'Failed to load saved backgrounds');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (activeTab === 'pixabay' && !pixabayKey) {
        setLoading(false);
        setAssets(CURATED_VIDEO_ASSETS);
        return;
      }

      const normalizedQuery = debouncedQuery.trim().toLowerCase();
      const cacheKey = `${activeTab}:${normalizedQuery}`;
      const cached = cacheRef.current[cacheKey];
      if (cached && cached.length > 0) {
        setLoading(false);
        setAssets(cached);
        return;
      }

      setLoading(true);
      try {
        if (activeTab === 'pexels') {
          const data = await searchPexelsMotion(debouncedQuery || 'worship background', 12);
          if (!data?.ok) {
            throw new Error(data?.message || data?.error || 'Pexels request failed');
          }
          const parsed: MotionAsset[] = (data.assets || [])
            .map((asset, idx) => ({
              id: asset.id,
              name: asset.name || `Pexels #${idx + 1}`,
              thumb: asset.thumb || DEFAULT_BACKGROUNDS[idx % DEFAULT_BACKGROUNDS.length],
              url: asset.url,
              mediaType: asset.mediaType,
              provider: 'pexels',
              category: resolvePrettyCategory(debouncedQuery || 'Used'),
              attribution: asset.attribution || 'Pexels',
              sourceUrl: asset.url,
            }))
            .filter((item: MotionAsset) => !!item.url);

          if (!cancelled) {
            const next = parsed.length ? parsed : CURATED_VIDEO_ASSETS;
            cacheRef.current[cacheKey] = next;
            setAssets(next);
          }
          return;
        }

        if (activeTab === 'pixabay') {
          const res = await fetch(
            `https://pixabay.com/api/videos/?key=${encodeURIComponent(pixabayKey as string)}&q=${encodeURIComponent(debouncedQuery || 'worship background')}&per_page=12&safesearch=true`,
            { signal: controller.signal }
          );
          if (!res.ok) throw new Error(`Pixabay request failed: ${res.status}`);
          const data = await res.json();
          const parsed: MotionAsset[] = (data?.hits || [])
            .map((hit: any, idx: number) => ({
              id: `pixabay-${hit?.id || idx}`,
              name: hit?.tags || `Pixabay #${hit?.id || idx}`,
              thumb:
                hit?.videos?.tiny?.thumbnail ||
                hit?.videos?.small?.thumbnail ||
                DEFAULT_BACKGROUNDS[idx % DEFAULT_BACKGROUNDS.length],
              url:
                hit?.videos?.large?.url ||
                hit?.videos?.medium?.url ||
                hit?.videos?.small?.url ||
                hit?.videos?.tiny?.url ||
                null,
              mediaType: 'video' as const,
              provider: 'pixabay',
              category: resolvePrettyCategory(debouncedQuery || 'Used'),
              attribution: hit?.pageURL || 'Pixabay',
              sourceUrl:
                hit?.videos?.large?.url ||
                hit?.videos?.medium?.url ||
                hit?.videos?.small?.url ||
                hit?.videos?.tiny?.url ||
                undefined,
            }))
            .filter((item: MotionAsset) => !!item.url);

          if (!cancelled) {
            const next = parsed.length ? parsed : CURATED_VIDEO_ASSETS;
            cacheRef.current[cacheKey] = next;
            setAssets(next);
          }
        }
      } catch (err: any) {
        if (cancelled || err?.name === 'AbortError') {
          return;
        }
        if (!cancelled) {
          setError(err?.message || 'Failed to load motion assets');
          setAssets(CURATED_VIDEO_ASSETS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [activeTab, debouncedQuery, pixabayKey]);

  return (
    <div className="fixed inset-0 bg-black/85 z-[140] p-3 md:p-6 overflow-hidden">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg h-full max-h-full overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Motion Library</h3>
          <button
            onClick={onClose}
            className="h-8 px-3 text-xs font-bold rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-500"
            aria-label="Close motion library"
          >
            Close
          </button>
        </div>

        <div className="p-4 border-b border-zinc-900 flex flex-wrap items-center gap-2">
          <button onClick={() => setActiveTab('curated')} className={`px-3 py-1 text-xs rounded ${activeTab === 'curated' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Default Loops</button>
          <button onClick={() => setActiveTab('stills')} className={`px-3 py-1 text-xs rounded ${activeTab === 'stills' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Safe Stills</button>
          <button onClick={() => setActiveTab('alpha')} className={`px-3 py-1 text-xs rounded ${activeTab === 'alpha' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Alpha Loops</button>
          <button onClick={() => setActiveTab('saved')} className={`px-3 py-1 text-xs rounded ${activeTab === 'saved' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Saved</button>
          <button onClick={() => setActiveTab('pexels')} className={`px-3 py-1 text-xs rounded ${activeTab === 'pexels' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Pexels</button>
          <button onClick={() => setActiveTab('pixabay')} className={`px-3 py-1 text-xs rounded ${activeTab === 'pixabay' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Pixabay</button>
          {activeTab !== 'saved' && (
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search worship, sunrise, abstract..."
              className="w-full md:w-80 md:ml-auto bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200"
            />
          )}
        </div>

        {activeTab === 'saved' && (
          <div className="px-4 py-3 border-b border-zinc-900 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Category</span>
              <button onClick={() => setSavedCategoryFilter('all')} className={`px-2.5 py-1 rounded text-[10px] font-bold ${savedCategoryFilter === 'all' ? 'bg-blue-700 text-white' : 'bg-zinc-900 text-zinc-400'}`}>All</button>
              {savedCategories.map((category) => (
                <button key={category} onClick={() => setSavedCategoryFilter(category)} className={`px-2.5 py-1 rounded text-[10px] font-bold ${savedCategoryFilter === category ? 'bg-blue-700 text-white' : 'bg-zinc-900 text-zinc-400'}`}>{category}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Source</span>
              <button onClick={() => setSavedProviderFilter('all')} className={`px-2.5 py-1 rounded text-[10px] font-bold ${savedProviderFilter === 'all' ? 'bg-cyan-700 text-white' : 'bg-zinc-900 text-zinc-400'}`}>All</button>
              {savedProviders.map((provider) => (
                <button key={provider} onClick={() => setSavedProviderFilter(provider)} className={`px-2.5 py-1 rounded text-[10px] font-bold ${savedProviderFilter === provider ? 'bg-cyan-700 text-white' : 'bg-zinc-900 text-zinc-400'}`}>{provider}</button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-1">
          {providerStatus && <div className="mb-3 text-[11px] text-amber-400 border border-amber-900/50 bg-amber-950/20 px-3 py-2 rounded">{providerStatus}</div>}
          {error && <div className="mb-3 text-[11px] text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2 rounded">{error}</div>}

          {loading ? (
            <div className="text-zinc-400 text-xs">Loading assets...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleAssets.map((motion) => (
                <MotionTile
                  key={motion.id}
                  motion={motion}
                  onSelect={(asset) => onSelect(
                    asset.mediaType === 'video-alpha'
                      ? { ...asset, alphaOverlayUrl: asset.url }
                      : asset
                  )}
                />
              ))}
            </div>
          )}

          {!loading && visibleAssets.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/70 px-4 py-8 text-center">
              <div className="text-sm font-semibold text-zinc-300">No backgrounds in this view yet</div>
              <div className="mt-1 text-xs text-zinc-500">
                Used backgrounds will appear here automatically after they have been projected successfully.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
