import React from 'react';

export interface SlideBrandingConfig {
  enabled: boolean;
  churchName: string;
  seriesLabel: string;
  /** Visual style of the strips */
  style?: 'minimal' | 'bold' | 'frosted';
}

/**
 * Renders two vertical branding strips on the slide edges —
 * series/date label on the left, church name on the right —
 * inspired by Audacious Church presentation aesthetics.
 *
 * The overlay sits above the slide content at a low opacity so it
 * never competes with the main message. All positioning is done in
 * percentage units so it scales perfectly at any resolution.
 */
export const SlideBrandingOverlay: React.FC<{ config: SlideBrandingConfig }> = ({ config }) => {
  if (!config.enabled) return null;
  if (!config.churchName && !config.seriesLabel) return null;

  const styleVariant = config.style ?? 'minimal';

  // Strip width as % of slide width
  const stripW = styleVariant === 'bold' ? 3.2 : 2.6;

  const stripBase: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: `${stripW}%`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    overflow: 'hidden',
  };

  const bgLeft: React.CSSProperties =
    styleVariant === 'frosted'
      ? { background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }
      : styleVariant === 'bold'
      ? { background: 'rgba(0,0,0,0.72)', borderRight: '2px solid rgba(255,255,255,0.08)' }
      : { background: 'rgba(0,0,0,0.38)' };

  const bgRight: React.CSSProperties =
    styleVariant === 'frosted'
      ? { background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }
      : styleVariant === 'bold'
      ? { background: 'rgba(0,0,0,0.72)', borderLeft: '2px solid rgba(255,255,255,0.08)' }
      : { background: 'rgba(0,0,0,0.38)' };

  const textBase: React.CSSProperties = {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    fontSize: '1.1%',   // relative to slide width via transform scale trick below
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.82)',
    whiteSpace: 'nowrap',
    lineHeight: 1,
    userSelect: 'none',
  };

  return (
    <>
      {/* ── Left strip — series / date label ── */}
      {config.seriesLabel && (
        <div style={{ ...stripBase, left: 0, ...bgLeft }}>
          {/* Decorative top accent line */}
          <div style={{
            position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)',
            width: '40%', height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
          }} />

          <span style={{
            ...textBase,
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: 'min(10px, 1.1vw)',
          }}>
            {config.seriesLabel}
          </span>

          {/* Decorative bottom accent line */}
          <div style={{
            position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
            width: '40%', height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
          }} />
        </div>
      )}

      {/* ── Right strip — church name ── */}
      {config.churchName && (
        <div style={{ ...stripBase, right: 0, ...bgRight }}>
          {/* Decorative top accent line */}
          <div style={{
            position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)',
            width: '40%', height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
          }} />

          <span style={{
            ...textBase,
            writingMode: 'vertical-rl',
            transform: 'rotate(0deg)',
            fontSize: 'min(10px, 1.1vw)',
          }}>
            {config.churchName.toUpperCase()}
          </span>

          {/* Decorative bottom accent line */}
          <div style={{
            position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
            width: '40%', height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
          }} />
        </div>
      )}
    </>
  );
};
