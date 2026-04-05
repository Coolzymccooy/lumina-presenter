// ─── Macro System Types ──────────────────────────────────────────────────────

export type MacroTriggerType =
  | 'manual'
  | 'slide_enter'
  | 'item_start'
  | 'timer_end'
  | 'service_mode_change'
  | 'webhook';

export type MacroActionType =
  | 'next_slide'
  | 'prev_slide'
  | 'go_to_item'
  | 'go_to_slide'
  | 'set_theme'
  | 'clear_output'
  | 'show_message'
  | 'hide_message'
  | 'start_timer'
  | 'stop_timer'
  | 'trigger_aether_scene'
  | 'wait';

export type MacroCategory =
  | 'service_flow'
  | 'worship'
  | 'sermon'
  | 'streaming'
  | 'emergency'
  | 'stage'
  | 'output'
  | 'media'
  | 'custom';

export type MacroScope = 'workspace' | 'global';

export type MacroActionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

// ─── Action Payloads ──────────────────────────────────────────────────────────

export interface GoToItemPayload {
  itemId: string;
  itemTitle?: string;
}

export interface GoToSlidePayload {
  itemId: string;
  slideIndex: number;
}

export interface SetThemePayload {
  fontFamily?: string;
  textColor?: string;
  backgroundUrl?: string;
  mediaType?: 'image' | 'video' | 'color';
}

export interface ShowMessagePayload {
  text: string;
  durationMs?: number;
}

export interface StartTimerPayload {
  presetId?: string;
  durationSec?: number;
  label?: string;
}

export interface TriggerAetherScenePayload {
  sceneId: string;
  sceneName?: string;
}

export interface WaitPayload {
  delayMs: number;
}

export type MacroActionPayload =
  | GoToItemPayload
  | GoToSlidePayload
  | SetThemePayload
  | ShowMessagePayload
  | StartTimerPayload
  | TriggerAetherScenePayload
  | WaitPayload
  | Record<string, unknown>;

// ─── Core Macro Structures ────────────────────────────────────────────────────

export interface MacroTrigger {
  type: MacroTriggerType;
  /** For slide_enter: the itemId to watch. For webhook: the incoming key. */
  payload?: Record<string, unknown>;
}

// ─── Conditional Branching ───────────────────────────────────────────────────

/** Context variables that can be evaluated at runtime */
export type MacroConditionVariable =
  | 'activeSlideIndex'   // 0-based index of current slide
  | 'scheduleLength'     // total items in the run-sheet
  | 'isFirstSlide'       // true when activeSlideIndex === 0
  | 'isLastSlide'        // true when on the last slide of the active item
  | 'isServiceLive';     // true when any item is actively presented

export type MacroConditionOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte';

export interface MacroCondition {
  variable: MacroConditionVariable;
  operator: MacroConditionOperator;
  /** Value to compare against. Booleans: use 'true' / 'false' strings. */
  value: string | number;
}

export interface MacroAction {
  id: string;
  type: MacroActionType;
  payload: MacroActionPayload;
  /** Milliseconds to wait before executing this action (sequential delay) */
  delayMs?: number;
  /** If true, execution continues even if this action errors */
  continueOnError?: boolean;
  label?: string;
  /** If set, the action is skipped when the condition evaluates to false */
  condition?: MacroCondition;
}

export interface MacroDefinition {
  id: string;
  name: string;
  description?: string;
  category: MacroCategory;
  scope: MacroScope;
  triggers: MacroTrigger[];
  actions: MacroAction[];
  /** Actions to run if execution fails mid-way */
  rollbackActions?: MacroAction[];
  tags: string[];
  isEnabled: boolean;
  requiresConfirmation?: boolean;
  /** Template macros ship with Lumina and cannot be deleted */
  isTemplate?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Execution Types ──────────────────────────────────────────────────────────

export interface MacroActionResult {
  actionId: string;
  type: MacroActionType;
  status: MacroActionStatus;
  durationMs: number;
  error?: string;
}

export type MacroExecutionStatus = 'success' | 'partial' | 'failed' | 'rolled_back';

export interface MacroExecutionResult {
  macroId: string;
  macroName: string;
  status: MacroExecutionStatus;
  startedAt: string;
  durationMs: number;
  actionResults: MacroActionResult[];
  rolledBack?: boolean;
  error?: string;
}

export interface MacroSimulationStep {
  actionId: string;
  type: MacroActionType;
  label: string;
  description: string;
  willAffect: string[];
  warnings?: string[];
}

export interface MacroSimulationResult {
  macroId: string;
  steps: MacroSimulationStep[];
  totalEstimatedMs: number;
  warnings: string[];
  isExecutable: boolean;
}

// ─── Audit / Log ─────────────────────────────────────────────────────────────

export interface MacroAuditEntry {
  id: string;
  macroId: string;
  macroName: string;
  triggeredBy: 'manual' | MacroTriggerType;
  result: MacroExecutionResult;
  workspaceId: string;
  sessionId?: string;
  firedAt: string;
}

// ─── Runtime Event for trigger matching ──────────────────────────────────────

export interface MacroRuntimeEvent {
  type: MacroTriggerType;
  itemId?: string;
  slideIndex?: number;
  timerPresetId?: string;
  serviceMode?: string;
  webhookKey?: string;
}
