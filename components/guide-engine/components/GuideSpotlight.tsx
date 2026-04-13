import React from 'react';

interface GuideSpotlightProps {
  targetRect: DOMRect | null;
  padding?: number;
}

/**
 * Full-screen SVG overlay that dims everything except the target element.
 * When targetRect is null the entire screen is dimmed (used for center-stage tooltips).
 */
export function GuideSpotlight({ targetRect, padding = 6 }: GuideSpotlightProps) {
  const W = window.innerWidth;
  const H = window.innerHeight;

  const hasTarget = targetRect !== null;
  const rx = hasTarget ? Math.max(0, targetRect!.left - padding) : 0;
  const ry = hasTarget ? Math.max(0, targetRect!.top - padding) : 0;
  const rw = hasTarget ? targetRect!.width + padding * 2 : 0;
  const rh = hasTarget ? targetRect!.height + padding * 2 : 0;

  return (
    <svg
      className="fixed inset-0 z-[9000] pointer-events-none"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id="lumina-guide-mask">
          {/* White = visible (dimmed); black = transparent (spotlight hole) */}
          <rect width={W} height={H} fill="white" />
          {hasTarget && (
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              rx={8}
              ry={8}
              fill="black"
            />
          )}
        </mask>
      </defs>
      <rect
        width={W}
        height={H}
        fill="rgba(0,0,0,0.65)"
        mask="url(#lumina-guide-mask)"
      />
      {hasTarget && (
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          rx={8}
          ry={8}
          fill="none"
          stroke="rgba(99,102,241,0.7)"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}
