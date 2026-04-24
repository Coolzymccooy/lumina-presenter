import React from 'react';

interface NdiStatusBadgeProps {
  ndiState: NdiStatus;
  /** Operator-requested audio embed flag (workspaceSettings.ndiAudioEnabled). */
  audioEnabled: boolean;
  /** Active audio warning (e.g. 'iframe-media') — renders amber state instead of green. */
  audioWarningCode?: string | null;
}

interface SourceDescriptor {
  id: string;
  short: string;
  full: string;
}

// Broadcast-grade NDI status badge. Replaces the full command surface
// previously living in the in-transport NDI dropdown (which is now entirely
// in Tools → NDI + the NDI Info modal). Always visible so the operator can:
//   - Read per-source tally + audio state at a glance when live
//   - See NDI OFF state when inactive (and still click to open settings)
// Mirrors the vMix / Blackmagic pattern of persistent status in operator chrome.
export const NdiStatusBadge = React.memo(function NdiStatusBadge({
  ndiState,
  audioEnabled,
  audioWarningCode,
}: NdiStatusBadgeProps) {
  if (!ndiState?.active) {
    return (
      <div
        data-testid="ndi-status-badge"
        data-active="false"
        className="flex items-center h-9 gap-2 px-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 text-[10px] font-bold tracking-wider"
        title="NDI is off. Click to open NDI settings, or use Tools → NDI."
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-700" />
        <span className="uppercase text-zinc-500 text-[9px] tracking-[0.2em]">NDI</span>
        <span className="uppercase text-zinc-500 text-[9px] tracking-[0.2em]">Off</span>
      </div>
    );
  }

  const sources = resolveSources(ndiState);
  const audioFps = ndiState.audio?.framesPerSecond ?? 0;
  const audioActive = !!ndiState.audioEnabled && audioFps > 0;
  const audioState: 'off' | 'warning' | 'live' | 'silent' = !ndiState.audioEnabled
    ? 'off'
    : audioWarningCode === 'iframe-media'
      ? 'warning'
      : audioActive
        ? 'live'
        : 'silent';

  return (
    <div
      data-testid="ndi-status-badge"
      className="flex items-center h-9 gap-2 px-2.5 rounded-lg border border-violet-800/50 bg-violet-950/30 text-[10px] font-bold tracking-wider"
      title={buildTitle(sources, audioState, audioFps, audioEnabled)}
    >
      <span className="uppercase text-violet-300 text-[9px] tracking-[0.2em]">NDI</span>
      <span className="h-5 w-px bg-violet-800/60" aria-hidden="true" />
      <div className="flex items-center gap-1.5">
        {sources.map((src) => {
          const entry = ndiState.sources.find((s) => s.id === src.id);
          const on = !!entry?.active;
          const err = !!entry?.lastError;
          const dotCls = err
            ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
            : on
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
              : 'bg-zinc-700';
          const labelCls = err
            ? 'text-rose-300'
            : on
              ? 'text-emerald-200'
              : 'text-zinc-500';
          return (
            <span
              key={src.id}
              data-source={src.id}
              data-active={on ? 'true' : 'false'}
              data-error={err ? 'true' : 'false'}
              className={`flex items-center gap-1 ${labelCls}`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotCls}`} />
              <span className="text-[9px] uppercase tracking-[0.2em]">{src.short}</span>
            </span>
          );
        })}
      </div>
      <span className="h-5 w-px bg-violet-800/60" aria-hidden="true" />
      <AudioStatus state={audioState} fps={audioFps} />
    </div>
  );
});

function AudioStatus({ state, fps }: { state: 'off' | 'warning' | 'live' | 'silent'; fps: number }) {
  const dotCls =
    state === 'live'
      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
      : state === 'warning'
        ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
        : state === 'silent'
          ? 'border border-zinc-600'
          : 'bg-zinc-700';
  const labelCls =
    state === 'live'
      ? 'text-emerald-200'
      : state === 'warning'
        ? 'text-amber-200'
        : 'text-zinc-500';
  const text =
    state === 'off'
      ? 'AUDIO OFF'
      : state === 'warning'
        ? 'IFRAME'
        : state === 'silent'
          ? 'SILENT'
          : `${Math.round(fps)} fps`;
  return (
    <span
      data-testid="ndi-status-audio"
      data-state={state}
      className={`flex items-center gap-1 ${labelCls}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotCls}`} />
      <span className="text-[9px] uppercase tracking-[0.2em]">{text}</span>
    </span>
  );
}

function resolveSources(ndiState: NdiStatus): SourceDescriptor[] {
  // When broadcast mode is off, only Program is live; hide the other two to
  // avoid showing always-OFF rows that aren't actionable. When broadcast is
  // on, show all three in the fixed Program / Lyrics / LowerThirds order.
  const all: SourceDescriptor[] = [
    { id: 'program', short: 'P', full: 'Lumina-Program' },
    { id: 'lyrics', short: 'L', full: 'Lumina-Lyrics' },
    { id: 'lowerThirds', short: 'LT', full: 'Lumina-LowerThirds' },
  ];
  if (!ndiState.broadcastMode) return all.slice(0, 1);
  return all;
}

function buildTitle(
  sources: SourceDescriptor[],
  audioState: 'off' | 'warning' | 'live' | 'silent',
  fps: number,
  audioEnabled: boolean,
): string {
  const lines: string[] = [];
  lines.push('NDI Status');
  sources.forEach((s) => lines.push(`  ${s.full}`));
  lines.push('');
  if (!audioEnabled) {
    lines.push('Audio embed: disabled (Tools → NDI → Embed Program Audio)');
  } else if (audioState === 'warning') {
    lines.push('Audio: iframe embed — YouTube / Vimeo audio is not tappable');
  } else if (audioState === 'silent') {
    lines.push('Audio: enabled but no frames flowing (local MP4 required)');
  } else {
    lines.push(`Audio: ${Math.round(fps)} fps`);
  }
  return lines.join('\n');
}
