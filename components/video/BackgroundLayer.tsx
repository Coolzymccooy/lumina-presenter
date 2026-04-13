import React, { useEffect, useRef, useState } from 'react';
import { MediaType } from '../../types';
import { VideoBackground } from './VideoBackground';
import { isMotionUrl, normalizeMotionUrl } from '../../services/motionEngine';
import { MotionCanvas } from '../MotionCanvas';
import { MOTION_CANVAS_PRESENTATION_FILTER } from '../slide-layout/render/backgroundTone';

export interface BackgroundLayerProps {
  url: string;
  mediaType: MediaType;
  imageFit: 'cover' | 'contain';
  filter?: string;
  isMuted: boolean;
  isThumbnail: boolean;
  isPlaying: boolean;
  youtubeId: string | null;
  youtubeIframeRef?: React.RefObject<HTMLIFrameElement>;
  onError?: () => void;
  onYoutubeLoad?: () => void;
}

/**
 * Background crossfade layer (Feature 3).
 *
 * When the background URL changes between slides a 300 ms CSS crossfade plays.
 * When the background stays the same (text-only slide changes) there is no
 * transition — the background remains perfectly still.
 *
 * Uses an A/B slot pattern: both slots are mounted; one is visible (opacity 1)
 * and the other hidden (opacity 0). On URL change the hidden slot loads the new
 * asset, then a CSS transition swaps them.
 *
 * Thumbnails skip all transitions and render a simple static background.
 */
export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  url,
  mediaType,
  imageFit,
  filter,
  isMuted,
  isThumbnail,
  isPlaying,
  youtubeId,
  youtubeIframeRef,
  onError,
  onYoutubeLoad,
}) => {
  // Thumbnails: render immediately with no transition logic
  if (isThumbnail) {
    return (
      <div className="absolute inset-0 w-full h-full">
        <StaticBackground
          url={url}
          mediaType={mediaType}
          imageFit={imageFit}
          filter={undefined}
          isMuted
          isThumbnail
          youtubeId={youtubeId}
          onError={onError}
          isPlaying={false}
        />
      </div>
    );
  }

  return (
    <CrossfadeBackground
      url={url}
      mediaType={mediaType}
      imageFit={imageFit}
      filter={filter}
      isMuted={isMuted}
      isPlaying={isPlaying}
      youtubeId={youtubeId}
      youtubeIframeRef={youtubeIframeRef}
      onError={onError}
      onYoutubeLoad={onYoutubeLoad}
    />
  );
};

// ── CrossfadeBackground ────────────────────────────────────────────────────

interface SlotState {
  url: string;
  mediaType: MediaType;
  imageFit: 'cover' | 'contain';
  youtubeId: string | null;
}

interface CrossfadeBackgroundProps {
  url: string;
  mediaType: MediaType;
  imageFit: 'cover' | 'contain';
  filter?: string;
  isMuted: boolean;
  isPlaying: boolean;
  youtubeId: string | null;
  youtubeIframeRef?: React.RefObject<HTMLIFrameElement>;
  onError?: () => void;
  onYoutubeLoad?: () => void;
}

const CrossfadeBackground: React.FC<CrossfadeBackgroundProps> = ({
  url,
  mediaType,
  imageFit,
  filter,
  isMuted,
  isPlaying,
  youtubeId,
  youtubeIframeRef,
  onError,
  onYoutubeLoad,
}) => {
  // Which slot is the "live" foreground: 0 = A, 1 = B
  const [primarySlot, setPrimarySlot] = useState<0 | 1>(0);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const crossfadeTimeoutRef = useRef<number | null>(null);

  const [slotA, setSlotA] = useState<SlotState>({ url, mediaType, imageFit, youtubeId });
  const [slotB, setSlotB] = useState<SlotState>({ url, mediaType, imageFit, youtubeId });

  const prevUrlRef = useRef(url);

  useEffect(() => {
    if (url === prevUrlRef.current) return;
    prevUrlRef.current = url;

    // Cancel any in-flight crossfade before starting a new one.
    if (crossfadeTimeoutRef.current !== null) {
      window.clearTimeout(crossfadeTimeoutRef.current);
      crossfadeTimeoutRef.current = null;
    }

    // Load new asset into the hidden slot, then crossfade
    const nextSlot: 0 | 1 = primarySlot === 0 ? 1 : 0;
    const nextState: SlotState = { url, mediaType, imageFit, youtubeId };

    if (nextSlot === 0) setSlotA(nextState);
    else setSlotB(nextState);

    // Small rAF delay ensures the new slot has painted before we start fading
    const raf = requestAnimationFrame(() => {
      setIsCrossfading(true);

      crossfadeTimeoutRef.current = window.setTimeout(() => {
        crossfadeTimeoutRef.current = null;
        setPrimarySlot(nextSlot);
        setIsCrossfading(false);
      }, 320);
    });

    return () => cancelAnimationFrame(raf);
  }, [url, mediaType, imageFit, youtubeId, primarySlot]);

  useEffect(() => {
    return () => {
      if (crossfadeTimeoutRef.current !== null) {
        window.clearTimeout(crossfadeTimeoutRef.current);
      }
    };
  }, []);

  // Opacity: same logic as VideoBackground double-buffer
  const slotAOpacity: number = primarySlot === 0
    ? (isCrossfading ? 0 : 1)
    : (isCrossfading ? 1 : 0);

  const slotBOpacity: number = primarySlot === 1
    ? (isCrossfading ? 0 : 1)
    : (isCrossfading ? 1 : 0);

  const slotStyle = (opacity: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity,
    transition: 'opacity 300ms ease-in-out',
    pointerEvents: 'none',
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={slotStyle(slotAOpacity)}>
        <StaticBackground
          url={slotA.url}
          mediaType={slotA.mediaType}
          imageFit={slotA.imageFit}
          filter={filter}
          isMuted={isMuted}
          isThumbnail={false}
          youtubeId={slotA.youtubeId}
          youtubeIframeRef={primarySlot === 0 ? youtubeIframeRef : undefined}
          onError={primarySlot === 0 ? onError : undefined}
          onYoutubeLoad={primarySlot === 0 ? onYoutubeLoad : undefined}
          isPlaying={isPlaying && primarySlot === 0}
        />
      </div>
      <div style={slotStyle(slotBOpacity)}>
        <StaticBackground
          url={slotB.url}
          mediaType={slotB.mediaType}
          imageFit={slotB.imageFit}
          filter={filter}
          isMuted={isMuted}
          isThumbnail={false}
          youtubeId={slotB.youtubeId}
          youtubeIframeRef={primarySlot === 1 ? youtubeIframeRef : undefined}
          onError={primarySlot === 1 ? onError : undefined}
          onYoutubeLoad={primarySlot === 1 ? onYoutubeLoad : undefined}
          isPlaying={isPlaying && primarySlot === 1}
        />
      </div>
    </div>
  );
};

// ── StaticBackground ───────────────────────────────────────────────────────
// Renders one background asset — image, video (via VideoBackground), color, YouTube.

interface StaticBackgroundProps {
  url: string;
  mediaType: MediaType;
  imageFit: 'cover' | 'contain';
  filter?: string;
  isMuted: boolean;
  isThumbnail: boolean;
  isPlaying: boolean;
  youtubeId: string | null;
  youtubeIframeRef?: React.RefObject<HTMLIFrameElement>;
  onError?: () => void;
  onYoutubeLoad?: () => void;
}

const StaticBackground: React.FC<StaticBackgroundProps> = ({
  url,
  mediaType,
  imageFit,
  filter,
  isMuted,
  isThumbnail,
  isPlaying,
  youtubeId,
  youtubeIframeRef,
  onError,
  onYoutubeLoad,
}) => {
  // Lumina motion backgrounds – canvas-rendered, always available offline
  if (mediaType === 'motion' || isMotionUrl(url)) {
    const safeMotionUrl = normalizeMotionUrl(url, 'sermon-clean');
    return (
      <MotionCanvas
        motionUrl={safeMotionUrl}
        isPlaying={isPlaying && !isThumbnail}
        className="absolute inset-0 w-full h-full"
        style={!isThumbnail && filter ? { filter: MOTION_CANVAS_PRESENTATION_FILTER } : undefined}
      />
    );
  }

  if (mediaType === 'color') {
    return <div className="absolute inset-0 w-full h-full" style={{ backgroundColor: url }} />;
  }

  if ((mediaType === 'video' || mediaType === 'video-alpha') && youtubeId) {
    const origin = getBestOrigin();
    const params = new URLSearchParams({
      autoplay: isThumbnail ? '0' : '1',
      controls: '0',
      modestbranding: '1',
      rel: '0',
      playsinline: '1',
      iv_load_policy: '3',
      loop: '1',
      playlist: youtubeId,
      enablejsapi: '1',
      mute: isThumbnail || isMuted ? '1' : '0',
    });
    if (origin) params.set('origin', origin);
    const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;
    return (
      <div
        className="absolute inset-0 w-full h-full"
        style={!isThumbnail && filter ? { filter } : undefined}
      >
        <iframe
          ref={youtubeIframeRef}
          className="w-full h-full"
          src={src}
          title="YouTube background"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={onYoutubeLoad}
          onError={onError}
        />
      </div>
    );
  }

  if ((mediaType === 'video' || mediaType === 'video-alpha') && url) {
    return (
      <VideoBackground
        src={url}
        active
        muted={isMuted || isThumbnail}
        filter={!isThumbnail ? filter : undefined}
        isThumbnail={isThumbnail}
        isPlaying={isPlaying}
        onError={onError}
      />
    );
  }

  if (!url) return null;

  if (imageFit === 'contain') {
    return (
      <div
        className="absolute inset-0 w-full h-full relative overflow-hidden bg-black"
        style={!isThumbnail && filter ? { filter } : undefined}
      >
        <div
          className="absolute inset-0 bg-center bg-cover scale-110 blur-2xl opacity-90"
          style={{ backgroundImage: `url(${url})` }}
        />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <img
            src={url}
            alt=""
            className="w-full h-full object-contain"
            draggable={false}
            onError={onError}
          />
        </div>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
      style={!isThumbnail && filter ? { filter } : undefined}
      draggable={false}
      onError={onError}
    />
  );
};

function getBestOrigin(): string {
  try {
    const o = window.opener?.location?.origin;
    if (o && o !== 'null') return o;
  } catch { /* ignore */ }
  try {
    const o = window.location?.origin;
    if (o && o !== 'null' && o !== 'about:blank') return o;
  } catch { /* ignore */ }
  return '';
}
