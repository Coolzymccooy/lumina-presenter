
import React, { useEffect, useMemo, useState } from 'react';
import { ServiceItem, Slide } from '../types';
import { getCachedMedia, getMedia } from '../services/localMedia';

interface StageDisplayProps {
  currentSlide: Slide | null;
  nextSlide: Slide | null;
  activeItem: ServiceItem | null;
  timerLabel?: string;
  timerDisplay?: string;
  timerMode?: 'COUNTDOWN' | 'ELAPSED';
  isTimerOvertime?: boolean;
  profile?: 'classic' | 'compact' | 'high_contrast';
  audienceOverlay?: any;
}

export const StageDisplay: React.FC<StageDisplayProps> = ({ currentSlide, nextSlide, activeItem, timerLabel = 'Service Timer', timerDisplay = '00:00', timerMode = 'COUNTDOWN', isTimerOvertime = false, profile = 'classic', audienceOverlay }) => {
  const [time, setTime] = useState(new Date());
  const getPreferredBackground = (slide: Slide | null) => (
    (typeof slide?.backgroundUrl === 'string' && slide.backgroundUrl.trim())
    || (typeof activeItem?.theme?.backgroundUrl === 'string' && activeItem.theme.backgroundUrl.trim())
    || ''
  );
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string>('');
  const [nextMediaUrl, setNextMediaUrl] = useState<string>('');
  const clockFormatter = useMemo(
    () => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }),
    []
  );

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const raw = getPreferredBackground(currentSlide);
      if (!raw) {
        setCurrentMediaUrl('');
        return;
      }
      if (!raw.startsWith('local://')) {
        setCurrentMediaUrl(raw);
        return;
      }
      const cached = getCachedMedia(raw);
      if (cached) {
        setCurrentMediaUrl(cached);
        return;
      }
      try {
        const resolved = await getMedia(raw);
        if (!cancelled) setCurrentMediaUrl(resolved || '');
      } catch {
        if (!cancelled) setCurrentMediaUrl('');
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [currentSlide?.id, currentSlide?.backgroundUrl, activeItem?.theme?.backgroundUrl]);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const raw = getPreferredBackground(nextSlide);
      if (!raw) {
        setNextMediaUrl('');
        return;
      }
      if (!raw.startsWith('local://')) {
        setNextMediaUrl(raw);
        return;
      }
      const cached = getCachedMedia(raw);
      if (cached) {
        setNextMediaUrl(cached);
        return;
      }
      try {
        const resolved = await getMedia(raw);
        if (!cancelled) setNextMediaUrl(resolved || '');
      } catch {
        if (!cancelled) setNextMediaUrl('');
      }
    };
    void resolve();
    return () => { cancelled = true; };
  }, [nextSlide?.id, nextSlide?.backgroundUrl, activeItem?.theme?.backgroundUrl]);

  const compact = profile === 'compact';
  const highContrast = profile === 'high_contrast';
  const currentTitle = typeof activeItem?.title === 'string' && activeItem.title.trim() ? activeItem.title : 'Waiting for Service...';
  const currentText = typeof currentSlide?.content === 'string' && currentSlide.content.trim() ? currentSlide.content : '';
  const nextText = typeof nextSlide?.content === 'string' && nextSlide.content.trim() ? nextSlide.content : '';
  const currentHasText = currentText.length > 0;
  const nextHasText = nextText.length > 0;
  const looksLikeVideo = (url: string) => {
    const normalized = url.split('?')[0].toLowerCase();
    return normalized.endsWith('.mp4') || normalized.endsWith('.webm') || normalized.endsWith('.mov') || normalized.includes('/video/');
  };
  const currentMediaIsVideo = currentMediaUrl ? looksLikeVideo(currentMediaUrl) : false;
  const nextMediaIsVideo = nextMediaUrl ? looksLikeVideo(nextMediaUrl) : false;
  const safeTimerDisplay = typeof timerDisplay === 'string' && timerDisplay.trim() ? timerDisplay : '00:00';
  const audienceQueue = Array.isArray(audienceOverlay?.queue) ? audienceOverlay.queue : [];
  const activeAudienceId = audienceOverlay?.pinnedMessageId || audienceOverlay?.activeMessageId;
  const activeAudienceMessage = audienceQueue.find((entry: any) => entry?.id === activeAudienceId) || null;
  const tickerItems = audienceQueue;
  const tickerDuration = Math.max(18, audienceQueue.length * 8);
  const showTicker = !!audienceOverlay?.tickerEnabled && audienceQueue.length > 0;
  const showPinned = !!activeAudienceMessage && !showTicker;
  const showAudienceBadge = showTicker || showPinned;

  return (
    <div className={`relative h-screen w-screen text-white p-8 grid grid-rows-[auto_1fr_1fr] gap-8 font-sans ${highContrast ? 'bg-black' : 'bg-black'}`}>
      {/* Top Bar: Clock & Item Title */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-4 gap-6">
        <h1 className={`${compact ? 'text-2xl' : 'text-4xl'} font-bold ${highContrast ? 'text-white' : 'text-gray-400'} truncate max-w-2xl`}>
          {currentTitle}
        </h1>
        <div className="flex flex-col items-end gap-2">
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
          {showAudienceBadge && (
            <div className="bg-blue-600/15 border border-blue-500/40 rounded-lg px-3 py-2 max-w-[260px] backdrop-blur-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-300 mb-0.5">Audience Active</div>
              <div className="text-xs font-medium leading-tight text-blue-100">
                {showTicker ? 'Ticker Running' : 'Message Displaying'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Slide (Main Focus) */}
      <div className="flex flex-col justify-center">
        <span className="text-sm font-bold text-green-500 uppercase tracking-widest mb-2">CURRENT</span>
        {currentHasText ? (
          <div className={`${compact ? 'text-5xl' : 'text-7xl'} font-bold leading-tight text-white whitespace-pre-wrap`}>
            {currentText}
          </div>
        ) : currentMediaUrl ? (
          <div className="rounded-xl border border-zinc-700/60 bg-black/35 overflow-hidden max-h-[40vh]">
            {currentMediaIsVideo ? (
              <video src={currentMediaUrl} className="w-full h-full object-contain" muted autoPlay loop playsInline />
            ) : (
              <img src={currentMediaUrl} alt="Current visual slide" className="w-full h-full object-contain" />
            )}
          </div>
        ) : (
          <div className={`${compact ? 'text-4xl' : 'text-5xl'} font-bold leading-tight text-zinc-500`}>
            Blackout
          </div>
        )}
        {!currentHasText && (
          <div className="mt-2 text-[11px] uppercase tracking-wider text-cyan-300 font-bold">
            {currentSlide?.label || 'Visual Slide Active'}
          </div>
        )}
      </div>

      {/* Next Slide (Preview) */}
      <div className={`flex flex-col justify-start ${highContrast ? 'bg-black border-white/30' : 'bg-gray-900/50 border-gray-800'} p-6 rounded-xl border`}>
        <span className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-2">NEXT</span>
        {nextHasText ? (
          <div className={`${compact ? 'text-3xl' : 'text-4xl'} font-medium ${highContrast ? 'text-white' : 'text-gray-400'} leading-snug whitespace-pre-wrap opacity-70`}>
            {nextText}
          </div>
        ) : nextMediaUrl ? (
          <div className="rounded-xl border border-zinc-700/60 bg-black/30 overflow-hidden max-h-[26vh]">
            {nextMediaIsVideo ? (
              <video src={nextMediaUrl} className="w-full h-full object-contain opacity-80" muted autoPlay loop playsInline />
            ) : (
              <img src={nextMediaUrl} alt="Next visual slide" className="w-full h-full object-contain opacity-80" />
            )}
          </div>
        ) : (
          <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-medium ${highContrast ? 'text-white' : 'text-gray-500'} leading-snug whitespace-pre-wrap opacity-60`}>
            End of Item
          </div>
        )}
        {!nextHasText && (
          <div className="mt-2 text-[10px] uppercase tracking-wider text-blue-300 font-bold opacity-80">
            {nextSlide?.label || (nextMediaUrl ? 'Visual Slide Preview' : 'End of Item')}
          </div>
        )}
      </div>

      {showPinned && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-3xl bg-black/75 border border-blue-500/35 rounded-2xl px-5 py-3 backdrop-blur-md shadow-2xl">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-300 mb-1">
            {activeAudienceMessage?.submitter_name || 'Audience'}
          </div>
          <div className="text-xl font-semibold leading-snug text-white">
            {activeAudienceMessage?.text || ''}
          </div>
        </div>
      )}

      {showTicker && (
        <div className="absolute left-0 right-0 bottom-0 h-14 bg-black/85 border-t border-white/15 backdrop-blur-sm overflow-hidden">
          <div
            className="h-full flex items-center gap-10 whitespace-nowrap px-8"
            style={{ animation: `stageTicker ${tickerDuration}s linear infinite` }}
          >
            {tickerItems.map((entry: any, idx: number) => (
              <div key={`${entry.id}-${idx}`} className="flex items-center gap-3">
                <span className="text-blue-400 text-sm">-</span>
                <span className="text-base text-white font-medium">
                  <span className="text-blue-300 font-bold mr-2">{entry.submitter_name || 'AUDIENCE'}:</span>
                  {entry.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes stageTicker {
          from { transform: translateX(100%); }
          to { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
};
