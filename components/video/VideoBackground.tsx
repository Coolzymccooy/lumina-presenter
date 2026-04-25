import React, { useEffect, useRef, useState } from 'react';

export interface VideoBackgroundProps {
  src: string;
  /** When false, render nothing (caller shows retained background instead). */
  active: boolean;
  muted: boolean;
  filter?: string;
  /** Thumbnails use a single <video loop> — no double-buffer or event listeners. */
  isThumbnail?: boolean;
  isPlaying?: boolean;
  /** Static image shown while video loads, eliminating black flash on first mount. */
  poster?: string;
  onError?: () => void;
  onReady?: () => void;
}

/**
 * Module-level first-frame cache.
 *
 * Keyed by video src URL. Populated the first time a video's first frame is
 * painted (via requestVideoFrameCallback / rAF). Survives component unmount and
 * view switches, so any subsequent mount shows the cached frame as a poster
 * instead of a black rectangle while the video re-buffers.
 *
 * Exported so callers (e.g. RetainedFloor) can read it directly.
 */
export const firstFrameCache = new Map<string, string>();

/**
 * Capture the current video frame to a JPEG data URL and store it in
 * firstFrameCache. Called once per src URL — silently skips if already cached
 * or if the canvas is cross-origin tainted.
 */
function captureFirstFrame(video: HTMLVideoElement, src: string): void {
  if (firstFrameCache.has(src)) return;
  try {
    const w = Math.min(video.videoWidth || 640, 640);
    const h = Math.min(video.videoHeight || 360, 360);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    // A valid JPEG is substantially longer than a blank/tainted canvas result
    if (dataUrl.length > 500) {
      firstFrameCache.set(src, dataUrl);
    }
  } catch {
    // Cross-origin taint or canvas unavailable — silently skip
  }
}

/**
 * Seamless-loop video background using a double-buffer technique.
 *
 * Two <video> elements (A and B) are stacked. Slot A plays first. ~0.5 s before
 * it ends, slot B seeks to 0, waits until it has a decoded frame ready
 * (readyState >= HAVE_FUTURE_DATA), then cross-fades in over 400 ms.
 * After the transition slot A resets for the next cycle.
 *
 * The canplay-gate in the swap logic prevents the brief blank that could appear
 * if the secondary slot hadn't buffered its first frame before the fade began.
 *
 * State diagram (primarySlot):
 *   A plays (slot 0)  →  crossfade A→B  →  B plays (slot 1)
 *   B plays (slot 1)  →  crossfade B→A  →  A plays (slot 0)
 */
export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  src,
  active,
  muted,
  filter,
  isThumbnail = false,
  isPlaying = true,
  poster,
  onError,
  onReady,
}) => {
  // 0 = slot A is primary; 1 = slot B is primary
  const [primarySlot, setPrimarySlot] = useState<0 | 1>(0);
  const [isCrossfading, setIsCrossfading] = useState(false);

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const swapPendingRef = useRef(false);
  const swapTimeoutRef = useRef<number | null>(null);
  // Holds the canplay listener so it can be removed on cleanup.
  const canplayCleanupRef = useRef<(() => void) | null>(null);
  const readySignaledRef = useRef(false);

  const signalReady = (video?: HTMLVideoElement | null) => {
    if (readySignaledRef.current || !onReady || !active || isThumbnail) return;
    readySignaledRef.current = true;

    const target = video as (HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
    }) | null | undefined;

    if (target?.requestVideoFrameCallback) {
      target.requestVideoFrameCallback(() => {
        captureFirstFrame(target as HTMLVideoElement, src);
        onReady();
      });
      return;
    }

    requestAnimationFrame(() => {
      if (video) captureFirstFrame(video, src);
      onReady();
    });
  };

  // ── Reset when src changes ────────────────────────────────────────────────
  useEffect(() => {
    swapPendingRef.current = false;
    readySignaledRef.current = false;

    if (swapTimeoutRef.current !== null) {
      window.clearTimeout(swapTimeoutRef.current);
      swapTimeoutRef.current = null;
    }
    if (canplayCleanupRef.current) {
      canplayCleanupRef.current();
      canplayCleanupRef.current = null;
    }

    setIsCrossfading(false);
    setPrimarySlot(0);

    const a = videoARef.current;
    const b = videoBRef.current;
    if (a) { a.pause(); a.currentTime = 0; }
    if (b) { b.pause(); b.currentTime = 0; }
  }, [src]);

  // ── Re-arm onReady when the callback identity changes (e.g. slide switch) ─
  // Without this, readySignaledRef blocks the new callback from ever firing,
  // leaving isCurrentMediaReady stuck at false and the retained floor visible.
  useEffect(() => {
    readySignaledRef.current = false;
  }, [onReady]);

  // ── Play / pause the primary slot ────────────────────────────────────────
  useEffect(() => {
    if (isThumbnail || !active) return;

    const primary = primarySlot === 0 ? videoARef.current : videoBRef.current;
    if (!primary) return;

    primary.muted = muted;

    if (!isPlaying) {
      primary.pause();
      return;
    }

    playWhenReady(primary);
  }, [isPlaying, active, muted, primarySlot, isThumbnail]);

  // Track the latest mute state in a ref so the double-buffer swap effect
  // below can read it inside its closure without depending on `muted`. If
  // we included `muted` in that effect's deps, every mute toggle would tear
  // down and re-register the timeupdate listener — a race window where the
  // swap logic could fire with the wrong listener, producing the mid-service
  // flicker the operator reported.
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (isThumbnail || !active) return;

    const primary = primarySlot === 0 ? videoARef.current : videoBRef.current;
    if (!primary) return;

    if (primary.readyState >= 2) {
      signalReady(primary);
      return;
    }

    const handleReady = () => signalReady(primary);
    primary.addEventListener('loadeddata', handleReady, { once: true });
    primary.addEventListener('canplay', handleReady, { once: true });
    primary.addEventListener('playing', handleReady, { once: true });
    return () => {
      primary.removeEventListener('loadeddata', handleReady);
      primary.removeEventListener('canplay', handleReady);
      primary.removeEventListener('playing', handleReady);
    };
  }, [primarySlot, active, isThumbnail, onReady, src]);

  // ── Playback watchdog ─────────────────────────────────────────────────────
  // Recovers from stalled playback: if the video should be playing but is
  // paused (e.g. after tab/window throttling or an AbortError at swap time),
  // kick it back into play every 3 s.
  useEffect(() => {
    if (isThumbnail || !active || !isPlaying) return;

    const interval = window.setInterval(() => {
      const primary = primarySlot === 0 ? videoARef.current : videoBRef.current;
      if (primary && primary.paused && !swapPendingRef.current) {
        playWhenReady(primary);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isPlaying, active, primarySlot, isThumbnail]);

  // ── Double-buffer swap ───────────────────────────────────────────────────
  useEffect(() => {
    if (isThumbnail || !active) return;

    const primaryVideo = primarySlot === 0 ? videoARef.current : videoBRef.current;
    if (!primaryVideo) return;

    const handleTimeUpdate = () => {
      if (swapPendingRef.current) return;
      const v = primaryVideo;
      const { duration, currentTime } = v;
      if (!duration || !Number.isFinite(duration) || duration < 1) return;
      if (currentTime < duration - 0.5) return;

      swapPendingRef.current = true;

      const nextVideo = primarySlot === 0 ? videoBRef.current : videoARef.current;
      const nextSlot: 0 | 1 = primarySlot === 0 ? 1 : 0;

      if (!nextVideo) return;

      nextVideo.muted = mutedRef.current;
      nextVideo.currentTime = 0;

      // Only begin the visual crossfade once the secondary slot has a decoded
      // frame ready. For local Electron assets this fires almost instantly
      // (preload="auto" keeps the buffer hot). For network assets it prevents
      // a blank frame appearing during the fade.
      const beginCrossfade = () => {
        canplayCleanupRef.current = null;
        setIsCrossfading(true);

        playWhenReady(nextVideo, mutedRef.current);
        signalReady(nextVideo);

        swapTimeoutRef.current = window.setTimeout(() => {
          swapTimeoutRef.current = null;
          const outgoing = primarySlot === 0 ? videoARef.current : videoBRef.current;
          if (outgoing) {
            outgoing.pause();
            outgoing.currentTime = 0;
          }
          setPrimarySlot(nextSlot);
          setIsCrossfading(false);
          swapPendingRef.current = false;
        }, 420);
      };

      if (nextVideo.readyState >= 3 /* HAVE_FUTURE_DATA */) {
        beginCrossfade();
      } else {
        const onCanPlay = () => beginCrossfade();
        nextVideo.addEventListener('canplay', onCanPlay, { once: true });
        canplayCleanupRef.current = () =>
          nextVideo.removeEventListener('canplay', onCanPlay);
      }
    };

    primaryVideo.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      primaryVideo.removeEventListener('timeupdate', handleTimeUpdate);
    };
    // `muted` intentionally NOT in the dep list — it's read via mutedRef to
    // avoid tearing down the timeupdate listener on every mute toggle.
  }, [primarySlot, isThumbnail, active]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (swapTimeoutRef.current !== null) {
        window.clearTimeout(swapTimeoutRef.current);
      }
      if (canplayCleanupRef.current) {
        canplayCleanupRef.current();
      }
    };
  }, []);

  // Effective poster: prefer a cached first-frame still over the metadata thumbnail.
  // firstFrameCache is populated after first playback, surviving view switches.
  const effectivePoster = firstFrameCache.get(src) || poster;

  // ── Thumbnail: simple single <video> — no double-buffer ──────────────────
  if (isThumbnail) {
    if (!active) return null;
    return (
      <video
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
        preload="none"
        poster={effectivePoster}
        onError={onError}
      />
    );
  }

  if (!active) return null;

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    ...(filter ? { filter } : {}),
  };

  // Opacity logic:
  //   primary=0 (A active): A=1, B=0  →  during crossfade: A fades out, B fades in
  //   primary=1 (B active): B=1, A=0  →  during crossfade: B fades out, A fades in
  const slotAOpacity: number = primarySlot === 0
    ? (isCrossfading ? 0 : 1)
    : (isCrossfading ? 1 : 0);

  const slotBOpacity: number = primarySlot === 1
    ? (isCrossfading ? 0 : 1)
    : (isCrossfading ? 1 : 0);

  const sharedStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    objectFit: 'cover',
    transition: 'opacity 400ms ease-in-out',
    pointerEvents: 'none',
    backfaceVisibility: 'hidden',
    transform: 'translateZ(0)',
    willChange: 'opacity',
  };

  return (
    <div style={containerStyle}>
      <video
        ref={videoARef}
        src={src}
        style={{ ...sharedStyle, opacity: slotAOpacity }}
        muted={muted}
        playsInline
        preload="auto"
        poster={effectivePoster}
        onError={onError}
        data-slot="A"
      />
      <video
        ref={videoBRef}
        src={src}
        style={{ ...sharedStyle, opacity: slotBOpacity }}
        muted={muted}
        playsInline
        preload="auto"
        poster={effectivePoster}
        onError={onError}
        data-slot="B"
      />
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Play a video element, auto-muting as a fallback if the browser blocks
 * unmuted autoplay (should not happen in Electron but is a safe backstop).
 */
function playWhenReady(video: HTMLVideoElement, forceMuted?: boolean): void {
  if (forceMuted !== undefined) video.muted = forceMuted;

  const doPlay = () => {
    const p = video.play();
    p?.catch((err: unknown) => {
      if (
        err instanceof Error &&
        err.name === 'NotAllowedError' &&
        !video.muted
      ) {
        video.muted = true;
        video.play().catch(() => { /* give up */ });
      }
    });
  };

  if (video.readyState >= 3 /* HAVE_FUTURE_DATA */) {
    doPlay();
  } else {
    video.addEventListener('canplay', doPlay, { once: true });
  }
}
