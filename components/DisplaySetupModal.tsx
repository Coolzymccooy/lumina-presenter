import React, { useState } from 'react';
import { CheckIcon, MonitorIcon, PlayIcon, RefreshIcon, Settings, XIcon } from './Icons';

export type DesktopDisplayCard = {
  id: number;
  key: string;
  name: string;
  role: 'control' | 'audience' | 'stage' | 'none';
  isPrimary: boolean;
  isInternal: boolean;
  width: number;
  height: number;
  scaleFactor: number;
  x: number;
  y: number;
  liveStatus?: 'active' | 'idle';
};

type DisplaySetupModalProps = {
  open: boolean;
  displays: DesktopDisplayCard[];
  detectedCount: number;
  validationErrors: string[];
  statusText?: string;
  onClose: () => void;
  onRefresh: () => void;
  onAutoAssign: () => void;
  onIdentifyAll: () => void;
  onRoleChange: (displayId: number, role: DesktopDisplayCard['role']) => void;
  onTestDisplay: (displayId: number) => void;
  onSaveMapping: () => void;
  onStartService: () => void;
  onLaunchNdiWindow?: () => void;
  ndiWindowOpen?: boolean;
};

const ROLE_META: Record<DesktopDisplayCard['role'], { label: string; badge: string; tint: string }> = {
  control: { label: 'Control', badge: 'Control', tint: 'from-cyan-500/20 via-cyan-500/5 to-transparent text-cyan-200 border-cyan-500/30' },
  audience: { label: 'Audience', badge: 'Audience', tint: 'from-emerald-500/20 via-emerald-500/5 to-transparent text-emerald-200 border-emerald-500/30' },
  stage: { label: 'Stage', badge: 'Stage', tint: 'from-purple-500/20 via-purple-500/5 to-transparent text-purple-200 border-purple-500/30' },
  none: { label: 'Unused', badge: 'Unused', tint: 'from-zinc-700/30 via-zinc-800/10 to-transparent text-zinc-400 border-zinc-700/40' },
};

const formatScale = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '1.0x';
  return `${value.toFixed(1)}x`;
};

export const DisplaySetupModal: React.FC<DisplaySetupModalProps> = ({
  open,
  displays,
  detectedCount,
  validationErrors,
  statusText,
  onClose,
  onRefresh,
  onAutoAssign,
  onIdentifyAll,
  onRoleChange,
  onTestDisplay,
  onSaveMapping,
  onStartService,
  onLaunchNdiWindow,
  ndiWindowOpen,
}) => {
  const [busyAction, setBusyAction] = useState<'refresh' | 'auto' | 'identify' | 'save' | 'start' | 'ndi' | null>(null);

  const runBusyAction = async (
    action: 'refresh' | 'auto' | 'identify' | 'save' | 'start' | 'ndi',
    callback: () => Promise<void> | void,
  ) => {
    if (busyAction) return;
    setBusyAction(action);
    try {
      await Promise.resolve(callback());
    } finally {
      window.setTimeout(() => setBusyAction(null), 220);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md px-4 py-5">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-[0_36px_100px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-900 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">Display Setup</div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Assign each screen a role for your service</h2>
            <p className="mt-1 text-sm text-zinc-500">Control the room from one place. Audience and stage windows open on the screens you assign here.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              {detectedCount} Display{detectedCount === 1 ? '' : 's'} Detected
            </div>
            <button
              onClick={() => {
                void runBusyAction('refresh', onRefresh);
              }}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-zinc-500"
            >
              <RefreshIcon className="h-3.5 w-3.5" /> {busyAction === 'refresh' ? 'Refreshing' : 'Refresh'}
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
              aria-label="Close display setup"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-h-0 overflow-y-auto border-r border-zinc-900 px-5 py-5 custom-scrollbar">
            {displays.length === 0 ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
                  <MonitorIcon className="h-8 w-8 text-zinc-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-300">No displays detected</div>
                  <div className="mt-1 text-xs text-zinc-600 max-w-xs">
                    {detectedCount === 0
                      ? 'Make sure you are running the Lumina desktop app and have external displays connected.'
                      : 'Click Refresh to re-scan for connected displays.'}
                  </div>
                </div>
                <button
                  onClick={() => { void runBusyAction('refresh', onRefresh); }}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-zinc-500"
                >
                  <RefreshIcon className="h-3.5 w-3.5" /> {busyAction === 'refresh' ? 'Refreshing…' : 'Refresh Displays'}
                </button>
              </div>
            ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {displays.map((display, index) => {
                const meta = ROLE_META[display.role];
                return (
                  <section key={display.key} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Display {index + 1}</div>
                        <div className="mt-1 truncate text-sm font-bold text-white">{display.name}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {display.width}x{display.height} · {formatScale(display.scaleFactor)} · {display.x},{display.y}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {display.isPrimary && (
                          <span className="rounded-full border border-blue-700/50 bg-blue-950/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">
                            Primary
                          </span>
                        )}
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
                          {display.isInternal ? 'Internal' : 'External'}
                        </span>
                      </div>
                    </div>

                    <div className={`mx-4 mb-4 rounded-2xl border bg-gradient-to-br ${meta.tint}`}>
                      <div className="aspect-[16/10] px-4 py-4">
                        <div className="flex h-full flex-col rounded-xl border border-white/10 bg-black/35 px-4 py-3">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                            <span>{meta.badge}</span>
                            {display.liveStatus === 'active' && (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 text-[9px] text-emerald-300">
                                Live
                              </span>
                            )}
                          </div>
                          <div className="flex flex-1 items-center justify-center">
                            <MonitorIcon className="h-12 w-12 text-white/75" />
                          </div>
                          <div className="text-center text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                            {display.role === 'none' ? 'No role assigned' : `${meta.label} display`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 border-t border-zinc-800 px-4 py-4">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Role</span>
                        <select
                          value={display.role}
                          onChange={(event) => onRoleChange(display.id, event.target.value as DesktopDisplayCard['role'])}
                          className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none transition-colors hover:border-zinc-500 focus:border-cyan-500"
                          style={{ colorScheme: 'dark' }}
                        >
                          <option value="control">Control</option>
                          <option value="audience">Audience</option>
                          <option value="stage">Stage</option>
                          <option value="none">Unused</option>
                        </select>
                      </label>

                      <div className="flex gap-2">
                        <button
                          onClick={() => onTestDisplay(display.id)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-zinc-500"
                        >
                          <MonitorIcon className="h-3.5 w-3.5" /> Test
                        </button>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
            )}
          </div>

          <aside className="flex min-h-0 flex-col bg-zinc-950/70">
            <div className="border-b border-zinc-900 px-5 py-5">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Service Actions</div>
              <div className="mt-2 text-sm text-zinc-400">Save the mapping once, then launch the room from here with confidence.</div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 custom-scrollbar">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  <Settings className="h-4 w-4 text-cyan-300" /> Smart Setup
                </div>
                <div className="mt-3 grid gap-2">
                  <button
                    onClick={() => {
                      void runBusyAction('auto', onAutoAssign);
                    }}
                    disabled={busyAction !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-zinc-500"
                  >
                    <CheckIcon className="h-3.5 w-3.5" /> {busyAction === 'auto' ? 'Assigning' : 'Auto Assign'}
                  </button>
                  <button
                    onClick={() => {
                      void runBusyAction('identify', onIdentifyAll);
                    }}
                    disabled={busyAction !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-zinc-500"
                  >
                    <MonitorIcon className="h-3.5 w-3.5" /> {busyAction === 'identify' ? 'Identifying' : 'Identify All'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Validation</div>
                {validationErrors.length ? (
                  <div className="mt-3 space-y-2">
                    {validationErrors.map((message) => (
                      <div key={message} className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                        {message}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
                    Mapping is ready. Control, audience, and stage roles are cleanly assigned.
                  </div>
                )}
                {statusText && (
                  <div className="mt-3 rounded-xl border border-cyan-800/40 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
                    {statusText}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">What Start Service Does</div>
                <div className="mt-3 space-y-2 text-xs text-zinc-400">
                  <div>Move Lumina control to the assigned control screen.</div>
                  <div>Open audience output fullscreen on the assigned audience screen.</div>
                  <div>Open stage display fullscreen on the assigned stage screen.</div>
                </div>
              </div>

              {onLaunchNdiWindow && (
                <div className="rounded-2xl border border-violet-800/40 bg-violet-950/20 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">NDI / vMix Capture</div>
                  <div className="mt-2 text-xs text-zinc-400">
                    Opens the audience output as a 1920×1080 window named <span className="font-mono text-zinc-300">Lumina Output (Projector)</span> — select it by name in NDI Tools Screen Capture or vMix Window Capture. No display assignment needed.
                  </div>
                  <button
                    onClick={() => {
                      void runBusyAction('ndi', () => { onLaunchNdiWindow(); });
                    }}
                    disabled={busyAction !== null}
                    className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
                      ndiWindowOpen
                        ? 'border-violet-500/60 bg-violet-600 text-white hover:bg-violet-500'
                        : 'border-violet-700/50 bg-violet-950/40 text-violet-300 hover:border-violet-500 hover:bg-violet-900/40'
                    }`}
                  >
                    <MonitorIcon className="h-3.5 w-3.5" />
                    {ndiWindowOpen ? 'Close NDI Window' : 'Launch for NDI Capture'}
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-900 px-5 py-4">
              <div className="grid gap-2">
                <button
                  onClick={() => {
                    void runBusyAction('save', onSaveMapping);
                  }}
                  disabled={busyAction !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-zinc-500"
                >
                  <CheckIcon className="h-3.5 w-3.5" /> {busyAction === 'save' ? 'Saving' : 'Save Mapping'}
                </button>
                <button
                  onClick={() => {
                    void runBusyAction('start', onStartService);
                  }}
                  disabled={busyAction !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-emerald-500"
                >
                  <PlayIcon className="h-3.5 w-3.5" /> {busyAction === 'start' ? 'Starting Service' : 'Start Service'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
