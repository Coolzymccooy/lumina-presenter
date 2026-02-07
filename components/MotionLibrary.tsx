
import React from 'react';
import { PlayIcon, PlusIcon } from './Icons';

const MOTION_ASSETS = [
  // Reliable direct MP4 links from Pixabay (High Quality)
  { id: 'm1', name: 'Blue Particles', thumb: 'https://cdn.pixabay.com/vimeo/328940142/particle-22929.jpg?width=640&hash=d128e46979267152011116279313361110196726', url: 'https://cdn.pixabay.com/video/2019/04/06/22929-328940142_small.mp4' },
  { id: 'm2', name: 'Golden Bokeh', thumb: 'https://cdn.pixabay.com/vimeo/345265633/bokeh-24908.jpg?width=640&hash=f5147517112211567115161821102910', url: 'https://cdn.pixabay.com/video/2019/06/27/24908-345265633_small.mp4' },
  { id: 'm3', name: 'Abstract Lines', thumb: 'https://cdn.pixabay.com/vimeo/315181602/abstract-21179.jpg?width=640&hash=1237891238917238917398', url: 'https://cdn.pixabay.com/video/2019/02/05/21179-315181602_small.mp4' },
  { id: 'm4', name: 'Cloud Timelapse', thumb: 'https://cdn.pixabay.com/vimeo/150824040/clouds-1748.jpg?width=640&hash=217389127398127389', url: 'https://cdn.pixabay.com/video/2015/12/31/1748-150824040_small.mp4' },
  { id: 'm5', name: 'Neon Tunnel', thumb: 'https://cdn.pixabay.com/vimeo/329596677/blue-23232.jpg?width=640&hash=02577626334551130172931163456782', url: 'https://cdn.pixabay.com/video/2019/04/10/23232-329596677_small.mp4' },
  { id: 'm6', name: 'Worship Hands', thumb: 'https://cdn.pixabay.com/vimeo/345863914/worship-24976.jpg?width=640&hash=2138971298371298', url: 'https://cdn.pixabay.com/video/2019/06/30/24976-345863914_small.mp4' },
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
