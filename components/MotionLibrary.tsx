import React, { useEffect, useState } from 'react';
import { PlayIcon } from './Icons';

const MOCK_MOTION_ASSETS = [
  { id: 'mock-1', name: 'Moving Oceans', thumb: 'https://images.pexels.com/videos/854936/free-video-854936.jpeg?auto=compress&cs=tinysrgb&w=800', url: 'https://videos.pexels.com/video-files/854936/854936-hd_1920_1080_25fps.mp4' },
  { id: 'mock-2', name: 'Abstract Clouds', thumb: 'https://images.pexels.com/videos/2325443/free-video-2325443.jpeg?auto=compress&cs=tinysrgb&w=800', url: 'https://videos.pexels.com/video-files/2325443/2325443-hd_1920_1080_24fps.mp4' },
];

interface MotionAsset {
  id: string;
  name: string;
  thumb: string;
  url: string;
}

interface MotionLibraryProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export const MotionLibrary: React.FC<MotionLibraryProps> = ({ onSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState<'mock' | 'pexels'>('mock');
  const [assets, setAssets] = useState<MotionAsset[]>(MOCK_MOTION_ASSETS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPexels = async () => {
      if (activeTab !== 'pexels') {
        setAssets(MOCK_MOTION_ASSETS);
        return;
      }

      setLoading(true);
      const key = import.meta.env.VITE_PEXELS_API_KEY as string | undefined;
      if (!key) {
        setAssets(MOCK_MOTION_ASSETS);
        setLoading(false);
        return;
      }

      try {
        const query = encodeURIComponent('abstract worship background 4k loop');
        const res = await fetch(`https://api.pexels.com/videos/search?query=${query}&per_page=12&orientation=landscape`, {
          headers: { Authorization: key },
        });
        const data = await res.json();
        const parsed: MotionAsset[] = (data.videos || []).map((video: any) => ({
          id: `pexels-${video.id}`,
          name: video.user?.name || `Pexels ${video.id}`,
          thumb: video.image,
          url: (video.video_files || []).find((f: any) => f.quality === 'hd' || f.width >= 1920)?.link || video.video_files?.[0]?.link,
        })).filter((item: MotionAsset) => !!item.url);

        setAssets(parsed.length ? parsed : MOCK_MOTION_ASSETS);
      } catch (error) {
        console.error('Failed to fetch Pexels videos', error);
        setAssets(MOCK_MOTION_ASSETS);
      } finally {
        setLoading(false);
      }
    };

    fetchPexels();
  }, [activeTab]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 p-6">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg h-full overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Motion Library</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <div className="p-4 border-b border-zinc-900 flex gap-2">
          <button onClick={() => setActiveTab('mock')} className={`px-3 py-1 text-xs rounded ${activeTab === 'mock' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Mock Presets</button>
          <button onClick={() => setActiveTab('pexels')} className={`px-3 py-1 text-xs rounded ${activeTab === 'pexels' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>Pexels Motion</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? <div className="text-zinc-400 text-xs">Loading Pexels videos...</div> : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {assets.map((motion) => (
                <div key={motion.id} className="group relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-purple-500 transition-all cursor-pointer" onClick={() => onSelect(motion.url)}>
                  <img src={motion.thumb} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <PlayIcon className="w-8 h-8 text-white drop-shadow-lg" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <span className="text-[10px] font-bold text-white truncate">{motion.name}</span>
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
