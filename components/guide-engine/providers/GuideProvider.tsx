import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { guideEngine } from '../engine/guide-engine';
import { guideStorage } from '../services/guide-storage.service';
import type { GuideEngineState, GuideJourney } from '../types/guide.types';

interface GuideContextValue {
  state: GuideEngineState;
  completedJourneyIds: string[];
  start: (journey: GuideJourney) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  skipStep: () => void;
  stop: () => void;
  isJourneyDone: (id: string) => boolean;
}

const GuideContext = createContext<GuideContextValue | null>(null);

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuideEngineState>(guideEngine.getState());
  const [completedJourneyIds, setCompletedJourneyIds] = useState<string[]>(
    () => guideStorage.load().completedJourneyIds,
  );

  useEffect(() => {
    return guideEngine.subscribe(setState);
  }, []);

  // Persist active step + refresh completed list whenever state changes
  useEffect(() => {
    if (state.status === 'active' && state.journey) {
      guideStorage.saveProgress(state.journey.id, state.stepIndex);
    }
    if (state.status === 'completed' || state.status === 'skipped') {
      setCompletedJourneyIds(guideStorage.load().completedJourneyIds);
    }
  }, [state.status, state.journey, state.stepIndex]);

  const value: GuideContextValue = {
    state,
    completedJourneyIds,
    start: (journey) => guideEngine.start(journey),
    next: () => guideEngine.next(),
    back: () => guideEngine.back(),
    skip: () => guideEngine.skip(),
    skipStep: () => guideEngine.skipStep(),
    stop: () => guideEngine.stop(),
    isJourneyDone: (id) => guideEngine.isJourneyDone(id),
  };

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuideContext(): GuideContextValue {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error('useGuideContext must be used within <GuideProvider>');
  return ctx;
}
