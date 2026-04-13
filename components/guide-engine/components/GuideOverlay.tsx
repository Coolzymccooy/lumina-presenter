import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGuideEngine } from '../hooks/useGuideEngine';
import { GuideSpotlight } from './GuideSpotlight';
import { GuideTooltip } from './GuideTooltip';
import { GuideProgress } from './GuideProgress';

/**
 * Master overlay — mount this once at app root.
 * It reads from the guide engine context and renders nothing when idle.
 *
 * Does NOT render on /output or /stage routes to avoid disrupting projection.
 */
export function GuideOverlay() {
  const { isActive, journey, currentStep, stepIndex, totalSteps, targetRect, next, back, skip, stop } =
    useGuideEngine();

  // Block on /output and /stage routes — these are projection windows
  const path = window.location.pathname;
  if (path.includes('/output') || path.includes('/stage')) return null;

  if (!isActive || !journey || !currentStep) return null;

  return createPortal(
    <>
      <GuideSpotlight targetRect={targetRect} />
      <GuideTooltip
        step={currentStep}
        targetRect={targetRect}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onNext={next}
        onBack={back}
        onSkip={skip}
      />
      <GuideProgress
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        journeyTitle={journey.title}
        onExit={stop}
      />
    </>,
    document.body
  );
}
