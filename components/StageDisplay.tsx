import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ServiceItem, Slide, StageAlertState, StageTimerLayout, StageTimerVariant } from '../types';
import { getCachedMedia, getMedia } from '../services/localMedia';

interface StageDisplayProps {
  currentSlide: Slide | null;
  nextSlide: Slide | null;
  activeItem: ServiceItem | null;
  timerLabel?: string;
  timerDisplay?: string;
  timerMode?: 'COUNTDOWN' | 'ELAPSED';
  isTimerOvertime?: boolean;
  timerRemainingSec?: number;
  timerDurationSec?: number;
  timerAmberPercent?: number;
  timerRedPercent?: number;
  timerLayout?: StageTimerLayout;
  onTimerLayoutChange?: (layout: StageTimerLayout) => void;
  profile?: 'classic' | 'compact' | 'high_contrast';
  audienceOverlay?: any;
  stageAlert?: StageAlertState;
}

const DEFAULT_LAYOUT: StageTimerLayout = {
  x: 24,
  y: 24,
  width: 360,
  height: 150,
  fontScale: 1,
  variant: 'top-right',
  locked: false,
};

const PRESET_VARIANTS: StageTimerVariant[] = ['top-right', 'top-left', 'bottom-right', 'compact-bar'];
const isVariant = (value: unknown): value is StageTimerVariant =>
  value === 'top-right' || value === 'top-left' || value === 'bottom-right' || value === 'compact-bar';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const applyLayoutPreset = (variant: StageTimerVariant, baseLocked = false): StageTimerLayout => {
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 720 : window.innerHeight;
  const margin = 24;
  if (variant === 'top-left') {
    return { ...DEFAULT_LAYOUT, variant, x: margin, y: margin, width: 360, height: 150, locked: baseLocked };
  }
  if (variant === 'bottom-right') {
    return { ...DEFAULT_LAYOUT, variant, x: Math.max(margin, vw - 360 - margin), y: Math.max(margin, vh - 170 - margin), width: 360, height: 150, locked: baseLocked };
  }
  if (variant === 'compact-bar') {
    return { ...DEFAULT_LAYOUT, variant, x: Math.max(margin, vw - 540 - margin), y: Math.max(margin, vh - 104 - margin), width: 540, height: 84, fontScale: 0.9, locked: baseLocked };
  }
  return { ...DEFAULT_LAYOUT, variant, x: Math.max(margin, vw - 360 - margin), y: margin, width: 360, height: 150, locked: baseLocked };
};

const normalizeLayout = (value: StageTimerLayout | undefined | null): StageTimerLayout => {
  const raw = value || DEFAULT_LAYOUT;
  const variant = isVariant(raw.variant) ? raw.variant : DEFAULT_LAYOUT.variant;
  const preset = applyLayoutPreset(variant, !!raw.locked);
  const width = Number.isFinite(raw.width) ? clamp(raw.width, 220, 900) : preset.width;
  const height = Number.isFinite(raw.height) ? clamp(raw.height, 72, 420) : preset.height;
  const fontScale = Number.isFinite(raw.fontScale) ? clamp(raw.fontScale, 0.6, 2.3) : preset.fontScale;
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 720 : window.innerHeight;
  return {
    x: Number.isFinite(raw.x) ? clamp(raw.x, 0, Math.max(0, vw - width)) : preset.x,
    y: Number.isFinite(raw.y) ? clamp(raw.y, 0, Math.max(0, vh - height)) : preset.y,
    width,
    height,
    fontScale,
    variant,
    locked: !!raw.locked,
  };
};

const layoutsEqual = (left: StageTimerLayout, right: StageTimerLayout) => (
  left.x === right.x
  && left.y === right.y
  && left.width === right.width
  && left.height === right.height
  && left.fontScale === right.fontScale
  && left.variant === right.variant
  && left.locked === right.locked
);

export const StageDisplay: React.FC<StageDisplayProps> = ({
  currentSlide,
  nextSlide,
  activeItem,
  timerLabel = 'Service Timer',
  timerDisplay = '00:00',
  timerMode = 'COUNTDOWN',
  isTimerOvertime = false,
  timerRemainingSec = 0,
  timerDurationSec = 0,
  timerAmberPercent = 25,
  timerRedPercent = 10,
  timerLayout,
  onTimerLayoutChange,
  profile = 'classic',
  audienceOverlay,
  stageAlert,
}) => {
  const [time, setTime] = useState(new Date());
  const [layout, setLayout] = useState<StageTimerLayout>(() => normalizeLayout(timerLayout));
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; layout: StageTimerLayout } | null>(null);

  const getPreferredBackground = useCallback((slide: Slide | null) => (
    (typeof slide?.backgroundUrl === 'string' && slide.backgroundUrl.trim())
    || (typeof activeItem?.theme?.backgroundUrl === 'string' && activeItem.theme.backgroundUrl.trim())
    || ''
  ), [activeItem?.theme?.backgroundUrl]);
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string>('');
  const [nextMediaUrl, setNextMediaUrl] = useState<string>('');
  const clockFormatter = useMemo(
    () => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }),
    []
  );

  const publishLayout = useCallback((next: StageTimerLayout) => {
    setLayout(next);
    onTimerLayoutChange?.(next);
  }, [onTimerLayoutChange]);

  useEffect(() => {
    const normalized = normalizeLayout(timerLayout);
    if (!layoutsEqual(normalized, layout)) {
      setLayout(normalized);
    }
  }, [timerLayout]);

  useEffect(() => {
    const onResize = () => {
      const normalized = normalizeLayout(layout);
      if (!layoutsEqual(normalized, layout)) publishLayout(normalized);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [layout, publishLayout]);

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
  }, [currentSlide?.id, currentSlide?.backgroundUrl, getPreferredBackground]);

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
  }, [nextSlide?.id, nextSlide?.backgroundUrl, getPreferredBackground]);

  useEffect(() => {
    if (!dragMode) return;
    const onMove = (event: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (dragMode === 'move') {
        const next = {
          ...start.layout,
          x: clamp(start.layout.x + dx, 0, Math.max(0, vw - start.layout.width)),
          y: clamp(start.layout.y + dy, 0, Math.max(0, vh - start.layout.height)),
        };
        publishLayout(next);
      } else if (dragMode === 'resize') {
        const width = clamp(start.layout.width + dx, 220, 900);
        const height = clamp(start.layout.height + dy, 72, 420);
        const next = {
          ...start.layout,
          width,
          height,
          x: clamp(start.layout.x, 0, Math.max(0, vw - width)),
          y: clamp(start.layout.y, 0, Math.max(0, vh - height)),
          variant: 'top-right' as StageTimerVariant,
        };
        publishLayout(next);
      }
    };
    const onUp = () => {
      setDragMode(null);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragMode, publishLayout]);

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
  const showStageAlert = !!stageAlert?.active && !!stageAlert?.text?.trim();

  const safeDurationSec = Math.max(0, Number(timerDurationSec || 0));
  const safeRemainingSec = Number.isFinite(timerRemainingSec) ? Number(timerRemainingSec) : 0;
  const safeAmberPct = clamp(Number(timerAmberPercent || 25), 1, 99);
  const safeRedPct = clamp(Number(timerRedPercent || 10), 1, 99);
  const remainingRatio = safeDurationSec > 0
    ? clamp((safeRemainingSec / safeDurationSec), 0, 1)
    : 1;
  const isCountdown = timerMode === 'COUNTDOWN';
  const toneClass = isTimerOvertime
    ? 'text-red-400 border-red-500/60 bg-red-950/35'
    : !isCountdown
      ? 'text-cyan-300 border-cyan-500/50 bg-cyan-950/25'
      : remainingRatio <= safeRedPct / 100
        ? 'text-red-400 border-red-500/60 bg-red-950/35'
        : remainingRatio <= safeAmberPct / 100
          ? 'text-amber-300 border-amber-500/50 bg-amber-950/30'
          : 'text-emerald-300 border-emerald-500/50 bg-emerald-950/25';

  const startDrag = (mode: 'move' | 'resize', event: React.MouseEvent) => {
    if (layout.locked) return;
    event.preventDefault();
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      layout,
    };
    setDragMode(mode);
  };

  const applyPreset = (variant: StageTimerVariant) => {
    const next = applyLayoutPreset(variant, layout.locked);
    publishLayout(next);
  };

  const toggleLock = () => {
    publishLayout({ ...layout, locked: !layout.locked });
  };

  const widgetFontScale = clamp(layout.fontScale, 0.6, 2.3);
  const timerTextSize = `${Math.round((layout.variant === 'compact-bar' ? 38 : 52) * widgetFontScale)}px`;
  const subtitleSize = `${Math.round(10 * widgetFontScale)}px`;

  return (
    <div className={`relative h-screen w-screen text-white p-8 grid grid-rows-[auto_1fr_1fr] gap-8 font-sans ${highContrast ? 'bg-black' : 'bg-black'}`}>
      <div className="flex justify-between items-start border-b border-gray-800 pb-4 gap-6">
        <h1 className={`${compact ? 'text-2xl' : 'text-4xl'} font-bold ${highContrast ? 'text-white' : 'text-gray-400'} truncate max-w-2xl`}>
          {currentTitle}
        </h1>
        <div className="flex flex-col items-end gap-2">
          <div className={`${compact ? 'text-4xl' : 'text-6xl'} font-mono font-bold text-yellow-500`}>
            {clockFormatter.format(time)}
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
            Waiting for active slide
          </div>
        )}
        {!currentHasText && (
          <div className="mt-2 text-[11px] uppercase tracking-wider text-cyan-300 font-bold">
            {currentSlide?.label || 'Visual Slide Active'}
          </div>
        )}
      </div>

      {showStageAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 max-w-4xl w-[88%] bg-amber-950/80 border border-amber-500/50 rounded-2xl px-5 py-3 backdrop-blur-md shadow-2xl z-40">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 mb-1">Pastor Alert</div>
          <div className="text-xl font-semibold leading-snug text-amber-50">{stageAlert?.text}</div>
          {stageAlert?.author && (
            <div className="text-[10px] uppercase tracking-wider text-amber-200/80 mt-2">From {stageAlert.author}</div>
          )}
        </div>
      )}

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

      <div
        className={`absolute z-30 rounded-xl border backdrop-blur-sm shadow-2xl ${toneClass}`}
        style={{
          left: layout.x,
          top: layout.y,
          width: layout.width,
          height: layout.height,
          minHeight: layout.variant === 'compact-bar' ? 74 : 120,
        }}
      >
        <div
          onMouseDown={(event) => startDrag('move', event)}
          className={`w-full h-full rounded-xl p-3 ${layout.locked ? 'cursor-default' : 'cursor-move'} flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-black opacity-90">
              {timerLabel} ({timerMode})
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleLock}
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-white/30 hover:border-white/60"
                title={layout.locked ? 'Unlock timer widget' : 'Lock timer widget'}
              >
                {layout.locked ? 'Locked' : 'Free'}
              </button>
            </div>
          </div>

          <div className="font-mono font-black leading-none text-center" style={{ fontSize: timerTextSize }}>
            {safeTimerDisplay}
          </div>

          <div className="flex items-center justify-between">
            <div className="opacity-80" style={{ fontSize: subtitleSize }}>
              {isTimerOvertime ? 'OVERTIME' : (isCountdown ? `${safeAmberPct}% / ${safeRedPct}%` : 'Elapsed')}
            </div>
            {!layout.locked && (
              <div className="flex gap-1">
                <button
                  onClick={() => publishLayout({ ...layout, fontScale: clamp(layout.fontScale - 0.1, 0.6, 2.3) })}
                  className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/70 hover:border-white/60"
                  title="Reduce timer text size"
                >
                  A-
                </button>
                <button
                  onClick={() => publishLayout({ ...layout, fontScale: clamp(layout.fontScale + 0.1, 0.6, 2.3) })}
                  className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/30 text-white/70 hover:border-white/60"
                  title="Increase timer text size"
                >
                  A+
                </button>
                {PRESET_VARIANTS.map((variant) => (
                  <button
                    key={variant}
                    onClick={() => applyPreset(variant)}
                    className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${layout.variant === variant ? 'border-white/70 text-white' : 'border-white/30 text-white/70 hover:border-white/60'}`}
                    title={`Move timer to ${variant}`}
                  >
                    {variant === 'compact-bar' ? 'bar' : variant.replace('-', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {!layout.locked && (
          <div
            onMouseDown={(event) => startDrag('resize', event)}
            className="absolute right-1 bottom-1 h-4 w-4 cursor-se-resize rounded-sm border border-white/40 bg-black/30"
            title="Resize timer widget"
          />
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
            key={`stage-ticker-${audienceQueue.map((entry: any) => entry.id).join('-')}-${audienceQueue.length}`}
            className="h-full flex items-center gap-10 whitespace-nowrap px-8"
            style={{ transform: 'translateX(100vw)', animation: `stageTicker ${tickerDuration}s linear infinite` }}
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
