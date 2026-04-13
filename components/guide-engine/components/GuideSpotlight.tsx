import React from 'react';

interface GuideSpotlightProps {
  targetRect: DOMRect | null;
  padding?: number;
}

/**
 * Full-screen SVG overlay that dims everything except the target element.
 * When targetRect is null the entire screen is dimmed (used for center-stage tooltips).
 * A pulsing indigo ring animates around the spotlighted element to draw attention.
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

      {/* Dim overlay */}
      <rect
        width={W}
        height={H}
        fill="rgba(0,0,0,0.65)"
        mask="url(#lumina-guide-mask)"
      />

      {/* Static border ring */}
      {hasTarget && (
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          rx={8}
          ry={8}
          fill="none"
          stroke="rgba(99,102,241,0.8)"
          strokeWidth={2}
        />
      )}

      {/* Pulsing outer ring — expands and fades to draw attention */}
      {hasTarget && (
        <rect
          x={rx - 4}
          y={ry - 4}
          width={rw + 8}
          height={rh + 8}
          rx={12}
          ry={12}
          fill="none"
          stroke="rgba(99,102,241,0.5)"
          strokeWidth={2}
        >
          <animate
            attributeName="stroke-opacity"
            values="0.5;0;0.5"
            dur="1.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-width"
            values="2;4;2"
            dur="1.8s"
            repeatCount="indefinite"
          />
          <animateTransform
            attributeName="transform"
            type="scale"
            additive="sum"
            values="1;1.012;1"
            dur="1.8s"
            repeatCount="indefinite"
            transformOrigin={`${rx + rw / 2} ${ry + rh / 2}`}
          />
        </rect>
      )}
    </svg>
  );
}
