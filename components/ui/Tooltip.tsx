/**
 * Tooltip — Global tooltip system for Lumina Presenter.
 *
 * Variants:
 *   default   — simple 1-2 line hint
 *   info      — multi-line feature explanation (blue accent)
 *   shortcut  — includes a keyboard shortcut badge
 *   warning   — risky-action hint (amber accent)
 *   ai        — AI feature hint (violet glow)
 *
 * Usage:
 *   <Tooltip content="Next slide" shortcut="→">
 *     <button>…</button>
 *   </Tooltip>
 *
 *   <Tooltip content="This will end the live session" variant="warning">
 *     <button>End Session</button>
 *   </Tooltip>
 */
import React, {
  cloneElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import ReactDOM from 'react-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TooltipVariant = 'default' | 'info' | 'shortcut' | 'warning' | 'ai';
export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

export interface TooltipProps {
  /** The tooltip content. Can be a string or JSX. */
  content: React.ReactNode;
  /** Visual variant — controls accent color and icon. Default: 'default'. */
  variant?: TooltipVariant;
  /** Preferred placement relative to the trigger. Auto-flips on overflow. */
  placement?: TooltipPlacement;
  /** Keyboard shortcut to display alongside content (works with any variant). */
  shortcut?: string;
  /** Keep tooltip open when the user hovers over the tooltip itself. */
  interactive?: boolean;
  /** Suppress the tooltip entirely. */
  disabled?: boolean;
  /** Delay before showing, in ms. Default: 400. */
  delay?: number;
  /** The element that triggers the tooltip. Must be a single React element. */
  children: React.ReactElement<AnyProps>;
}

// ─── Positioning helpers ───────────────────────────────────────────────────────

const GAP = 8; // px gap between trigger and tooltip

interface Coords { top: number; left: number }

function computePosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  placement: TooltipPlacement,
): Coords {
  const { top, left, right, bottom, width, height } = triggerRect;
  const tw = tooltipRect.width;
  const th = tooltipRect.height;

  switch (placement) {
    case 'top':
      return {
        top: top - th - GAP,
        left: left + width / 2 - tw / 2,
      };
    case 'bottom':
      return {
        top: bottom + GAP,
        left: left + width / 2 - tw / 2,
      };
    case 'left':
      return {
        top: top + height / 2 - th / 2,
        left: left - tw - GAP,
      };
    case 'right':
      return {
        top: top + height / 2 - th / 2,
        left: right + GAP,
      };
  }
}

/** Clamp tooltip within viewport. Returns adjusted coords. */
function clampToViewport(coords: Coords, tooltipRect: DOMRect): Coords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;
  return {
    top: Math.max(margin, Math.min(coords.top, vh - tooltipRect.height - margin)),
    left: Math.max(margin, Math.min(coords.left, vw - tooltipRect.width - margin)),
  };
}

/**
 * Auto-flip: if the preferred placement causes overflow, try the opposite side.
 */
function resolvePlacement(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferred: TooltipPlacement,
): TooltipPlacement {
  const opposite: Record<TooltipPlacement, TooltipPlacement> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  const coords = computePosition(triggerRect, tooltipRect, preferred);
  const tw = tooltipRect.width;
  const th = tooltipRect.height;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const overflowsTop = coords.top < 8;
  const overflowsBottom = coords.top + th > vh - 8;
  const overflowsLeft = coords.left < 8;
  const overflowsRight = coords.left + tw > vw - 8;

  if (
    (preferred === 'top' && overflowsTop) ||
    (preferred === 'bottom' && overflowsBottom) ||
    (preferred === 'left' && overflowsLeft) ||
    (preferred === 'right' && overflowsRight)
  ) {
    return opposite[preferred];
  }
  return preferred;
}

// ─── Variant styles ────────────────────────────────────────────────────────────

interface VariantStyle {
  container: string;
  text: string;
  icon?: string;
}

const VARIANT_STYLES: Record<TooltipVariant, VariantStyle> = {
  default: {
    container: 'bg-zinc-800 border border-zinc-700',
    text: 'text-zinc-100',
  },
  info: {
    container: 'bg-zinc-900 border border-blue-500/30',
    text: 'text-zinc-100',
    icon: 'ℹ',
  },
  shortcut: {
    container: 'bg-zinc-800 border border-zinc-700',
    text: 'text-zinc-100',
  },
  warning: {
    container: 'bg-zinc-900 border border-amber-500/40',
    text: 'text-amber-100',
    icon: '⚠',
  },
  ai: {
    container: 'bg-zinc-900 border border-violet-500/40 shadow-[0_0_12px_rgba(139,92,246,0.15)]',
    text: 'text-zinc-100',
    icon: '✦',
  },
};

const ICON_COLOR: Record<TooltipVariant, string> = {
  default: '',
  info: 'text-blue-400',
  shortcut: '',
  warning: 'text-amber-400',
  ai: 'text-violet-400',
};

// ─── TooltipContent (rendered inside portal) ──────────────────────────────────

interface TooltipContentProps {
  content: React.ReactNode;
  variant: TooltipVariant;
  shortcut?: string;
  coords: Coords;
  visible: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
}

const TooltipContent: React.FC<TooltipContentProps> = ({
  content,
  variant,
  shortcut,
  coords,
  visible,
  onMouseEnter,
  onMouseLeave,
  tooltipRef,
}) => {
  const styles = VARIANT_STYLES[variant];
  const iconColor = ICON_COLOR[variant];
  const icon = styles.icon;

  return (
    <div
      ref={tooltipRef}
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 9999,
        pointerEvents: onMouseEnter ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.96)',
        transition: 'opacity 120ms ease, transform 120ms ease',
      }}
      className={`
        max-w-xs rounded-lg px-3 py-2 shadow-xl
        text-[12px] leading-snug
        ${styles.container}
      `}
    >
      <div className="flex items-start gap-1.5">
        {icon && (
          <span className={`text-[11px] mt-0.5 shrink-0 ${iconColor}`}>{icon}</span>
        )}
        <span className={`${styles.text} min-w-0`}>{content}</span>
      </div>
      {shortcut && (
        <div className="mt-1.5 flex items-center gap-1">
          {shortcut.split('+').map((key, i, arr) => (
            <React.Fragment key={i}>
              <kbd className="inline-block rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono font-medium text-zinc-300 leading-none">
                {key.trim()}
              </kbd>
              {i < arr.length - 1 && (
                <span className="text-zinc-600 text-[10px]">+</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Tooltip component ────────────────────────────────────────────────────

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  variant = 'default',
  placement = 'top',
  shortcut,
  interactive = false,
  disabled = false,
  delay = 400,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringTooltip = useRef(false);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  /** Position the tooltip based on current trigger rect. */
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const resolved = resolvePlacement(triggerRect, tooltipRect, placement);
    const raw = computePosition(triggerRect, tooltipRect, resolved);
    setCoords(clampToViewport(raw, tooltipRect));
  }, [placement]);

  // After tooltip mounts (mounted=true, visible=false initially), measure and position.
  useLayoutEffect(() => {
    if (mounted) updatePosition();
  }, [mounted, updatePosition]);

  const show = useCallback(() => {
    if (disabled) return;
    clearTimers();
    showTimerRef.current = setTimeout(() => {
      setMounted(true);
      // small rAF so the element is in the DOM before we try to measure
      requestAnimationFrame(() => {
        updatePosition();
        setVisible(true);
      });
    }, delay);
  }, [disabled, delay, clearTimers, updatePosition]);

  const hide = useCallback(() => {
    clearTimers();
    hideTimerRef.current = setTimeout(() => {
      if (interactive && isHoveringTooltip.current) return;
      setVisible(false);
      // unmount after fade
      setTimeout(() => setMounted(false), 150);
    }, interactive ? 80 : 0);
  }, [interactive, clearTimers]);

  const handleTooltipEnter = useCallback(() => {
    if (!interactive) return;
    isHoveringTooltip.current = true;
    clearTimers();
  }, [interactive, clearTimers]);

  const handleTooltipLeave = useCallback(() => {
    if (!interactive) return;
    isHoveringTooltip.current = false;
    hide();
  }, [interactive, hide]);

  // Clone child to inject trigger ref and event handlers
  const trigger = cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      children.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      children.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      children.props.onFocus?.(e);
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      children.props.onBlur?.(e);
      hide();
    },
  });

  if (disabled || !content) return children;

  return (
    <>
      {trigger}
      {mounted &&
        ReactDOM.createPortal(
          <TooltipContent
            content={content}
            variant={variant}
            shortcut={shortcut}
            coords={coords}
            visible={visible}
            tooltipRef={tooltipRef}
            onMouseEnter={interactive ? handleTooltipEnter : undefined}
            onMouseLeave={interactive ? handleTooltipLeave : undefined}
          />,
          document.body,
        )}
    </>
  );
};
