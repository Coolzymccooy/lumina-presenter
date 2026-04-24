import React from 'react';

interface AspectMarkersProps {
  aspect: Exclude<ToolsAspect, 'off'>;
  /** Container aspect ratio. Defaults to 16:9 which is the Audience/NDI default. */
  containerRatio?: number;
}

// Letterbox / pillarbox overlay. Darkens the area outside the requested
// target aspect so the operator can confirm framing for a 4:3 SD feed or
// a square social-media crop. Assumes a 16:9 container unless overridden.
export const AspectMarkers = React.memo(function AspectMarkers({
  aspect,
  containerRatio = 16 / 9,
}: AspectMarkersProps) {
  const targetRatio = aspectToRatio(aspect);
  // percentages of container width / height that the target fills when
  // centered inside the container while preserving its own aspect
  let insetX = 0; // % from each horizontal edge
  let insetY = 0; // % from each vertical edge
  if (targetRatio > containerRatio) {
    // Target is wider → letterbox top/bottom
    const visibleHeightPct = (containerRatio / targetRatio) * 100;
    insetY = (100 - visibleHeightPct) / 2;
  } else if (targetRatio < containerRatio) {
    // Target is narrower → pillarbox left/right
    const visibleWidthPct = (targetRatio / containerRatio) * 100;
    insetX = (100 - visibleWidthPct) / 2;
  }
  const barColor = 'rgba(0, 0, 0, 0.75)';
  const lineColor = 'rgba(255, 255, 255, 0.75)';
  return (
    <div
      data-testid="tools-overlay-aspect"
      data-aspect={aspect}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      {insetX > 0 && (
        <>
          <div className="absolute inset-y-0 left-0" style={{ width: `${insetX}%`, background: barColor }} />
          <div className="absolute inset-y-0 right-0" style={{ width: `${insetX}%`, background: barColor }} />
          <div className="absolute inset-y-0" style={{ left: `${insetX}%`, width: '1px', background: lineColor }} />
          <div className="absolute inset-y-0" style={{ right: `${insetX}%`, width: '1px', background: lineColor }} />
        </>
      )}
      {insetY > 0 && (
        <>
          <div className="absolute inset-x-0 top-0" style={{ height: `${insetY}%`, background: barColor }} />
          <div className="absolute inset-x-0 bottom-0" style={{ height: `${insetY}%`, background: barColor }} />
          <div className="absolute inset-x-0" style={{ top: `${insetY}%`, height: '1px', background: lineColor }} />
          <div className="absolute inset-x-0" style={{ bottom: `${insetY}%`, height: '1px', background: lineColor }} />
        </>
      )}
    </div>
  );
});

function aspectToRatio(aspect: Exclude<ToolsAspect, 'off'>): number {
  switch (aspect) {
    case '4:3':
      return 4 / 3;
    case '16:9':
      return 16 / 9;
    case '1:1':
      return 1;
  }
}
