import type { GuideUserState } from '../types/guide.types';

const STORAGE_KEY = 'lumina_guide_state_v1';

const DEFAULT_STATE: GuideUserState = {
  completedJourneyIds: [],
  skippedJourneyIds: [],
  dismissedHints: [],
};

function load(): GuideUserState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function save(state: GuideUserState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full — non-critical, guide can still run
  }
}

function markCompleted(journeyId: string): void {
  const state = load();
  if (state.completedJourneyIds.includes(journeyId)) return;
  save({
    ...state,
    completedJourneyIds: [...state.completedJourneyIds, journeyId],
    activeJourneyId: undefined,
    activeStepIndex: undefined,
    lastSeenAt: new Date().toISOString(),
  });
}

function markSkipped(journeyId: string): void {
  const state = load();
  if (state.skippedJourneyIds.includes(journeyId)) return;
  save({
    ...state,
    skippedJourneyIds: [...state.skippedJourneyIds, journeyId],
    activeJourneyId: undefined,
    activeStepIndex: undefined,
    lastSeenAt: new Date().toISOString(),
  });
}

function saveProgress(journeyId: string, stepIndex: number): void {
  const state = load();
  save({ ...state, activeJourneyId: journeyId, activeStepIndex: stepIndex, lastSeenAt: new Date().toISOString() });
}

function dismissHint(hintId: string): void {
  const state = load();
  if (state.dismissedHints.includes(hintId)) return;
  save({ ...state, dismissedHints: [...state.dismissedHints, hintId] });
}

function reset(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export const guideStorage = { load, save, markCompleted, markSkipped, saveProgress, dismissHint, reset };
