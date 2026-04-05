import React from 'react';
import {
  CheckIcon,
  QrCodeIcon,
  MonitorIcon,
  SparklesIcon,
  Settings,
  HelpIcon,
  CopyIcon,
} from '../Icons';

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
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onHomeClick: () => void;

  // Telemetry
  liveSessionId: string;
  syncPendingCount: number;
  activeTargetConnectionCount: number;
  targetConnectionRoleCount: number;
  connectionCountsByRole: Record<string, number>;

  // Output controls
  isOutputLive: boolean;
  onToggleOutput: () => void;
  isStageDisplayLive: boolean;
  onToggleStageDisplay: () => void;
  blackout: boolean;
  onToggleBlackout: () => void;

  // Right dock
  isRightDockOpen: boolean;
  onToggleRightDock: () => void;

  // URL copy helpers
  remoteControlUrl: string;
  stageDisplayUrl: string;
  onCopyUrl: (url: string, message?: string) => void;

  // Update
  desktopUpdateStatus: DesktopUpdateStatus;
  showDesktopUpdateBanner: boolean;
  onUpdateCheckNow: () => void;
  onUpdateInstallNow: () => void;
  onUpdateOpenReleases: () => void;
  onUpdateDismiss: () => void;

  // Nav
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

const MODE_BUTTONS: { label: string; mode: ViewMode }[] = [
  { label: 'BUILDER', mode: 'BUILDER' },
  { label: 'PRESENTER', mode: 'PRESENTER' },
  { label: 'STAGE', mode: 'STAGE' },
];

export function AppHeader({
  isElectronShell,
  viewMode,
  onViewModeChange,
  onHomeClick,
  liveSessionId,
  syncPendingCount,
  activeTargetConnectionCount,
  targetConnectionRoleCount,
  connectionCountsByRole,
  isOutputLive,
  onToggleOutput,
  isStageDisplayLive,
  onToggleStageDisplay,
  blackout,
  onToggleBlackout,
  isRightDockOpen,
  onToggleRightDock,
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
}: AppHeaderProps) {
  const connectionsMetExpected = activeTargetConnectionCount >= targetConnectionRoleCount;

  return (
    <>
      {/* ── MAIN HEADER ── */}
      <header className="h-14 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 z-[100] shadow-xl">

        {/* LEFT: BRAND + MODE BAR */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <button
            onClick={onHomeClick}
            className="flex items-center gap-3 cursor-pointer hover:opacity-100 transition-all group"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-110 transition-transform">
              <span className="text-white font-black text-xs">L</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-[0.2em] leading-tight">LUMINA</span>
              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Studio v2.1</span>
            </div>
          </button>

          <div className="h-6 w-px bg-zinc-800" />

          {/* Mode switcher — now 3 modes */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-zinc-800/50">
            {MODE_BUTTONS.map(({ label, mode }) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                  viewMode === mode
                    ? 'bg-zinc-800 text-white shadow-inner'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* CENTRE: TELEMETRY STRIP */}
        <div className="hidden lg:flex items-center gap-4 bg-zinc-900/20 px-4 py-1.5 rounded-full border border-zinc-800/30">
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Session ID</span>
            <span className="text-[10px] font-mono text-zinc-400" data-testid="studio-session-id">
              {liveSessionId}
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${navigator.onLine ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className={`text-[9px] font-black tracking-widest ${navigator.onLine ? 'text-emerald-500/80' : 'text-amber-500/80'}`}>
              {navigator.onLine ? 'SYSTEM ONLINE' : 'OFFLINE MODE'}
            </span>
          </div>

          {syncPendingCount > 0 && (
            <>
              <div className="h-4 w-px bg-zinc-800" />
              <span className="text-[9px] font-black text-amber-500 animate-pulse tracking-widest">
                SYNCING {syncPendingCount}
              </span>
            </>
          )}

          <div className="h-4 w-px bg-zinc-800" />

          <div
            className="flex items-center gap-2"
            title={`controller:${connectionCountsByRole.controller || 0} output:${connectionCountsByRole.output || 0} stage:${connectionCountsByRole.stage || 0} remote:${connectionCountsByRole.remote || 0}`}
          >
            <span className={`text-[9px] font-black tracking-widest ${connectionsMetExpected ? 'text-emerald-400' : 'text-amber-400'}`}>
              CONNECTIONS {activeTargetConnectionCount}/{targetConnectionRoleCount}
            </span>
          </div>
        </div>

        {/* RIGHT: COMMAND CLUSTER */}
        <div className="flex items-center gap-1.5">
          {/* Update badge (downloaded) */}
          {isElectronShell && desktopUpdateStatus.state === 'downloaded' && (
            <button
              onClick={onUpdateInstallNow}
              className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-600/60 bg-emerald-950/30 text-emerald-300 text-[10px] font-black tracking-widest hover:bg-emerald-950/50 transition-all"
              title={desktopUpdateStatus.message || 'Update ready to install'}
            >
              <CheckIcon className="w-3.5 h-3.5" /> UPDATE READY
            </button>
          )}

          {/* Separator */}
          <div className="h-6 w-px bg-zinc-800 mx-1" />

          {/* PROJECTION / LAUNCH LIVE */}
          <button
            onClick={onToggleOutput}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all border shadow-lg ${
              isOutputLive
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-950/50'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <MonitorIcon className="w-3.5 h-3.5" />
            {isOutputLive ? 'PROJECTION ON' : 'LAUNCH LIVE'}
          </button>

          {/* BLACKOUT */}
          <button
            onClick={onToggleBlackout}
            className={`px-3 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all border ${
              blackout
                ? 'bg-red-900 border-red-700 text-red-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
            }`}
            title="Toggle Blackout"
          >
            BLACKOUT
          </button>

          {/* STAGE display */}
          <button
            onClick={onToggleStageDisplay}
            className={`px-3 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all border ${
              isStageDisplayLive
                ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-950/50'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            STAGE
          </button>

          <div className="h-6 w-px bg-zinc-800 mx-1" />

          {/* URL copy helpers */}
          <button
            onClick={() => onCopyUrl(remoteControlUrl, 'Remote Control URL copied!')}
            className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all border border-transparent hover:border-zinc-700"
            title="Copy Remote URL"
          >
            <CopyIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onCopyUrl(stageDisplayUrl, 'Stage URL copied!')}
            className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all border border-transparent hover:border-zinc-700"
            title="Copy Stage URL"
          >
            <MonitorIcon className="w-4 h-4" />
          </button>

          {/* Settings + Help */}
          <button
            onClick={onOpenSettings}
            className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all border border-transparent hover:border-zinc-700"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenHelp}
            className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
          >
            <HelpIcon className="w-4 h-4" />
          </button>

          {/* Right Dock toggle */}
          <button
            onClick={onToggleRightDock}
            className={`ml-1 p-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all border ${
              isRightDockOpen
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white'
            }`}
            title="Toggle right panel (AI / Connect / Aether)"
          >
            <SparklesIcon className="w-4 h-4 text-purple-400" />
          </button>
        </div>
      </header>

      {/* ── DESKTOP UPDATE BANNER ── */}
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
              <div className="mt-1 text-xs text-zinc-400 truncate">
                {desktopUpdateStatus.message || 'Lumina will prompt you when the update is ready.'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {desktopUpdateStatus.state === 'downloaded' ? (
                <button
                  onClick={onUpdateInstallNow}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-black tracking-widest hover:bg-emerald-500 transition-all"
                >
                  RESTART & INSTALL
                </button>
              ) : (
                <button
                  onClick={onUpdateCheckNow}
                  className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-200 text-[10px] font-black tracking-widest hover:border-zinc-500 transition-all"
                >
                  CHECK NOW
                </button>
              )}
              <button
                onClick={onUpdateOpenReleases}
                className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-[10px] font-black tracking-widest hover:border-zinc-500 transition-all"
              >
                RELEASE NOTES
              </button>
              <button
                onClick={onUpdateDismiss}
                className="px-3 py-2 rounded-lg border border-zinc-800 text-zinc-500 text-[10px] font-black tracking-widest hover:text-zinc-300 hover:border-zinc-600 transition-all"
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
