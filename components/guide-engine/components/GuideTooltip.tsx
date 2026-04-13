import React from 'react';
import type { GuideStep, TooltipPlacement } from '../types/guide.types';

const TOOLTIP_WIDTH = 360;
const TOOLTIP_OFFSET = 16;

interface GuideTooltipProps {
  step: GuideStep;
  targetRect: DOMRect | null;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function GuideTooltip({
  step,
  targetRect,
  stepIndex,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: GuideTooltipProps) {
  const placement = step.placement ?? 'auto';
  const position = computePosition(targetRect, placement);

  const tooltip = step.tooltip;
  const showNext = tooltip?.showNext !== false;
  const showBack = tooltip?.showBack === true && stepIndex > 0;
  const showSkip = tooltip?.showSkip !== false;
  const isLast = stepIndex === totalSteps - 1;
  const hasMedia = step.media?.image || step.media?.video;

  const toneConfig: Record<string, { border: string; accent: string; badge: string }> = {
    info: {
      border: 'border-indigo-600/40',
      accent: 'text-indigo-400',
      badge: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50',
    },
    success: {
      border: 'border-emerald-600/40',
      accent: 'text-emerald-400',
      badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
    },
    warning: {
      border: 'border-amber-600/40',
      accent: 'text-amber-400',
      badge: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
    },
  };
  const tone = toneConfig[tooltip?.tone ?? 'info'] ?? toneConfig.info;

  const arrow = targetRect ? buildArrow(targetRect, step.placement ?? 'auto', position) : null;

  return (
    <div
      data-testid="guide-tooltip"
      className={`fixed z-[9100] bg-zinc-900 border ${tone.border} rounded-2xl shadow-2xl shadow-black/70 text-zinc-200 animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden`}
      style={{ width: TOOLTIP_WIDTH, ...position }}
    >
      {arrow}
      {/* ── Media section ── */}
      {hasMedia && (
        <div className="relative w-full bg-zinc-950 overflow-hidden" style={{ height: 180 }}>
          {step.media?.video ? (
            <video
              src={step.media.video}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : step.media?.image ? (
            <img
              src={step.media.image}
              alt={tooltip?.title ?? step.title}
              className="w-full h-full object-cover"
            />
          ) : null}

          {/* Gradient overlay so text reads well above image */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />

          {/* Step badge floating over media */}
          <div className="absolute top-3 right-3">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest border ${tone.badge}`}>
              STEP {stepIndex + 1}/{totalSteps}
            </span>
          </div>

          {/* Title over gradient bottom */}
          {tooltip?.title && (
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
              <p className={`text-xs font-black tracking-widest uppercase ${tone.accent}`}>
                {tooltip.title}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Text content ── */}
      <div className="p-4">
        {/* Title (when no media) */}
        {!hasMedia && tooltip?.title && (
          <div className="flex items-center gap-2 mb-2">
            <p className={`text-[10px] font-black tracking-widest uppercase ${tone.accent}`}>
              {tooltip.title}
            </p>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest border ${tone.badge}`}>
              {stepIndex + 1}/{totalSteps}
            </span>
          </div>
        )}

        {/* Body */}
        <p className="text-sm leading-relaxed text-zinc-300">
          {tooltip?.body ?? step.description}
        </p>

        {/* Demo narration (italic, dimmed) */}
        {step.demo?.narration && (
          <p className="mt-2 text-xs italic text-zinc-500 leading-relaxed">
            {step.demo.narration}
          </p>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                data-testid="guide-btn-back"
                onClick={onBack}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                ← Back
              </button>
            )}
            {showSkip && (
              <button
                data-testid="guide-btn-skip"
                onClick={onSkip}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Skip tour
              </button>
            )}
          </div>
          {showNext && (
            <button
              data-testid="guide-btn-next"
              onClick={onNext}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-black tracking-wide transition-colors ${
                isLast
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isLast ? '✓ Done' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Position calculation ─────────────────────────────────────────────────────

type CSSPosition = {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  transform?: string;
};

function computePosition(targetRect: DOMRect | null, placement: TooltipPlacement): CSSPosition {
  const W = window.innerWidth;
  const H = window.innerHeight;

  if (!targetRect || placement === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const clampLeft = (x: number) => Math.max(8, Math.min(x, W - TOOLTIP_WIDTH - 8));
  const centeredLeft = clampLeft(targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2);

  const effectivePlacement = placement === 'auto' ? autoPlace(targetRect, W, H) : placement;

  switch (effectivePlacement) {
    case 'bottom':
      return { top: targetRect.bottom + TOOLTIP_OFFSET, left: centeredLeft };
    case 'top':
      return { top: targetRect.top - TOOLTIP_OFFSET - 180, left: centeredLeft };
    case 'right':
      return {
        top: Math.max(8, targetRect.top),
        left: Math.min(targetRect.right + TOOLTIP_OFFSET, W - TOOLTIP_WIDTH - 8),
      };
    case 'left':
      return {
        top: Math.max(8, targetRect.top),
        left: Math.max(8, targetRect.left - TOOLTIP_WIDTH - TOOLTIP_OFFSET),
      };
    default:
      return { top: targetRect.bottom + TOOLTIP_OFFSET, left: centeredLeft };
  }
}

function autoPlace(rect: DOMRect, W: number, H: number): TooltipPlacement {
  const spaceBelow = H - rect.bottom;
  const spaceAbove = rect.top;
  const spaceRight = W - rect.right;

  if (spaceBelow >= 200) return 'bottom';
  if (spaceAbove >= 200) return 'top';
  if (spaceRight >= TOOLTIP_WIDTH + TOOLTIP_OFFSET) return 'right';
  return 'left';
}

// ─── Arrow connector ──────────────────────────────────────────────────────────

/**
 * Renders a small CSS-triangle arrow on the edge of the tooltip that faces
 * the spotlighted element.
 *
 * placement   meaning                arrow position on tooltip
 * ----------  ---------------------  -------------------------
 * bottom      tooltip below element  top edge  (arrow points ↑)
 * top         tooltip above element  bottom edge (arrow points ↓)
 * right       tooltip right          left edge (arrow points ←)
 * left        tooltip left           right edge (arrow points →)
 */
function buildArrow(
  targetRect: DOMRect,
  placement: TooltipPlacement,
  tooltipPos: CSSPosition,
): React.ReactElement | null {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const effective = placement === 'auto' ? autoPlace(targetRect, W, H) : placement;

  if (effective === 'center') return null;

  const SIZE = 8; // half-width of arrow base
  const BG = '#18181b'; // zinc-900 — match tooltip background
  const BORDER = 'rgba(99,102,241,0.4)'; // subtle indigo tint

  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    pointerEvents: 'none',
  };

  // For bottom/top we horizontally centre the arrow over the element
  const tooltipLeft =
    typeof tooltipPos.left === 'number' ? tooltipPos.left : W / 2 - TOOLTIP_WIDTH / 2;
  const elementCentreX = targetRect.left + targetRect.width / 2;
  const arrowLeftRaw = elementCentreX - tooltipLeft - SIZE;
  const arrowLeft = Math.max(12, Math.min(arrowLeftRaw, TOOLTIP_WIDTH - 12 - SIZE * 2));

  switch (effective) {
    case 'bottom':
      return (
        <div
          style={{
            ...base,
            top: -SIZE,
            left: arrowLeft,
            borderLeft: `${SIZE}px solid transparent`,
            borderRight: `${SIZE}px solid transparent`,
            borderBottom: `${SIZE}px solid ${BG}`,
            filter: `drop-shadow(0 -1px 0 ${BORDER})`,
          }}
        />
      );
    case 'top': {
      const tooltipTop =
        typeof tooltipPos.top === 'number' ? tooltipPos.top : undefined;
      const tooltipHeight = tooltipTop ? H - tooltipTop : 240; // rough estimate
      return (
        <div
          style={{
            ...base,
            bottom: -SIZE,
            left: arrowLeft,
            borderLeft: `${SIZE}px solid transparent`,
            borderRight: `${SIZE}px solid transparent`,
            borderTop: `${SIZE}px solid ${BG}`,
            filter: `drop-shadow(0 1px 0 ${BORDER})`,
          }}
        />
      );
    }
    case 'right': {
      const elementCentreY = targetRect.top + targetRect.height / 2;
      const tooltipTop2 =
        typeof tooltipPos.top === 'number' ? tooltipPos.top : H / 2 - 120;
      const arrowTop = Math.max(12, elementCentreY - tooltipTop2 - SIZE);
      return (
        <div
          style={{
            ...base,
            top: arrowTop,
            left: -SIZE,
            borderTop: `${SIZE}px solid transparent`,
            borderBottom: `${SIZE}px solid transparent`,
            borderRight: `${SIZE}px solid ${BG}`,
            filter: `drop-shadow(-1px 0 0 ${BORDER})`,
          }}
        />
      );
    }
    case 'left': {
      const elementCentreY2 = targetRect.top + targetRect.height / 2;
      const tooltipTop3 =
        typeof tooltipPos.top === 'number' ? tooltipPos.top : H / 2 - 120;
      const arrowTop2 = Math.max(12, elementCentreY2 - tooltipTop3 - SIZE);
      return (
        <div
          style={{
            ...base,
            top: arrowTop2,
            right: -SIZE,
            borderTop: `${SIZE}px solid transparent`,
            borderBottom: `${SIZE}px solid transparent`,
            borderLeft: `${SIZE}px solid ${BG}`,
            filter: `drop-shadow(1px 0 0 ${BORDER})`,
          }}
        />
      );
    }
    default:
      return null;
  }
}
