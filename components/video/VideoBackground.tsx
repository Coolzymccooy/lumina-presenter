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
  onError?: () => void;
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
  onError,
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

  // ── Reset when src changes ────────────────────────────────────────────────
  useEffect(() => {
    swapPendingRef.current = false;

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

      nextVideo.muted = muted;
      nextVideo.currentTime = 0;

      // Only begin the visual crossfade once the secondary slot has a decoded
      // frame ready. For local Electron assets this fires almost instantly
      // (preload="auto" keeps the buffer hot). For network assets it prevents
      // a blank frame appearing during the fade.
      const beginCrossfade = () => {
        canplayCleanupRef.current = null;
        setIsCrossfading(true);

        playWhenReady(nextVideo, muted);

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
  }, [primarySlot, isThumbnail, active, muted]);

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

  // ── Thumbnail: simple single <video loop> ─────────────────────────────────
  if (isThumbnail) {
    if (!active) return null;
    return (
      <video
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted
        playsInline
        preload="auto"
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
    objectFit: 'cover',
    transition: 'opacity 400ms ease-in-out',
    pointerEvents: 'none',
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
