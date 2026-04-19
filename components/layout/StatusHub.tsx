/**
 * StatusHub — Single header pill that consolidates four status signals:
 *   1. Session ID (clickable → opens Settings)
 *   2. System online/offline
 *   3. Cloud sync (clickable when error)
 *   4. Active connections (n / expected)
 *
 * Replaces four separate pills in the AppHeader telemetry strip with one pill
 * that opens a popover. The outer pill keeps data-testid="studio-session-id-button"
 * and the inner Session row keeps data-testid="studio-session-id" so existing
 * e2e tests and guide-engine spotlights continue to resolve.
 *
 * The popover mirrors the Tooltip component's portal pattern (createPortal to
 * document.body, fixed positioning, z-index 9999, viewport clamping).
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import ReactDOM from 'react-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CloudSyncStatus = 'idle' | 'syncing' | 'error' | 'ok';

export interface StatusHubConnections {
  current: number;
  total: number;
}

export interface StatusHubProps {
  liveSessionId: string;
  isSessionIdFallback?: boolean;
  isOnline: boolean;
  syncPendingCount: number;
  cloudSyncStatus: CloudSyncStatus;
  /** Optional human-readable issue message shown when cloudSyncStatus === 'error'. */
  cloudSyncMessage?: string | null;
  connections: StatusHubConnections;
  connectionCountsByRole?: Record<string, number>;
  onSessionIdClick: () => void;
  onCloudSyncIssueClick?: () => void;
}

// ─── Status tone helpers ──────────────────────────────────────────────────────

type Tone = 'ok' | 'warn' | 'error' | 'neutral';

function pillToneFromStatus(props: StatusHubProps): Tone {
  if (!props.isOnline) return 'warn';
  if (props.cloudSyncStatus === 'error') return 'error';
  if (props.cloudSyncStatus === 'syncing' || props.syncPendingCount > 0) return 'warn';
  if (props.connections.current < props.connections.total) return 'warn';
  return 'ok';
}

const TONE_DOT: Record<Tone, string> = {
  ok: 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]',
  warn: 'bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.5)]',
  error: 'bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.5)]',
  neutral: 'bg-zinc-500',
};

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
  neutral: 'text-zinc-400',
};

const TONE_BORDER: Record<Tone, string> = {
  ok: 'border-emerald-700/40',
  warn: 'border-amber-700/40',
  error: 'border-red-700/40',
  neutral: 'border-zinc-800/60',
};

function pillSummaryLabel(tone: Tone): string {
  switch (tone) {
    case 'ok': return 'ALL SYSTEMS GO';
    case 'warn': return 'CHECK STATUS';
    case 'error': return 'ATTENTION';
    case 'neutral': return 'STATUS';
  }
}

// ─── Popover row (status indicator + label + value) ───────────────────────────

interface RowProps {
  tone: Tone;
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
  clickable?: boolean;
  testId?: string;
  ariaLabel?: string;
  innerRef?: React.Ref<HTMLDivElement | HTMLButtonElement>;
}

function StatusRow({ tone, label, value, onClick, clickable, testId, ariaLabel, innerRef }: RowProps) {
  const baseClass =
    'flex items-center justify-between gap-3 px-3 py-2 rounded-md transition-colors';
  const interactiveClass = clickable
    ? 'cursor-pointer hover:bg-zinc-800/60 focus:outline-none focus:bg-zinc-800/60'
    : '';

  const inner = (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[tone]}`} aria-hidden="true" />
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 shrink-0">{label}</span>
      </div>
      <span className={`text-[10px] font-mono font-bold truncate ${TONE_TEXT[tone]}`}>{value}</span>
    </>
  );

  if (clickable && onClick) {
    return (
      <button
        type="button"
        ref={innerRef as React.Ref<HTMLButtonElement>}
        onClick={onClick}
        data-testid={testId}
        aria-label={ariaLabel}
        className={`${baseClass} ${interactiveClass} w-full text-left`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      ref={innerRef as React.Ref<HTMLDivElement>}
      className={baseClass}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {inner}
    </div>
  );
}

// ─── Popover positioning (mirrors Tooltip.tsx pattern) ────────────────────────

interface Coords { top: number; left: number }

const GAP = 8;

function computePopoverCoords(triggerRect: DOMRect, popoverRect: DOMRect): Coords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;

  // Default: open downward, right-aligned to the trigger.
  let top = triggerRect.bottom + GAP;
  let left = triggerRect.right - popoverRect.width;

  // Flip up if not enough room below.
  if (top + popoverRect.height > vh - margin) {
    top = triggerRect.top - popoverRect.height - GAP;
  }

  // Clamp horizontally.
  left = Math.max(margin, Math.min(left, vw - popoverRect.width - margin));
  top = Math.max(margin, top);

  return { top, left };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StatusHub(props: StatusHubProps) {
  const {
    liveSessionId,
    isSessionIdFallback,
    isOnline,
    syncPendingCount,
    cloudSyncStatus,
    cloudSyncMessage,
    connections,
    connectionCountsByRole,
    onSessionIdClick,
    onCloudSyncIssueClick,
  } = props;

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const tone = pillToneFromStatus(props);

  // ── Position the popover when it opens ──
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    setCoords(computePopoverCoords(triggerRect, popoverRect));
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  // ── Outside click + Escape to close ──
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onResize = () => updatePosition();
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, updatePosition]);

  // ── Tone derivations for each row ──
  const systemTone: Tone = isOnline ? 'ok' : 'warn';
  const cloudTone: Tone =
    cloudSyncStatus === 'error' ? 'error'
    : cloudSyncStatus === 'syncing' || syncPendingCount > 0 ? 'warn'
    : cloudSyncStatus === 'ok' ? 'ok'
    : 'neutral';
  const connectionsTone: Tone = connections.current >= connections.total ? 'ok' : 'warn';

  const cloudLabel =
    cloudSyncStatus === 'error' ? (cloudSyncMessage || 'SYNC ISSUE')
    : cloudSyncStatus === 'syncing' || syncPendingCount > 0 ? `SYNCING ${syncPendingCount || ''}`.trim()
    : cloudSyncStatus === 'ok' ? 'CLOUD SYNC'
    : 'IDLE';

  const connectionsTitle = connectionCountsByRole
    ? `controller:${connectionCountsByRole.controller || 0} output:${connectionCountsByRole.output || 0} stage:${connectionCountsByRole.stage || 0} remote:${connectionCountsByRole.remote || 0}`
    : undefined;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        data-testid="studio-session-id-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Studio status: ${pillSummaryLabel(tone)}. Session ${liveSessionId}. Click for details.`}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border bg-zinc-900/40 hover:bg-zinc-900/70 transition-all ${TONE_BORDER[tone]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Session</span>
        <span className="text-[10px] font-mono text-zinc-300 truncate max-w-[90px]">{liveSessionId}</span>
        {isSessionIdFallback && (
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.6)]"
          />
        )}
        <span className={`text-[9px] font-black tracking-widest hidden md:inline ${TONE_TEXT[tone]}`}>
          {pillSummaryLabel(tone)}
        </span>
      </button>

      {open &&
        ReactDOM.createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Studio status details"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              zIndex: 9999,
            }}
            className="w-[280px] rounded-xl border border-zinc-700/80 bg-zinc-950/95 backdrop-blur-md shadow-2xl shadow-black/60 p-2"
          >
            <div className="px-3 py-1.5 mb-1 border-b border-zinc-800/80">
              <div className="text-[8px] font-black uppercase tracking-[0.22em] text-zinc-600">Studio Status</div>
              <div className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${TONE_TEXT[tone]}`}>
                {pillSummaryLabel(tone)}
              </div>
            </div>

            <StatusRow
              tone={isSessionIdFallback ? 'warn' : 'neutral'}
              label="Session"
              value={
                <span data-testid="studio-session-id" className="text-zinc-200">
                  {liveSessionId}
                </span>
              }
              clickable
              onClick={() => {
                setOpen(false);
                onSessionIdClick();
              }}
              ariaLabel={
                isSessionIdFallback
                  ? `Run Sheet name is the default "${liveSessionId}". Click to rename in Settings.`
                  : `Run Sheet name: ${liveSessionId}. Click to rename in Settings.`
              }
              testId="status-hub-row-session"
            />

            <StatusRow
              tone={systemTone}
              label="System"
              value={isOnline ? 'ONLINE' : 'OFFLINE'}
              testId="status-hub-row-system"
            />

            <StatusRow
              tone={cloudTone}
              label="Cloud Sync"
              value={cloudLabel}
              clickable={cloudSyncStatus === 'error' && !!onCloudSyncIssueClick}
              onClick={
                cloudSyncStatus === 'error' && onCloudSyncIssueClick
                  ? () => {
                      setOpen(false);
                      onCloudSyncIssueClick();
                    }
                  : undefined
              }
              ariaLabel={cloudSyncStatus === 'error' ? (cloudSyncMessage || 'Cloud sync issue. Click for guidance.') : undefined}
              testId="status-hub-row-cloud"
            />

            <div title={connectionsTitle}>
              <StatusRow
                tone={connectionsTone}
                label="Connections"
                value={`${connections.current} / ${connections.total}`}
                testId="status-hub-row-connections"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
