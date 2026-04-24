import React from 'react';

// Broadcast centerline crosshair. Used with the camera op to confirm that
// the projected image is perfectly centered on the screen. The small circle
// at the intersection makes sub-pixel misalignments obvious.
export const CenterCross = React.memo(function CenterCross() {
  return (
    <svg
      data-testid="tools-overlay-centercross"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1={50}
        y1={0}
        x2={50}
        y2={100}
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth={0.15}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={0}
        y1={50}
        x2={100}
        y2={50}
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth={0.15}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={50}
        cy={50}
        r={1.2}
        fill="none"
        stroke="rgba(255, 255, 255, 0.9)"
        strokeWidth={0.2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});
