
import React, { useEffect, useState } from 'react';
import { ServiceItem, Slide } from '../types';

interface StageDisplayProps {
  currentSlide: Slide | null;
  nextSlide: Slide | null;
  activeItem: ServiceItem | null;
  timerLabel?: string;
  timerDisplay?: string;
  timerMode?: 'COUNTDOWN' | 'ELAPSED';
}

export const StageDisplay: React.FC<StageDisplayProps> = ({ currentSlide, nextSlide, activeItem, timerLabel = 'Service Timer', timerDisplay = '00:00', timerMode = 'COUNTDOWN' }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-screen w-screen bg-black text-white p-8 grid grid-rows-[auto_1fr_1fr] gap-8 font-sans">
      {/* Top Bar: Clock & Item Title */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-4 gap-6">
        <h1 className="text-4xl font-bold text-gray-400 truncate max-w-2xl">
          {activeItem?.title || "Waiting for Service..."}
        </h1>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-bold">{timerLabel} ({timerMode})</div>
            <div className="text-4xl font-mono font-bold text-cyan-300">{timerDisplay}</div>
          </div>
          <div className="text-6xl font-mono font-bold text-yellow-500">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Current Slide (Main Focus) */}
      <div className="flex flex-col justify-center">
        <span className="text-sm font-bold text-green-500 uppercase tracking-widest mb-2">CURRENT</span>
        <div className="text-7xl font-bold leading-tight text-white whitespace-pre-wrap">
          {currentSlide?.content || "Blackout"}
        </div>
      </div>

      {/* Next Slide (Preview) */}
      <div className="flex flex-col justify-start bg-gray-900/50 p-6 rounded-xl border border-gray-800">
        <span className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-2">NEXT</span>
        <div className="text-4xl font-medium text-gray-400 leading-snug truncate whitespace-pre-wrap opacity-70">
          {nextSlide?.content || "End of Item"}
        </div>
      </div>
    </div>
  );
};
