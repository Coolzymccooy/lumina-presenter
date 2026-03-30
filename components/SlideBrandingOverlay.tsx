import React from 'react';

export interface SlideBrandingConfig {
  enabled: boolean;
  churchName: string;
  seriesLabel: string;
  style?: 'minimal' | 'bold' | 'frosted';
  /** Text opacity 0–1, default 0.82 */
  textOpacity?: number;
}

/**
 * Vertical branding strips rendered inside the fixed 1920×1080 canvas.
 * ALL sizing is in px — never vw/vh/% for font sizes — because the canvas
 * is scaled via CSS transform and viewport units do not scale with it.
 */
export const SlideBrandingOverlay: React.FC<{ config: SlideBrandingConfig }> = ({ config }) => {
  if (!config.enabled) return null;
  if (!config.churchName && !config.seriesLabel) return null;

  const styleVariant = config.style ?? 'minimal';
  const textOpacity = config.textOpacity ?? 0.82;

  // Strip width in px (canvas is 1920 wide)
  const stripW = styleVariant === 'bold' ? 68 : 58;

  const stripBase: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: stripW,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    overflow: 'hidden',
  };

  const bgLeft: React.CSSProperties =
    styleVariant === 'frosted'
      ? { background: 'rgba(0,0,0,0.50)' }
      : styleVariant === 'bold'
      ? { background: 'rgba(0,0,0,0.78)', borderRight: '2px solid rgba(255,255,255,0.10)' }
      : { background: 'rgba(0,0,0,0.42)' };

  const bgRight: React.CSSProperties =
    styleVariant === 'frosted'
      ? { background: 'rgba(0,0,0,0.50)' }
      : styleVariant === 'bold'
      ? { background: 'rgba(0,0,0,0.78)', borderLeft: '2px solid rgba(255,255,255,0.10)' }
      : { background: 'rgba(0,0,0,0.42)' };

  // Fixed px font size — scales correctly with the canvas transform
  const textStyle: React.CSSProperties = {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    fontSize: styleVariant === 'bold' ? 28 : 24,  // px relative to 1920×1080 canvas
    fontWeight: 700,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: `rgba(255,255,255,${textOpacity})`,
    whiteSpace: 'nowrap',
    lineHeight: 1,
    userSelect: 'none',
    writingMode: 'vertical-rl',
  };

  const accentLine: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '40%',
    height: 2,
    background: `linear-gradient(90deg, transparent, rgba(255,255,255,${Math.min(1, textOpacity + 0.18)}), transparent)`,
  };

  return (
    <>
      {config.seriesLabel && (
        <div style={{ ...stripBase, left: 0, ...bgLeft }}>
          <div style={{ ...accentLine, top: 72 }} />
          <span style={{ ...textStyle, transform: 'rotate(180deg)' }}>
            {config.seriesLabel}
          </span>
          <div style={{ ...accentLine, bottom: 72 }} />
        </div>
      )}

      {config.churchName && (
        <div style={{ ...stripBase, right: 0, ...bgRight }}>
          <div style={{ ...accentLine, top: 72 }} />
          <span style={{ ...textStyle, transform: 'rotate(0deg)' }}>
            {config.churchName.toUpperCase()}
          </span>
          <div style={{ ...accentLine, bottom: 72 }} />
        </div>
      )}
    </>
  );
};
