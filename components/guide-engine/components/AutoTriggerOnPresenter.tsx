import { useEffect, useRef } from 'react';
import { useGuideEngine } from '../hooks/useGuideEngine';
import { addingNewSlideJourney } from '../journeys/adding-new-slide';
import { guideStorage } from '../services/guide-storage.service';

interface AutoTriggerOnPresenterProps {
  /** True when the user is currently viewing Presenter mode. */
  isPresenterActive: boolean;
}

/**
 * Auto-launches the "Adding a New Slide" journey the first time a user opens
 * Presenter mode. Fires once per user (persisted via guideStorage). Skipped if
 * the user has already completed, skipped, or dismissed the journey, or if any
 * other journey is already running.
 */
export function AutoTriggerOnPresenter({ isPresenterActive }: AutoTriggerOnPresenterProps) {
  const { start, isActive, isJourneyDone } = useGuideEngine();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isPresenterActive) return;
    if (hasTriggeredRef.current) return;
    if (isActive) return;
    if (isJourneyDone(addingNewSlideJourney.id)) return;

    const stored = guideStorage.load();
    if (stored.skippedJourneyIds.includes(addingNewSlideJourney.id)) return;
    if (stored.dismissedHints.includes(`auto-${addingNewSlideJourney.id}`)) return;

    hasTriggeredRef.current = true;
    const timeout = window.setTimeout(() => {
      start(addingNewSlideJourney);
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [isPresenterActive, isActive, isJourneyDone, start]);

  return null;
}
