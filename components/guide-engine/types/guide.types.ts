export type GuideMode = 'onboarding' | 'contextual' | 'demo' | 'training';

export type GuideStepAction =
  | 'click'
  | 'hover'
  | 'input'
  | 'observe'
  | 'navigate'
  | 'wait'
  | 'select'
  | 'custom';

export type GuideCategory =
  | 'setup'
  | 'presentation'
  | 'scripture'
  | 'output'
  | 'stage'
  | 'live'
  | 'ai';

export type GuideAudience =
  | 'admin'
  | 'media'
  | 'volunteer'
  | 'pastor'
  | 'worship-leader';

export interface GuideJourney {
  id: string;
  title: string;
  description?: string;
  mode: GuideMode[];
  category: GuideCategory;
  audience: GuideAudience[];
  entryRouteHints?: string[];
  /** Exclude this journey from auto-trigger on these routes (e.g. output/stage windows) */
  excludeRouteHints?: string[];
  tags?: string[];
  skippable?: boolean;
  resumable?: boolean;
  estimatedMinutes?: number;
  steps: GuideStep[];
  completion?: GuideCompletionRule;
}

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  target?: GuideTarget;
  placement?: TooltipPlacement;
  action?: GuideStepAction;
  tooltip?: GuideTooltipContent;
  media?: {
    image?: string;
    video?: string;
  };
  waitFor?: StepWaitRule[];
  validate?: StepValidationRule[];
  /** Override the next step id (defaults to sequential) */
  nextStepId?: string;
  onEnter?: GuideSideEffect[];
  onExit?: GuideSideEffect[];
  demo?: GuideDemoMeta;
  optional?: boolean;
}

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';

export interface GuideTooltipContent {
  title?: string;
  body: string;
  tone?: 'info' | 'success' | 'warning';
  showNext?: boolean;
  showBack?: boolean;
  showSkip?: boolean;
}

export interface GuideTarget {
  /** Primary CSS selector. Optional when dataTestId is provided. */
  selector?: string;
  /** Tried in order if primary selector resolves to nothing */
  fallbackSelectors?: string[];
  /** Convenience alias — resolved as [data-testid="..."]. Takes priority over selector. */
  dataTestId?: string;
  mustBeVisible?: boolean;
  scrollIntoView?: boolean;
  /**
   * data-testid of an element to programmatically click BEFORE resolving this
   * target. Use when the target lives inside a modal/panel that must be opened
   * first (e.g. click "rightdock-start-service-btn" to open DisplaySetupModal
   * before spotlighting "display-setup-ndi-btn" inside it).
   */
  prerequisiteClick?: string;
}

export interface StepWaitRule {
  type: 'element-visible' | 'element-hidden' | 'delay' | 'custom';
  /** CSS selector or milliseconds (for delay) */
  value?: string | number;
}

export interface StepValidationRule {
  type: 'exists' | 'visible' | 'text-contains' | 'attribute' | 'custom';
  selector?: string;
  attribute?: string;
  value?: string;
}

export interface GuideCompletionRule {
  type: 'last-step' | 'custom';
  value?: string;
}

export interface GuideSideEffect {
  type: 'emit-event' | 'set-state' | 'custom';
  payload?: Record<string, unknown>;
}

export interface GuideDemoMeta {
  narration?: string;
  pauseMs?: number;
  autoAdvance?: boolean;
}

// ─── Engine state ─────────────────────────────────────────────────────────────

export type GuideStatus = 'idle' | 'active' | 'completed' | 'skipped';

export interface GuideEngineState {
  status: GuideStatus;
  journey: GuideJourney | null;
  stepIndex: number;
  /** True while the engine is resolving the target element */
  resolving: boolean;
  /** Bounding rect of the resolved target, or null for center-stage tooltips */
  targetRect: DOMRect | null;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export interface GuideUserState {
  completedJourneyIds: string[];
  skippedJourneyIds: string[];
  dismissedHints: string[];
  activeJourneyId?: string;
  activeStepIndex?: number;
  lastSeenAt?: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export type GuideAnalyticsEvent =
  | 'GUIDE_JOURNEY_STARTED'
  | 'GUIDE_JOURNEY_COMPLETED'
  | 'GUIDE_JOURNEY_SKIPPED'
  | 'GUIDE_STEP_VIEWED'
  | 'GUIDE_STEP_SKIPPED'
  | 'GUIDE_TARGET_MISSING';
