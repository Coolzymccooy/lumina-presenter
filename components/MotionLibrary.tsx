import React, { useEffect, useMemo, useState } from 'react';
import { PlayIcon } from './Icons';
import { DEFAULT_BACKGROUNDS, VIDEO_BACKGROUNDS } from '../constants';
import { MediaType } from '../types';

type MotionTab = 'curated' | 'stills' | 'pexels' | 'pixabay';

interface MotionAsset {
  id: string;
  name: string;
  thumb: string;
  url: string;
  mediaType: MediaType;
  provider: 'curated' | 'stills' | 'pexels' | 'pixabay';
  attribution?: string;
}

interface MotionLibraryProps {
  onSelect: (url: string, mediaType?: MediaType) => void;
  onClose: () => void;
}

const CURATED_VIDEO_ASSETS: MotionAsset[] = VIDEO_BACKGROUNDS.map((url, idx) => ({
  id: `curated-video-${idx + 1}`,
  name: `Default Loop ${idx + 1}`,
  thumb: DEFAULT_BACKGROUNDS[idx % DEFAULT_BACKGROUNDS.length],
  url,
  mediaType: 'video',
  provider: 'curated',
  attribution: 'Built-in',
}));

const CURATED_STILL_ASSETS: MotionAsset[] = DEFAULT_BACKGROUNDS.map((url, idx) => ({
  id: `curated-still-${idx + 1}`,
  name: `Safe Gradient ${idx + 1}`,
  thumb: url,
  url,
  mediaType: 'image',
  provider: 'stills',
  attribution: 'Built-in',
}));

const pickBestVideo = (files: any[]): string | null => {
  if (!Array.isArray(files) || !files.length) return null;
  const mp4 = files.filter((f) => String(f?.file_type || '').includes('mp4'));
  const pool = mp4.length ? mp4 : files;
  const sorted = [...pool].sort((a, b) => (Number(b?.width) || 0) - (Number(a?.width) || 0));
  return sorted[0]?.link || sorted[0]?.url || null;
};

export const MotionLibrary: React.FC<MotionLibraryProps> = ({ onSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState<MotionTab>('curated');
  const [query, setQuery] = useState('worship background');
  const [assets, setAssets] = useState<MotionAsset[]>(CURATED_VIDEO_ASSETS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pexelsKey = (import.meta.env.VITE_PEXELS_API_KEY as string | undefined)?.trim();
  const pixabayKey = (import.meta.env.VITE_PIXABAY_API_KEY as string | undefined)?.trim();

  const providerStatus = useMemo(() => {
    if (activeTab === 'pexels') return pexelsKey ? '' : 'Missing VITE_PEXELS_API_KEY in .env.local';
    if (activeTab === 'pixabay') return pixabayKey ? '' : 'Missing VITE_PIXABAY_API_KEY in .env.local';
    return '';
  }, [activeTab, pexelsKey, pixabayKey]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError('');

      if (activeTab === 'curated') {
        setAssets(CURATED_VIDEO_ASSETS);
        return;
      }

      if (activeTab === 'stills') {
        setAssets(CURATED_STILL_ASSETS);
        return;
      }

      if (activeTab === 'pexels' && !pexelsKey) {
        setAssets(CURATED_VIDEO_ASSETS);
        return;
      }

      if (activeTab === 'pixabay' && !pixabayKey) {
        setAssets(CURATED_VIDEO_ASSETS);
        return;
      }

      setLoading(true);
      try {
        if (activeTab === 'pexels') {
          const res = await fetch(
            `https://api.pexels.com/videos/search?query=${encodeURIComponent(query || 'worship background')}&per_page=20&orientation=landscape`,
            { headers: { Authorization: pexelsKey as string } }
          );
          if (!res.ok) throw new Error(`Pexels request failed: ${res.status}`);
          const data = await res.json();
          const parsed: MotionAsset[] = (data?.videos || [])
            .map((video: any, idx: number) => ({
              id: `pexels-${video?.id || idx}`,
              name: video?.user?.name || `Pexels #${video?.id || idx}`,
              thumb: video?.image || DEFAULT_BACKGROUNDS[idx % DEFAULT_BACKGROUNDS.length],
              url: pickBestVideo(video?.video_files || []),
              mediaType: 'video' as const,
              provider: 'pexels' as const,
              attribution: video?.url || 'Pexels',
            }))
            .filter((item: MotionAsset) => !!item.url);

          if (!cancelled) setAssets(parsed.length ? parsed : CURATED_VIDEO_ASSETS);
          return;
        }

        if (activeTab === 'pixabay') {
          const res = await fetch(
            `https://pixabay.com/api/videos/?key=${encodeURIComponent(pixabayKey as string)}&q=${encodeURIComponent(query || 'worship background')}&per_page=20&safesearch=true`,
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
              provider: 'pixabay' as const,
              attribution: hit?.pageURL || 'Pixabay',
            }))
            .filter((item: MotionAsset) => !!item.url);

          if (!cancelled) setAssets(parsed.length ? parsed : CURATED_VIDEO_ASSETS);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load motion assets');
          setAssets(CURATED_VIDEO_ASSETS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, query, pexelsKey, pixabayKey]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 p-6">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg h-full overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Motion Library</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">X</button>
        </div>

        <div className="p-4 border-b border-zinc-900 flex flex-wrap gap-2">
          <button onClick={() => setActiveTab('curated')} className={`px-3 py-1 text-xs rounded ${activeTab === 'curated' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Default Loops</button>
          <button onClick={() => setActiveTab('stills')} className={`px-3 py-1 text-xs rounded ${activeTab === 'stills' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Safe Stills</button>
          <button onClick={() => setActiveTab('pexels')} className={`px-3 py-1 text-xs rounded ${activeTab === 'pexels' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Pexels</button>
          <button onClick={() => setActiveTab('pixabay')} className={`px-3 py-1 text-xs rounded ${activeTab === 'pixabay' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Pixabay</button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search worship, sunrise, abstract..."
            className="ml-auto min-w-72 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200"
          />
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {providerStatus && <div className="mb-3 text-[11px] text-amber-400 border border-amber-900/50 bg-amber-950/20 px-3 py-2 rounded">{providerStatus}</div>}
          {error && <div className="mb-3 text-[11px] text-red-400 border border-red-900/50 bg-red-950/20 px-3 py-2 rounded">{error}</div>}

          {loading ? (
            <div className="text-zinc-400 text-xs">Loading assets...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {assets.map((motion) => (
                <div
                  key={motion.id}
                  className="group relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-blue-500 transition-all cursor-pointer"
                  onClick={() => onSelect(motion.url, motion.mediaType)}
                >
                  <img src={motion.thumb} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <PlayIcon className="w-8 h-8 text-white drop-shadow-lg" />
                  </div>
                  <div className="absolute top-2 left-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/60 text-zinc-200 border border-zinc-700">
                    {motion.provider}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                    <span className="block text-[10px] font-bold text-white truncate">{motion.name}</span>
                    {motion.attribution && <span className="block text-[9px] text-zinc-400 truncate">{motion.attribution}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
