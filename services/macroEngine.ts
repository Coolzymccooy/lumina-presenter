import type {
  MacroDefinition,
  MacroAction,
  MacroActionResult,
  MacroActionStatus,
  MacroExecutionResult,
  MacroExecutionStatus,
  MacroSimulationResult,
  MacroSimulationStep,
  MacroRuntimeEvent,
  GoToItemPayload,
  GoToSlidePayload,
  ShowMessagePayload,
  StartTimerPayload,
  TriggerAetherScenePayload,
  WaitPayload,
} from '../types/macros';
import type { ServiceItem } from '../types';
import { dispatchAetherBridgeEvent } from './aetherBridge';

// ─── Execution Context ────────────────────────────────────────────────────────

/** Everything the engine needs to act on the live Lumina state */
export interface MacroExecutionContext {
  workspaceId: string;
  sessionId: string;
  schedule: ServiceItem[];
  selectedItemId: string;
  activeItemId: string | null;
  activeSlideIndex: number;
  aetherBridgeUrl: string;
  aetherBridgeToken: string;
  // Setters
  setSelectedItemId: (id: string) => void;
  setActiveItemId: (id: string | null) => void;
  setActiveSlideIndex: (index: number) => void;
  showStageMessage: (text: string, durationMs?: number) => void;
  hideStageMessage: () => void;
  clearOutput: () => void;
  startTimer: (presetId?: string, durationSec?: number, label?: string) => void;
  stopTimer: () => void;
}

// ─── Action Descriptions (used by simulation) ────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  next_slide: 'Advance to next slide',
  prev_slide: 'Go to previous slide',
  go_to_item: 'Jump to run sheet item',
  go_to_slide: 'Jump to specific slide',
  set_theme: 'Apply theme override',
  clear_output: 'Clear audience output',
  show_message: 'Show stage message',
  hide_message: 'Hide stage message',
  start_timer: 'Start speaker timer',
  stop_timer: 'Stop speaker timer',
  trigger_aether_scene: 'Send scene change to Aether',
  wait: 'Wait (delay)',
};

// ─── Individual Action Executors ──────────────────────────────────────────────

async function executeNextSlide(ctx: MacroExecutionContext): Promise<void> {
  const item = ctx.schedule.find(i => i.id === ctx.activeItemId) ||
               ctx.schedule.find(i => i.id === ctx.selectedItemId);
  if (!item || !Array.isArray(item.slides)) return;
  const nextIndex = ctx.activeSlideIndex + 1;
  if (nextIndex < item.slides.length) {
    ctx.setActiveSlideIndex(nextIndex);
  }
}

async function executePrevSlide(ctx: MacroExecutionContext): Promise<void> {
  const prevIndex = Math.max(0, ctx.activeSlideIndex - 1);
  ctx.setActiveSlideIndex(prevIndex);
}

async function executeGoToItem(
  ctx: MacroExecutionContext,
  payload: GoToItemPayload,
): Promise<void> {
  const resolvedId = payload.itemId === '__FIRST_ITEM__'
    ? ctx.schedule[0]?.id
    : payload.itemId;
  if (!resolvedId) throw new Error('Schedule is empty — no first item to go to');
  const item = ctx.schedule.find(i => i.id === resolvedId);
  if (!item) throw new Error(`Item "${payload.itemTitle ?? payload.itemId}" not found in schedule`);
  ctx.setSelectedItemId(item.id);
  ctx.setActiveItemId(item.id);
  ctx.setActiveSlideIndex(0);
}

async function executeGoToSlide(
  ctx: MacroExecutionContext,
  payload: GoToSlidePayload,
): Promise<void> {
  const item = ctx.schedule.find(i => i.id === payload.itemId);
  if (!item) throw new Error(`Item "${payload.itemId}" not found in schedule`);
  if (typeof payload.slideIndex !== 'number' || isNaN(payload.slideIndex)) {
    throw new Error(`Invalid slide index for item "${item.title}"`);
  }
  if (!Array.isArray(item.slides) || payload.slideIndex < 0 || payload.slideIndex >= item.slides.length) {
    throw new Error(`Slide index ${payload.slideIndex} out of range for item "${item.title}"`);
  }
  ctx.setActiveItemId(item.id);
  ctx.setActiveSlideIndex(payload.slideIndex);
}

async function executeShowMessage(
  ctx: MacroExecutionContext,
  payload: ShowMessagePayload,
): Promise<void> {
  ctx.showStageMessage(payload.text, payload.durationMs);
}

async function executeHideMessage(ctx: MacroExecutionContext): Promise<void> {
  ctx.hideStageMessage();
}

async function executeClearOutput(ctx: MacroExecutionContext): Promise<void> {
  ctx.clearOutput();
}

async function executeStartTimer(
  ctx: MacroExecutionContext,
  payload: StartTimerPayload,
): Promise<void> {
  ctx.startTimer(payload.presetId, payload.durationSec, payload.label);
}

async function executeStopTimer(ctx: MacroExecutionContext): Promise<void> {
  ctx.stopTimer();
}

async function executeTriggerAetherScene(
  ctx: MacroExecutionContext,
  payload: TriggerAetherScenePayload,
): Promise<void> {
  if (!ctx.aetherBridgeUrl) {
    throw new Error('Aether bridge URL not configured');
  }
  const result = await dispatchAetherBridgeEvent({
    endpointUrl: ctx.aetherBridgeUrl,
    accessToken: ctx.aetherBridgeToken || undefined,
    event: 'lumina.scene.switch',
    workspaceId: ctx.workspaceId,
    sessionId: ctx.sessionId,
    payload: { sceneId: payload.sceneId, sceneName: payload.sceneName ?? '' },
  });
  if (!result.ok) {
    throw new Error(`Aether bridge error: ${result.message ?? result.error}`);
  }
}

const MAX_WAIT_MS = 300_000; // 5 minutes

async function executeWait(payload: WaitPayload): Promise<void> {
  const delay = Math.min(Math.max(0, payload.delayMs ?? 0), MAX_WAIT_MS);
  await new Promise<void>(resolve => setTimeout(resolve, delay));
}

// ─── Single Action Dispatcher ─────────────────────────────────────────────────

async function runAction(
  action: MacroAction,
  ctx: MacroExecutionContext,
): Promise<void> {
  switch (action.type) {
    case 'next_slide':
      return executeNextSlide(ctx);
    case 'prev_slide':
      return executePrevSlide(ctx);
    case 'go_to_item':
      return executeGoToItem(ctx, action.payload as GoToItemPayload);
    case 'go_to_slide':
      return executeGoToSlide(ctx, action.payload as GoToSlidePayload);
    case 'show_message':
      return executeShowMessage(ctx, action.payload as ShowMessagePayload);
    case 'hide_message':
      return executeHideMessage(ctx);
    case 'clear_output':
      return executeClearOutput(ctx);
    case 'start_timer':
      return executeStartTimer(ctx, action.payload as StartTimerPayload);
    case 'stop_timer':
      return executeStopTimer(ctx);
    case 'trigger_aether_scene':
      return executeTriggerAetherScene(ctx, action.payload as TriggerAetherScenePayload);
    case 'wait':
      return executeWait(action.payload as WaitPayload);
    case 'set_theme':
      // Theme changes require a full item update — emit via ctx in a future iteration
      return;
    default:
      throw new Error(`Unknown action type: ${(action as MacroAction).type}`);
  }
}

// ─── Main Execution Entry Point ───────────────────────────────────────────────

export async function executeMacro(
  macro: MacroDefinition,
  ctx: MacroExecutionContext,
): Promise<MacroExecutionResult> {
  const startedAt = new Date().toISOString();
  const wallStart = performance.now();
  const actionResults: MacroActionResult[] = [];

  let failed = false;
  let rollbackTriggered = false;

  for (const action of macro.actions) {
    if (action.delayMs && action.delayMs > 0) {
      const cappedDelay = Math.min(action.delayMs, MAX_WAIT_MS);
      await new Promise<void>(resolve => setTimeout(resolve, cappedDelay));
    }

    const actionStart = performance.now();
    let status: MacroActionStatus = 'success';
    let error: string | undefined;

    try {
      await runAction(action, ctx);
    } catch (err: unknown) {
      status = 'error';
      error = err instanceof Error ? err.message : String(err);
      if (!action.continueOnError) {
        failed = true;
        actionResults.push({
          actionId: action.id,
          type: action.type,
          status,
          durationMs: Math.round(performance.now() - actionStart),
          error,
        });
        break;
      }
    }

    actionResults.push({
      actionId: action.id,
      type: action.type,
      status,
      durationMs: Math.round(performance.now() - actionStart),
      error,
    });
  }

  // Rollback on failure
  if (failed && macro.rollbackActions && macro.rollbackActions.length > 0) {
    rollbackTriggered = true;
    for (const rbAction of macro.rollbackActions) {
      try {
        await runAction(rbAction, ctx);
      } catch {
        // best-effort rollback
      }
    }
  }

  const totalMs = Math.round(performance.now() - wallStart);
  const hasError = actionResults.some(r => r.status === 'error');
  const status: MacroExecutionStatus = failed && rollbackTriggered
    ? 'rolled_back'
    : failed || hasError
    ? 'partial'
    : 'success';

  return {
    macroId: macro.id,
    macroName: macro.name,
    status,
    startedAt,
    durationMs: totalMs,
    actionResults,
    rolledBack: rollbackTriggered,
  };
}

// ─── Simulation (dry-run) ─────────────────────────────────────────────────────

export function simulateMacro(
  macro: MacroDefinition,
  ctx: Pick<MacroExecutionContext, 'schedule' | 'activeItemId' | 'selectedItemId' | 'aetherBridgeUrl'>,
): MacroSimulationResult {
  const steps: MacroSimulationStep[] = [];
  const warnings: string[] = [];
  let estimatedMs = 0;

  for (const action of macro.actions) {
    const label = action.label ?? ACTION_LABELS[action.type] ?? action.type;
    const willAffect: string[] = [];
    const stepWarnings: string[] = [];

    switch (action.type) {
      case 'next_slide':
      case 'prev_slide': {
        willAffect.push('Active slide index');
        const item = ctx.schedule.find(i =>
          i.id === ctx.activeItemId || i.id === ctx.selectedItemId,
        );
        if (!item) stepWarnings.push('No item currently active — slide navigation may have no effect');
        break;
      }
      case 'go_to_item': {
        const p = action.payload as GoToItemPayload;
        const resolvedId = p.itemId === '__FIRST_ITEM__' ? ctx.schedule[0]?.id : p.itemId;
        const found = ctx.schedule.find(i => i.id === resolvedId);
        willAffect.push('Selected item', 'Active item', 'Slide index → 0');
        if (p.itemId === '__FIRST_ITEM__' && !ctx.schedule[0]) {
          stepWarnings.push('Schedule is empty — first item cannot be resolved');
        } else if (!found) {
          stepWarnings.push(`Item "${p.itemTitle ?? p.itemId}" not in current schedule`);
        }
        break;
      }
      case 'go_to_slide': {
        const p = action.payload as GoToSlidePayload;
        const found = ctx.schedule.find(i => i.id === p.itemId);
        willAffect.push('Active item', 'Slide index');
        if (!found) stepWarnings.push(`Item "${p.itemId}" not in current schedule`);
        break;
      }
      case 'clear_output':
        willAffect.push('Audience output (cleared)');
        break;
      case 'show_message':
      case 'hide_message':
        willAffect.push('Stage display message');
        break;
      case 'start_timer':
      case 'stop_timer':
        willAffect.push('Speaker timer');
        break;
      case 'trigger_aether_scene':
        willAffect.push('Aether scene (remote)');
        if (!ctx.aetherBridgeUrl) {
          stepWarnings.push('Aether bridge URL not configured — this action will fail at runtime');
        }
        break;
      case 'wait': {
        const p = action.payload as WaitPayload;
        estimatedMs += p.delayMs ?? 0;
        willAffect.push(`Pause ${p.delayMs}ms`);
        break;
      }
      default:
        willAffect.push('Unknown effect');
    }

    estimatedMs += action.delayMs ?? 0;
    steps.push({
      actionId: action.id,
      type: action.type,
      label,
      description: ACTION_LABELS[action.type] ?? action.type,
      willAffect,
      warnings: stepWarnings.length > 0 ? stepWarnings : undefined,
    });

    warnings.push(...stepWarnings);
  }

  return {
    macroId: macro.id,
    steps,
    totalEstimatedMs: estimatedMs,
    warnings,
    isExecutable: macro.actions.length > 0,
  };
}

// ─── Trigger Matching ─────────────────────────────────────────────────────────

/**
 * Returns macros from the provided list that should fire for the given runtime event.
 * Call this at trigger points in App.tsx (slide change, item start, timer end, etc.)
 */
export function matchTriggers(
  event: MacroRuntimeEvent,
  macros: MacroDefinition[],
): MacroDefinition[] {
  return macros.filter(macro => {
    if (!macro.isEnabled) return false;
    return macro.triggers.some(trigger => {
      if (trigger.type !== event.type) return false;
      switch (event.type) {
        case 'slide_enter':
          return !trigger.payload?.itemId || trigger.payload.itemId === event.itemId;
        case 'item_start':
          return !trigger.payload?.itemId || trigger.payload.itemId === event.itemId;
        case 'timer_end':
          return !trigger.payload?.presetId || trigger.payload.presetId === event.timerPresetId;
        case 'service_mode_change':
          return !trigger.payload?.mode || trigger.payload.mode === event.serviceMode;
        case 'webhook':
          return trigger.payload?.key === event.webhookKey;
        case 'manual':
          return true;
        default:
          return false;
      }
    });
  });
}
