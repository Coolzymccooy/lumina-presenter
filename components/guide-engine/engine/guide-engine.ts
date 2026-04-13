import type {
  GuideEngineState,
  GuideJourney,
  GuideStep,
  GuideStatus,
  GuideUserState,
} from '../types/guide.types';
import { guideStorage } from '../services/guide-storage.service';
import { guideAnalytics } from '../services/guide-analytics.service';

export type GuideEngineListener = (state: GuideEngineState) => void;

const RESOLVE_TIMEOUT_MS = 3000;
const RESOLVE_POLL_MS = 150;

function makeIdleState(): GuideEngineState {
  return { status: 'idle', journey: null, stepIndex: 0, resolving: false, targetRect: null };
}

export class GuideEngine {
  private state: GuideEngineState = makeIdleState();
  private listeners = new Set<GuideEngineListener>();

  // ─── Public API ─────────────────────────────────────────────────────────────

  getState(): Readonly<GuideEngineState> {
    return this.state;
  }

  subscribe(fn: GuideEngineListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(journey: GuideJourney, stepIndex = 0): void {
    this.setState({ status: 'active', journey, stepIndex, resolving: false, targetRect: null });
    guideAnalytics.track('GUIDE_JOURNEY_STARTED', { journeyId: journey.id });
    this.activateStep(stepIndex);
  }

  resume(journey: GuideJourney, stepIndex: number): void {
    this.start(journey, stepIndex);
  }

  next(): void {
    const { journey, stepIndex, status } = this.state;
    if (status !== 'active' || !journey) return;
    const nextIndex = stepIndex + 1;
    if (nextIndex >= journey.steps.length) {
      this.complete();
      return;
    }
    this.setState({ ...this.state, stepIndex: nextIndex });
    this.activateStep(nextIndex);
  }

  back(): void {
    const { journey, stepIndex, status } = this.state;
    if (status !== 'active' || !journey || stepIndex === 0) return;
    const prevIndex = stepIndex - 1;
    this.setState({ ...this.state, stepIndex: prevIndex });
    this.activateStep(prevIndex);
  }

  skip(): void {
    const { journey } = this.state;
    if (!journey) return;
    guideAnalytics.track('GUIDE_JOURNEY_SKIPPED', { journeyId: journey.id });
    guideStorage.markSkipped(journey.id);
    this.setState(makeIdleState());
  }

  skipStep(): void {
    const { journey, stepIndex } = this.state;
    if (!journey) return;
    guideAnalytics.track('GUIDE_STEP_SKIPPED', { journeyId: journey.id, stepIndex });
    this.next();
  }

  stop(): void {
    this.setState(makeIdleState());
  }

  isJourneyDone(journeyId: string): boolean {
    const saved = guideStorage.load();
    return saved.completedJourneyIds.includes(journeyId) || saved.skippedJourneyIds.includes(journeyId);
  }

  // ─── Step activation ────────────────────────────────────────────────────────

  private activateStep(index: number): void {
    const { journey } = this.state;
    if (!journey) return;
    const step = journey.steps[index];
    if (!step) return;

    guideAnalytics.track('GUIDE_STEP_VIEWED', { journeyId: journey.id, stepId: step.id, stepIndex: index });

    const target = resolveTarget(step);
    if (!target) {
      // No target required — center modal
      this.setState({ ...this.state, resolving: false, targetRect: null });
      return;
    }

    this.setState({ ...this.state, resolving: true, targetRect: null });
    this.resolveElement(step, target);
  }

  private resolveElement(step: GuideStep, selector: string): void {
    const startedAt = Date.now();

    const attempt = (): void => {
      const el = document.querySelector(selector);
      if (el) {
        if (step.target?.mustBeVisible !== false) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (!visible) {
            if (Date.now() - startedAt < RESOLVE_TIMEOUT_MS) {
              setTimeout(attempt, RESOLVE_POLL_MS);
              return;
            }
          }
        }

        if (step.target?.scrollIntoView) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        const rect = el.getBoundingClientRect();
        this.setState({ ...this.state, resolving: false, targetRect: rect });
        return;
      }

      if (Date.now() - startedAt < RESOLVE_TIMEOUT_MS) {
        setTimeout(attempt, RESOLVE_POLL_MS);
        return;
      }

      // Timed out — track and show tooltip centered
      const { journey, stepIndex } = this.state;
      if (journey) {
        guideAnalytics.track('GUIDE_TARGET_MISSING', { journeyId: journey.id, stepId: step.id, selector });
      }
      this.setState({ ...this.state, resolving: false, targetRect: null });
    };

    attempt();
  }

  private complete(): void {
    const { journey } = this.state;
    if (!journey) return;
    guideAnalytics.track('GUIDE_JOURNEY_COMPLETED', { journeyId: journey.id });
    guideStorage.markCompleted(journey.id);
    this.setState({ ...makeIdleState(), status: 'completed' });
  }

  // ─── State management ───────────────────────────────────────────────────────

  private setState(next: GuideEngineState): void {
    this.state = next;
    this.listeners.forEach((fn) => fn(next));
  }
}

function resolveTarget(step: GuideStep): string | null {
  if (!step.target) return null;
  if (step.target.dataTestId) return `[data-testid="${step.target.dataTestId}"]`;
  return step.target.selector || null;
}

export const guideEngine = new GuideEngine();
