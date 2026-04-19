/**
 * CollapsiblePanel — Reusable collapsible card with localStorage-persisted state.
 *
 * Used to sectionalize the Presenter view's bottom rack (Transport, Timer + Cue,
 * Rundown + Output) so users can collapse panels they aren't actively using.
 *
 * Public API:
 *   <CollapsiblePanel id="transport" title="Transport">
 *     {children}
 *   </CollapsiblePanel>
 *
 *   expandPanel('transport');   // imperatively re-expand a panel from anywhere
 *
 * Persistence:
 *   localStorage key: lumina.panel.<id>  → '1' (collapsed) | '0' (expanded)
 *
 * Guide-engine integration:
 *   The body is kept mounted in the DOM (display:none when collapsed) so journey
 *   spotlights can still resolve their selectors. A journey step targeting an
 *   element inside a default-collapsed panel can call expandPanel(id) on enter.
 */
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Tooltip, type TooltipVariant } from './Tooltip';

const PANEL_EXPAND_EVENT = 'lumina:panel-expand';
const STORAGE_PREFIX = 'lumina.panel.';

// ─── Public helper ────────────────────────────────────────────────────────────

/** Imperatively force-expand a CollapsiblePanel by id. */
export function expandPanel(id: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PANEL_EXPAND_EVENT, { detail: { id } }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollapsiblePanelProps {
  /** Stable id used for the localStorage key and expandPanel() targeting. */
  id: string;
  /** Header label (e.g. "Transport"). */
  title: string;
  /** Optional chip rendered next to the title (e.g. "Live Flow"). */
  badge?: ReactNode;
  /** Initial state when no localStorage entry exists. Default: false (expanded). */
  defaultCollapsed?: boolean;
  /** Outer wrapper class — re-apply the existing card gradient classes here. */
  className?: string;
  /** Right-aligned slot in the header row (does NOT toggle when clicked). */
  rightSlot?: ReactNode;
  /** Hover tooltip rendered over the header title — use to motivate clicks on collapsed panels. */
  headerTooltip?: ReactNode;
  /** Visual variant for the header tooltip (default 'info'). */
  headerTooltipVariant?: TooltipVariant;
  /** Test id for e2e selectors. */
  'data-testid'?: string;
  children: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_CARD_CLASS =
  'rounded-xl border border-zinc-800/80 bg-[linear-gradient(160deg,rgba(28,28,34,0.95),rgba(10,10,14,1))] p-3 shadow-[0_4px_16px_rgba(0,0,0,0.4)]';

function readStoredCollapsed(id: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* localStorage may be unavailable (private mode, sandbox) — fall back silently */
  }
  return fallback;
}

function writeStoredCollapsed(id: string, collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, collapsed ? '1' : '0');
  } catch {
    /* ignore storage errors */
  }
}

export function CollapsiblePanel({
  id,
  title,
  badge,
  defaultCollapsed = false,
  className,
  rightSlot,
  headerTooltip,
  headerTooltipVariant = 'info',
  'data-testid': testId,
  children,
}: CollapsiblePanelProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readStoredCollapsed(id, defaultCollapsed),
  );

  // Persist on every change.
  useEffect(() => {
    writeStoredCollapsed(id, collapsed);
  }, [id, collapsed]);

  // Listen for imperative expandPanel() events.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail && detail.id === id) {
        setCollapsed(false);
      }
    };
    window.addEventListener(PANEL_EXPAND_EVENT, handler);
    return () => window.removeEventListener(PANEL_EXPAND_EVENT, handler);
  }, [id]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const onHeaderClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Allow nested interactive controls in rightSlot to work without toggling.
      const target = event.target as HTMLElement;
      if (target.closest('[data-collapsible-no-toggle]')) return;
      toggle();
    },
    [toggle],
  );

  const ariaControlsId = `collapsible-panel-body-${id}`;

  const titleArea = (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-zinc-500 shrink-0">
        {collapsed ? (
          <ChevronRight size={12} />
        ) : (
          <ChevronDown size={12} />
        )}
      </span>
      <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 font-black truncate">
        {title}
      </span>
      {badge && <span className="shrink-0">{badge}</span>}
    </div>
  );

  return (
    <div
      className={className ?? DEFAULT_CARD_CLASS}
      data-testid={testId}
      data-collapsible-id={id}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-controls={ariaControlsId}
        onClick={onHeaderClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
        className="mb-2 flex items-center justify-between cursor-pointer select-none -mx-1 -mt-1 px-1 pt-1 pb-1 rounded-md hover:bg-zinc-900/40 transition-colors"
        data-testid={testId ? `${testId}-header` : undefined}
      >
        {headerTooltip ? (
          <Tooltip content={headerTooltip} variant={headerTooltipVariant} placement="top">
            {titleArea}
          </Tooltip>
        ) : (
          titleArea
        )}
        {rightSlot && (
          <div data-collapsible-no-toggle className="shrink-0">
            {rightSlot}
          </div>
        )}
      </div>
      <div
        id={ariaControlsId}
        aria-hidden={collapsed}
        style={collapsed ? { display: 'none' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
