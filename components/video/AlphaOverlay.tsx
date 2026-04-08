import React, { useEffect, useRef, useState } from 'react';

export interface AlphaOverlayProps {
  /** URL of a WebM VP9 video with an alpha channel. */
  src: string;
  /** Disable in thumbnail contexts to keep renders static. */
  isThumbnail?: boolean;
}

/**
 * Alpha-channel video overlay.
 *
 * Renders a WebM VP9 video with native Chromium alpha compositing (Electron on
 * Windows and macOS both use Chromium, which fully supports VP9/WebM alpha).
 * Sits above the background layer (z-20) and below text (z-30+).
 *
 * Key guarantees for the desktop app:
 *  - key={src}: forces a clean remount on every URL change — no stale frame,
 *    no leftover error state from a previous overlay.
 *  - preload="auto": Chromium starts decoding before the first painted frame,
 *    so the overlay appears immediately without a blank first frame.
 *  - Imperative play() in useEffect: belt-and-suspenders over autoPlay; handles
 *    the rare case where Electron defers the autoPlay attribute on first paint.
 *  - onError → silent hide: if the file is missing or corrupted the overlay
 *    simply disappears rather than leaving a black rectangle or throwing.
 */
export const AlphaOverlay: React.FC<AlphaOverlayProps> = ({ src, isThumbnail = false }) => {
  if (isThumbnail) return null;
  // key={src} forces a full remount (fresh state + fresh DOM element) on every
  // src change. This is intentional — it's simpler and more reliable than
  // imperatively calling load()/play() on an existing element.
  return <AlphaOverlayInner key={src} src={src} />;
};

// ── Inner component — mounts fresh for each unique src ───────────────────────

const AlphaOverlayInner: React.FC<{ src: string }> = ({ src }) => {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Imperatively start playback after mount. autoPlay handles most cases, but
  // Electron can occasionally defer it if the paint is still pending. Calling
  // play() in an effect guarantees it fires after the DOM is committed.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      // VP9 WebM + muted — NotAllowedError should never fire in Electron,
      // but swallow silently so a policy change doesn't surface to the user.
    });
  }, []);

  if (failed) return null;

  return (
    <video
      ref={videoRef}
      src={src}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 20,
        pointerEvents: 'none',
      }}
      loop
      muted
      playsInline
      autoPlay
      preload="auto"
      onError={() => setFailed(true)}
    />
  );
};
