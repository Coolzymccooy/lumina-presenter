import React from 'react';

export interface AlphaOverlayProps {
  /** URL of a WebM VP9 video with an alpha channel. */
  src: string;
  /** Disable in thumbnail contexts to keep renders static. */
  isThumbnail?: boolean;
}

/**
 * Alpha-channel video overlay.
 *
 * Renders a WebM VP9 video with native browser alpha compositing directly above
 * the background layer and below text. The element has no background set so the
 * transparent pixels show the layers beneath.
 *
 * Use case: animated overlays — falling petals, flame effects, lower-third
 * animations — rendered over a solid/image background without a black box.
 *
 * z-index is 20, placing it above the background (z-10) and below text (z-30+).
 */
export const AlphaOverlay: React.FC<AlphaOverlayProps> = ({ src, isThumbnail = false }) => {
  if (isThumbnail) return null;

  return (
    <video
      src={src}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 20,
        mixBlendMode: 'normal',
        pointerEvents: 'none',
      }}
      loop
      muted
      playsInline
      autoPlay
    />
  );
};
