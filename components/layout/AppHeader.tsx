import React from 'react';
import {
  CheckIcon,
  MonitorIcon,
  SparklesIcon,
  Settings,
  HelpIcon,
  CopyIcon,
} from '../Icons';
import { Tooltip } from '../ui';
import { StatusHub } from './StatusHub';

type DesktopUpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';

export type DesktopUpdateStatus = {
  state: DesktopUpdateState;
  version?: string | null;
  progress?: number;
  message?: string;
  releaseName?: string | null;
};

export type ViewMode = 'BUILDER' | 'PRESENTER' | 'STAGE';

export interface AppHeaderProps {
  isElectronShell: boolean;
  isCompactLayout?: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onHomeClick: () => void;
  isPresenterBeta?: boolean;
  liveSessionId: string;
  isSessionIdFallback?: boolean;
  syncPendingCount: number;
  syncIssue?: string | null;
  onOpenSyncGuidance?: () => void;
  activeTargetConnectionCount: number;
  targetConnectionRoleCount: number;
  connectionCountsByRole: Record<string, number>;
  isOutputLive: boolean;
  onToggleOutput: () => void;
  isStageDisplayLive: boolean;
  onToggleStageDisplay: () => void;
  isRightDockOpen: boolean;
  onToggleRightDock: () => void;
  rightDockAnchorRef?: React.RefObject<HTMLButtonElement | null>;
  remoteControlUrl: string;
  stageDisplayUrl: string;
  onCopyUrl: (url: string, message?: string) => void;
  desktopUpdateStatus: DesktopUpdateStatus;
  showDesktopUpdateBanner: boolean;
  onUpdateCheckNow: () => void;
  onUpdateInstallNow: () => void;
  onUpdateOpenReleases: () => void;
  onUpdateDismiss: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenGuidedTours?: () => void;
}

const MODE_BUTTONS: { label: string; mode: ViewMode }[] = [
  { label: 'BUILDER', mode: 'BUILDER' },
  { label: 'PRESENTER', mode: 'PRESENTER' },
  { label: 'STAGE', mode: 'STAGE' },
];

const getModeButtonClass = (mode: ViewMode, activeMode: ViewMode) => {
  const base = 'px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all border';
  const inactive = 'border-transparent text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/70';

  if (mode !== activeMode) {
    return `${base} ${inactive}`;
  }

  if (mode === 'BUILDER') {
    return `${base} border-zinc-500/70 bg-[linear-gradient(180deg,rgba(113,113,122,0.86)_0%,rgba(63,63,70,0.96)_42%,rgba(24,24,27,1)_100%)] text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),inset_0_-1px_0_rgba(0,0,0,0.9),0_0_18px_rgba(161,161,170,0.2)]`;
  }

  return `${base} border-zinc-700 bg-zinc-800 text-white shadow-inner`;
};

export function AppHeader({
  isElectronShell,
  isCompactLayout = false,
  viewMode,
  onViewModeChange,
  onHomeClick,
  isPresenterBeta,
  liveSessionId,
  isSessionIdFallback,
  syncPendingCount,
  syncIssue,
  onOpenSyncGuidance,
  activeTargetConnectionCount,
  targetConnectionRoleCount,
  connectionCountsByRole,
  isOutputLive,
  onToggleOutput,
  isStageDisplayLive,
  onToggleStageDisplay,
  isRightDockOpen,
  onToggleRightDock,
  rightDockAnchorRef,
  remoteControlUrl,
  stageDisplayUrl,
  onCopyUrl,
  desktopUpdateStatus,
  showDesktopUpdateBanner,
  onUpdateCheckNow,
  onUpdateInstallNow,
  onUpdateOpenReleases,
  onUpdateDismiss,
  onOpenSettings,
  onOpenHelp,
  onOpenGuidedTours,
}: AppHeaderProps) {
  if (isCompactLayout) {
    return (
      <>
        <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/88 px-3 py-2 shadow-xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                onClick={onHomeClick}
                className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 transition-all hover:bg-white/5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-900/40">
                  <span className="text-xs font-black text-white">L</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black leading-tight tracking-[0.18em] text-white">LUMINA</div>
                  <div className="truncate text-[9px] font-bold uppercase tracking-widest text-zinc-600">Studio v2.1</div>
                </div>
              </button>

              <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                <div className="flex w-max items-center rounded-xl border border-zinc-800/50 bg-black/40 p-1">
                  {MODE_BUTTONS.map(({ label, mode }) => (
                    <button
                      key={mode}
                      data-testid={`header-mode-${mode.toLowerCase()}`}
                      onClick={() => onViewModeChange(mode)}
                      className={getModeButtonClass(mode, viewMode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                data-testid="header-launch-live-btn"
                onClick={onToggleOutput}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[9px] font-black tracking-widest transition-all shadow-lg ${
                  isOutputLive
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-emerald-950/50'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <MonitorIcon className="h-3.5 w-3.5" />
                {isOutputLive ? 'PROJECTION ON' : 'LAUNCH LIVE'}
              </button>

              <button
                data-testid="header-stage-btn"
                onClick={onToggleStageDisplay}
                className={`rounded-xl border px-3 py-2 text-[9px] font-black tracking-widest transition-all ${
                  isStageDisplayLive
                    ? 'border-purple-500 bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                STAGE
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-2">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="w-max min-w-full">
                <StatusHub
                  liveSessionId={liveSessionId}
                  isSessionIdFallback={isSessionIdFallback}
                  isOnline={typeof navigator !== 'undefined' ? navigator.onLine : true}
                  syncPendingCount={syncPendingCount}
                  cloudSyncStatus={syncIssue ? 'error' : 'ok'}
                  cloudSyncMessage={syncIssue}
                  connections={{ current: activeTargetConnectionCount, total: targetConnectionRoleCount }}
                  connectionCountsByRole={connectionCountsByRole}
                  onSessionIdClick={onOpenSettings}
                  onCloudSyncIssueClick={onOpenSyncGuidance}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Tooltip content="Copy Remote Control URL" placement="bottom">
                <button
                  onClick={() => onCopyUrl(remoteControlUrl, 'Remote Control URL copied!')}
                  className="rounded-xl border border-zinc-800 p-2.5 text-zinc-500 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content="Copy Stage Display URL" placement="bottom">
                <button
                  onClick={() => onCopyUrl(stageDisplayUrl, 'Stage URL copied!')}
                  className="rounded-xl border border-zinc-800 p-2.5 text-zinc-500 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                >
                  <MonitorIcon className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content="Settings" placement="bottom">
                <button
                  onClick={onOpenSettings}
                  className="rounded-xl border border-zinc-800 p-2.5 text-zinc-500 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </Tooltip>
              {onOpenGuidedTours && (
                <Tooltip content="Guided tours - learn Lumina step by step" placement="bottom">
                  <button
                    data-testid="header-guided-tours-btn"
                    onClick={onOpenGuidedTours}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-700/50 bg-indigo-950/30 px-3 py-2 text-[9px] font-black tracking-widest text-indigo-300 transition-all hover:border-indigo-600/70 hover:bg-indigo-900/50"
                  >
                    <HelpIcon className="h-3.5 w-3.5" />
                    Tours
                  </button>
                </Tooltip>
              )}
              <Tooltip content="Help & documentation" placement="bottom">
                <button
                  onClick={onOpenHelp}
                  className="rounded-xl border border-zinc-800 p-2.5 text-zinc-500 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                >
                  <HelpIcon className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content="AI assistant, connections & Aether cast" variant="ai" placement="bottom">
                <button
                  ref={rightDockAnchorRef}
                  data-testid="header-right-dock-btn"
                  onClick={onToggleRightDock}
                  className={`rounded-xl border p-2.5 text-[10px] font-black tracking-widest transition-all ${
                    isRightDockOpen
                      ? 'border-zinc-700 bg-zinc-800 text-white'
                      : 'border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <SparklesIcon className="h-4 w-4 text-purple-400" />
                </button>
              </Tooltip>
            </div>
          </div>
        </header>

        {showDesktopUpdateBanner && (
          <div className="mx-4 mt-3 rounded-2xl border border-cyan-900/60 bg-zinc-950/95 shadow-2xl shadow-black/30">
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Desktop Update</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">
                  {desktopUpdateStatus.state === 'downloaded'
                    ? `Version ${desktopUpdateStatus.version || 'update'} is ready to install.`
                    : desktopUpdateStatus.state === 'downloading'
                      ? `Downloading ${desktopUpdateStatus.version || 'update'}${desktopUpdateStatus.progress ? ` (${desktopUpdateStatus.progress}%)` : ''}.`
                      : desktopUpdateStatus.state === 'available'
                        ? `New version ${desktopUpdateStatus.version || ''} found.`
                        : 'Desktop update check failed.'}
                </div>
                <div className="mt-1 truncate text-xs text-zinc-400">
                  {desktopUpdateStatus.message || 'Lumina will prompt you when the update is ready.'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {desktopUpdateStatus.state === 'downloaded' ? (
                  <button
                    onClick={onUpdateInstallNow}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black tracking-widest text-white transition-all hover:bg-emerald-500"
                  >
                    RESTART & INSTALL
                  </button>
                ) : (
                  <button
                    onClick={onUpdateCheckNow}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-[10px] font-black tracking-widest text-zinc-200 transition-all hover:border-zinc-500"
                  >
                    CHECK NOW
                  </button>
                )}
                <button
                  onClick={onUpdateOpenReleases}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-[10px] font-black tracking-widest text-zinc-300 transition-all hover:border-zinc-500"
                >
                  RELEASE NOTES
                </button>
                <button
                  onClick={onUpdateDismiss}
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-[10px] font-black tracking-widest text-zinc-500 transition-all hover:border-zinc-600 hover:text-zinc-300"
                >
                  LATER
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <header className="h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 shadow-xl backdrop-blur-md flex z-[100]">
        <div className="flex items-center gap-4">
          <button
            onClick={onHomeClick}
            className="group flex cursor-pointer items-center gap-3 transition-all hover:opacity-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-900/40 transition-transform group-hover:scale-110">
              <span className="text-xs font-black text-white">L</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black leading-tight tracking-[0.2em] text-white">LUMINA</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Studio v2.1</span>
            </div>
          </button>

          <div className="h-6 w-px bg-zinc-800" />

          <div className="flex rounded-xl border border-zinc-800/50 bg-black/40 p-1">
            {MODE_BUTTONS.map(({ label, mode }) => (
              <button
                key={mode}
                data-testid={`header-mode-${mode.toLowerCase()}`}
                onClick={() => onViewModeChange(mode)}
                className={getModeButtonClass(mode, viewMode)}
              >
                {label}
              </button>
            ))}
          </div>

          {isPresenterBeta && (
            <div className="hidden items-center rounded-full border border-cyan-800/50 bg-cyan-950/25 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200 xl:flex">
              Presenter Beta
            </div>
          )}
        </div>

        <div className="hidden items-center lg:flex">
          <StatusHub
            liveSessionId={liveSessionId}
            isSessionIdFallback={isSessionIdFallback}
            isOnline={typeof navigator !== 'undefined' ? navigator.onLine : true}
            syncPendingCount={syncPendingCount}
            cloudSyncStatus={syncIssue ? 'error' : 'ok'}
            cloudSyncMessage={syncIssue}
            connections={{ current: activeTargetConnectionCount, total: targetConnectionRoleCount }}
            connectionCountsByRole={connectionCountsByRole}
            onSessionIdClick={onOpenSettings}
            onCloudSyncIssueClick={onOpenSyncGuidance}
          />
        </div>

        <div className="flex items-center gap-1.5">
          {isElectronShell && desktopUpdateStatus.state === 'downloaded' && (
            <button
              onClick={onUpdateInstallNow}
              className="hidden items-center gap-2 rounded-xl border border-emerald-600/60 bg-emerald-950/30 px-3 py-1.5 text-[10px] font-black tracking-widest text-emerald-300 transition-all hover:bg-emerald-950/50 xl:flex"
              title={desktopUpdateStatus.message || 'Update ready to install'}
            >
              <CheckIcon className="h-3.5 w-3.5" /> UPDATE READY
            </button>
          )}

          <div className="mx-1 h-6 w-px bg-zinc-800" />

          <button
            data-testid="header-launch-live-btn"
            onClick={onToggleOutput}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black tracking-widest transition-all shadow-lg ${
              isOutputLive
                ? 'border-emerald-500 bg-emerald-600 text-white shadow-emerald-950/50'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <MonitorIcon className="h-3.5 w-3.5" />
            {isOutputLive ? 'PROJECTION ON' : 'LAUNCH LIVE'}
          </button>

          <Tooltip
            content="Stage Display - shows speaker notes, timers, and run order on the operator screen"
            variant="info"
            placement="bottom"
          >
            <button
              data-testid="header-stage-btn"
              onClick={onToggleStageDisplay}
              className={`rounded-xl border px-3 py-2 text-[10px] font-black tracking-widest transition-all ${
                isStageDisplayLive
                  ? 'border-purple-500 bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              STAGE
            </button>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-zinc-800" />

          <Tooltip content="Copy Remote Control URL" placement="bottom">
            <button
              onClick={() => onCopyUrl(remoteControlUrl, 'Remote Control URL copied!')}
              className="rounded-xl border border-transparent p-2.5 text-zinc-500 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <CopyIcon className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Copy Stage Display URL" placement="bottom">
            <button
              onClick={() => onCopyUrl(stageDisplayUrl, 'Stage URL copied!')}
              className="rounded-xl border border-transparent p-2.5 text-zinc-500 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <MonitorIcon className="h-4 w-4" />
            </button>
          </Tooltip>

          <Tooltip content="Settings" placement="bottom">
            <button
              onClick={onOpenSettings}
              className="rounded-xl border border-transparent p-2.5 text-zinc-500 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </button>
          </Tooltip>
          {onOpenGuidedTours && (
            <Tooltip content="Guided tours - learn Lumina step by step" placement="bottom">
              <button
                data-testid="header-guided-tours-btn"
                onClick={onOpenGuidedTours}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-700/50 bg-indigo-950/30 px-3 py-2 text-[10px] font-black tracking-widest text-indigo-300 transition-all hover:border-indigo-600/70 hover:bg-indigo-900/50"
              >
                <HelpIcon className="h-3.5 w-3.5" />
                Tours
              </button>
            </Tooltip>
          )}
          <Tooltip content="Help & documentation" placement="bottom">
            <button
              onClick={onOpenHelp}
              className="rounded-xl p-2.5 text-zinc-500 transition-all hover:bg-zinc-800 hover:text-white"
            >
              <HelpIcon className="h-4 w-4" />
            </button>
          </Tooltip>

          <Tooltip content="AI assistant, connections & Aether cast" variant="ai" placement="bottom">
            <button
              ref={rightDockAnchorRef}
              data-testid="header-right-dock-btn"
              onClick={onToggleRightDock}
              className={`ml-1 rounded-xl border p-2.5 text-[10px] font-black tracking-widest transition-all ${
                isRightDockOpen
                  ? 'border-zinc-700 bg-zinc-800 text-white'
                  : 'border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <SparklesIcon className="h-4 w-4 text-purple-400" />
            </button>
          </Tooltip>
        </div>
      </header>

      {showDesktopUpdateBanner && (
        <div className="mx-4 mt-3 rounded-2xl border border-cyan-900/60 bg-zinc-950/95 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Desktop Update</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">
                {desktopUpdateStatus.state === 'downloaded'
                  ? `Version ${desktopUpdateStatus.version || 'update'} is ready to install.`
                  : desktopUpdateStatus.state === 'downloading'
                    ? `Downloading ${desktopUpdateStatus.version || 'update'}${desktopUpdateStatus.progress ? ` (${desktopUpdateStatus.progress}%)` : ''}.`
                    : desktopUpdateStatus.state === 'available'
                      ? `New version ${desktopUpdateStatus.version || ''} found.`
                      : 'Desktop update check failed.'}
              </div>
              <div className="mt-1 truncate text-xs text-zinc-400">
                {desktopUpdateStatus.message || 'Lumina will prompt you when the update is ready.'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {desktopUpdateStatus.state === 'downloaded' ? (
                <button
                  onClick={onUpdateInstallNow}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black tracking-widest text-white transition-all hover:bg-emerald-500"
                >
                  RESTART & INSTALL
                </button>
              ) : (
                <button
                  onClick={onUpdateCheckNow}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-[10px] font-black tracking-widest text-zinc-200 transition-all hover:border-zinc-500"
                >
                  CHECK NOW
                </button>
              )}
              <button
                onClick={onUpdateOpenReleases}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-[10px] font-black tracking-widest text-zinc-300 transition-all hover:border-zinc-500"
              >
                RELEASE NOTES
              </button>
              <button
                onClick={onUpdateDismiss}
                className="rounded-lg border border-zinc-800 px-3 py-2 text-[10px] font-black tracking-widest text-zinc-500 transition-all hover:border-zinc-600 hover:text-zinc-300"
              >
                LATER
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
