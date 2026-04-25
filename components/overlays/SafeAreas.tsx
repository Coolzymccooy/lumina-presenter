import React from 'react';

// SMPTE RP 218 / EBU R 95 safe-area guides.
// Action-safe = 95% (2.5% margin each side). Title-safe = 90% (5% margins).
// Used pre-service to confirm critical graphics won't be cropped by downstream
// scalers or projector overscan.
export const SafeAreas = React.memo(function SafeAreas() {
  return (
    <svg
      data-testid="tools-overlay-safeareas"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Action-safe (95%) — warmer amber, most visible */}
      <rect
        x={2.5}
        y={2.5}
        width={95}
        height={95}
        fill="none"
        stroke="rgba(250, 204, 21, 0.85)"
        strokeWidth={0.2}
        vectorEffect="non-scaling-stroke"
      />
      {/* Title-safe (90%) — cooler white, interior */}
      <rect
        x={5}
        y={5}
        width={90}
        height={90}
        fill="none"
        stroke="rgba(255, 255, 255, 0.85)"
        strokeWidth={0.2}
        strokeDasharray="1 1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});
