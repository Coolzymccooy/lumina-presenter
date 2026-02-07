
import React from 'react';
import { PlayIcon, PlusIcon } from './Icons';

// High-quality, royalty-free motion loops (Pixabay/Pexels)
const MOTION_ASSETS = [
  { id: 'm1', name: 'Nebula Clouds', thumb: 'https://images.pexels.com/videos/3125866/free-video-3125866.jpg?auto=compress&cs=tinysrgb&dpr=1&w=500', url: 'https://player.vimeo.com/external/3125866.sd.mp4?s=a709292850320743950106297379237070f19619&profile_id=164&oauth2_token_id=57447761' },
  { id: 'm2', name: 'Ocean Waves', thumb: 'https://images.pexels.com/videos/854226/free-video-854226.jpg?auto=compress&cs=tinysrgb&dpr=1&w=500', url: 'https://player.vimeo.com/external/854226.sd.mp4?s=f14d952002722026330925232709272302325327&profile_id=164&oauth2_token_id=57447761' },
  { id: 'm3', name: 'Abstract Particles', thumb: 'https://cdn.pixabay.com/vimeo/328940142/particle-22929.jpg?width=640&hash=d128e46979267152011116279313361110196726', url: 'https://cdn.pixabay.com/video/2019/04/06/22929-328940142_small.mp4' },
  { id: 'm4', name: 'Blue Tunnel', thumb: 'https://cdn.pixabay.com/vimeo/329596677/blue-23232.jpg?width=640&hash=02577626334551130172931163456782', url: 'https://cdn.pixabay.com/video/2019/04/10/23232-329596677_small.mp4' },
];

interface MotionLibraryProps {
  onSelect: (url: string) => void;
}

export const MotionLibrary: React.FC<MotionLibraryProps> = ({ onSelect }) => {
  return (
    <div className="p-4 bg-zinc-950 h-full">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Motion Backgrounds</h3>
      <div className="grid grid-cols-2 gap-4">
        {MOTION_ASSETS.map((motion) => (
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
      <div className="mt-6 p-4 border border-dashed border-zinc-800 rounded-lg text-center">
        <p className="text-[10px] text-zinc-500 mb-2">Want more?</p>
        <button className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded text-xs font-bold hover:bg-zinc-700 transition-all">Browse Pexels Library</button>
      </div>
    </div>
  );
};
