import { useGuideContext } from '../providers/GuideProvider';
import type { GuideJourney } from '../types/guide.types';

/**
 * Primary hook for consuming the guide engine in components.
 *
 * Usage:
 *   const { isActive, currentStep, next, back, skip } = useGuideEngine();
 */
export function useGuideEngine() {
  const { state, completedJourneyIds, start, next, back, skip, skipStep, stop, isJourneyDone } = useGuideContext();

  const currentStep = state.journey?.steps[state.stepIndex] ?? null;
  const totalSteps = state.journey?.steps.length ?? 0;
  const isActive = state.status === 'active';
  const isResolving = state.resolving;

  return {
    // State
    state,
    isActive,
    isResolving,
    journey: state.journey,
    currentStep,
    stepIndex: state.stepIndex,
    totalSteps,
    targetRect: state.targetRect,
    completedJourneyIds,

    // Actions
    start,
    next,
    back,
    skip,
    skipStep,
    stop,
    isJourneyDone,
  };
}

/**
 * Hook for a specific journey — provides a convenient `launch` helper and
 * a `isThisJourneyActive` flag.
 */
export function useJourney(journey: GuideJourney) {
  const engine = useGuideEngine();

  return {
    ...engine,
    launch: () => engine.start(journey),
    isDone: engine.isJourneyDone(journey.id),
    isThisJourneyActive: engine.journey?.id === journey.id && engine.isActive,
  };
}
