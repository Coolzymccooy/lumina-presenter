
import React, { useEffect, useMemo, useState } from 'react';
import { ServiceItem, Slide } from '../types';

interface StageDisplayProps {
  currentSlide: Slide | null;
  nextSlide: Slide | null;
  activeItem: ServiceItem | null;
  timerLabel?: string;
  timerDisplay?: string;
  timerMode?: 'COUNTDOWN' | 'ELAPSED';
  isTimerOvertime?: boolean;
  profile?: 'classic' | 'compact' | 'high_contrast';
}

export const StageDisplay: React.FC<StageDisplayProps> = ({ currentSlide, nextSlide, activeItem, timerLabel = 'Service Timer', timerDisplay = '00:00', timerMode = 'COUNTDOWN', isTimerOvertime = false, profile = 'classic' }) => {
  const [time, setTime] = useState(new Date());
  const clockFormatter = useMemo(
    () => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }),
    []
  );

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const compact = profile === 'compact';
  const highContrast = profile === 'high_contrast';
  const currentTitle = typeof activeItem?.title === 'string' && activeItem.title.trim() ? activeItem.title : 'Waiting for Service...';
  const currentText = typeof currentSlide?.content === 'string' && currentSlide.content.trim() ? currentSlide.content : 'Blackout';
  const nextText = typeof nextSlide?.content === 'string' && nextSlide.content.trim() ? nextSlide.content : 'End of Item';
  const safeTimerDisplay = typeof timerDisplay === 'string' && timerDisplay.trim() ? timerDisplay : '00:00';

  return (
    <div className={`h-screen w-screen text-white p-8 grid grid-rows-[auto_1fr_1fr] gap-8 font-sans ${highContrast ? 'bg-black' : 'bg-black'}`}>
      {/* Top Bar: Clock & Item Title */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-4 gap-6">
        <h1 className={`${compact ? 'text-2xl' : 'text-4xl'} font-bold ${highContrast ? 'text-white' : 'text-gray-400'} truncate max-w-2xl`}>
          {currentTitle}
        </h1>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-bold">{timerLabel} ({timerMode})</div>
            <div className={`${compact ? 'text-3xl' : 'text-4xl'} font-mono font-bold ${isTimerOvertime ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>{safeTimerDisplay}</div>
            {isTimerOvertime && <div className="text-[10px] text-red-400 font-bold tracking-wider">OVERTIME</div>}
          </div>
          <div className={`${compact ? 'text-4xl' : 'text-6xl'} font-mono font-bold text-yellow-500`}>
            {clockFormatter.format(time)}
          </div>
        </div>
      </div>

      {/* Current Slide (Main Focus) */}
      <div className="flex flex-col justify-center">
        <span className="text-sm font-bold text-green-500 uppercase tracking-widest mb-2">CURRENT</span>
        <div className={`${compact ? 'text-5xl' : 'text-7xl'} font-bold leading-tight text-white whitespace-pre-wrap`}>
          {currentText}
        </div>
      </div>

      {/* Next Slide (Preview) */}
      <div className={`flex flex-col justify-start ${highContrast ? 'bg-black border-white/30' : 'bg-gray-900/50 border-gray-800'} p-6 rounded-xl border`}>
        <span className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-2">NEXT</span>
        <div className={`${compact ? 'text-3xl' : 'text-4xl'} font-medium ${highContrast ? 'text-white' : 'text-gray-400'} leading-snug whitespace-pre-wrap opacity-70`}>
          {nextText}
        </div>
      </div>
    </div>
  );
};
