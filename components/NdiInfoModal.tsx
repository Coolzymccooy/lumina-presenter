import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface NdiInfoModalProps {
  open: boolean;
  onClose: () => void;
  ndiState: NdiStatus;
  menuState: ToolsNdiMenuState | null;
  audioWarningCode?: string | null;
  onToggleActive: () => void;
  onToggleBroadcast: () => void;
  onToggleAudio: () => void;
  onSetResolution: (value: ToolsNdiResolution) => void;
}

// Desktop-grade NDI settings & info dialog. Houses the descriptive text
// that used to live in the in-transport dropdown; surfaced from:
//   - Tools → NDI → NDI Info…  (menu command)
//   - Clicking the NdiStatusBadge in the transport
// The toggles here reuse the same command handlers as the native menu, so
// behavior stays identical whether the operator uses keyboard menus or the
// GUI dialog.
export function NdiInfoModal({
  open,
  onClose,
  ndiState,
  menuState,
  audioWarningCode,
  onToggleActive,
  onToggleBroadcast,
  onToggleAudio,
  onSetResolution,
}: NdiInfoModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const active = ndiState?.active === true;
  const audioEnabled = !!menuState?.audioEnabled;
  const broadcastMode = !!menuState?.broadcastMode;
  const resolution: ToolsNdiResolution = menuState?.resolution ?? '1080p';

  return createPortal(
    <div
      data-testid="ndi-info-modal"
      role="dialog"
      aria-modal="true"
      aria-label="NDI Settings"
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[92vw] max-h-[88vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[linear-gradient(160deg,rgba(28,28,34,0.98),rgba(12,12,16,1))] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-zinc-600'}`} />
            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-200">NDI Output</h2>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-emerald-300' : 'text-zinc-500'}`}>
              {active ? 'Live' : 'Off'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-7 px-2.5 rounded border border-zinc-700 bg-zinc-900 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:border-zinc-500"
            aria-label="Close"
          >
            Close
          </button>
        </header>

        <div className="p-5 space-y-4">
          <Row label="NDI Output" description="Start or stop the NDI broadcast. When off, no NDI sources are visible on the local network.">
            <ToggleButton checked={active} onClick={onToggleActive} onLabel="Live" offLabel="Start" />
          </Row>

          <Row
            label="Broadcast Mode (Fill + Key)"
            description="Adds transparent Lumina-Lyrics and Lumina-LowerThirds sources for vMix / OBS / hardware switchers. Leave off for direct single-source streaming."
            note={active ? 'Toggling while live will briefly restart NDI.' : undefined}
          >
            <ToggleButton checked={broadcastMode} onClick={onToggleBroadcast} onLabel="On" offLabel="Off" />
          </Row>

          <Row
            label="Resolution"
            description="Output dimensions for all NDI scenes. 1080p is the safe default; 4K needs a strong machine and gigabit network."
            note={active ? 'Changing while live will briefly restart NDI.' : undefined}
          >
            <ResolutionSelect value={resolution} onChange={onSetResolution} />
          </Row>

          <Row
            label="Embed Program Audio"
            description="Routes Program audio from local video/media elements onto the Lumina-Program NDI feed. Lyrics and LowerThirds stay video-only. YouTube, Vimeo, and SoundCloud embeds remain video-only because browser iframes cannot be tapped."
            secondary="Best for local MP4 playback on Program. For sermon or worship mix, route audio separately from your mixer into the streaming PC or switcher."
            note={active ? 'Toggling while live will briefly restart NDI.' : undefined}
          >
            <ToggleButton checked={audioEnabled} onClick={onToggleAudio} onLabel="On" offLabel="Off" />
          </Row>

          {active && (
            <section className="rounded-xl border border-zinc-800 bg-black/40 p-4 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Sources</h3>
              <ul className="space-y-1.5">
                {ndiState.sources.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          s.lastError
                            ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                            : s.active
                              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                              : 'bg-zinc-700'
                        }`}
                      />
                      <span className={s.active ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}>{s.sourceName}</span>
                      <span className="text-[9px] uppercase tracking-wider text-zinc-600">{s.fillKey ? 'Fill + Key' : 'Fill'}</span>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase tracking-[0.18em] ${
                        s.lastError ? 'text-rose-300' : s.active ? 'text-emerald-300' : 'text-zinc-600'
                      }`}
                    >
                      {s.lastError ? 'Error' : s.active ? 'Live' : 'Off'}
                    </span>
                  </li>
                ))}
              </ul>

              {audioEnabled && (
                <div className="pt-2 mt-1 border-t border-zinc-800 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        audioWarningCode === 'iframe-media'
                          ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                          : (ndiState.audio?.framesPerSecond ?? 0) > 0
                            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                            : 'border border-zinc-600'
                      }`}
                    />
                    <span className="text-zinc-300">Program Audio</span>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase tracking-[0.18em] ${
                      audioWarningCode === 'iframe-media'
                        ? 'text-amber-300'
                        : (ndiState.audio?.framesPerSecond ?? 0) > 0
                          ? 'text-emerald-300'
                          : 'text-zinc-600'
                    }`}
                  >
                    {audioWarningCode === 'iframe-media'
                      ? 'Iframe — Audio Unavailable'
                      : (ndiState.audio?.framesPerSecond ?? 0) > 0
                        ? `${Math.round(ndiState.audio?.framesPerSecond ?? 0)} fps`
                        : 'Silent'}
                  </span>
                </div>
              )}
            </section>
          )}

          <p className="text-[10px] text-zinc-600 leading-relaxed">
            These settings also live under <span className="text-zinc-400">Tools → NDI</span>. Changes sync both places.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface RowProps {
  label: string;
  description: string;
  secondary?: string;
  note?: string;
  children: React.ReactNode;
}

function Row({ label, description, secondary, note, children }: RowProps) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-zinc-800 bg-black/30">
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-300">{label}</span>
        <span className="text-[11px] leading-relaxed text-zinc-500">{description}</span>
        {secondary && <span className="text-[11px] leading-relaxed text-zinc-500">{secondary}</span>}
        {note && <span className="text-[10px] leading-relaxed text-violet-400/80 italic">{note}</span>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleButton({ checked, onClick, onLabel, offLabel }: { checked: boolean; onClick: () => void; onLabel: string; offLabel: string }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 min-w-[70px] px-3 rounded-lg border text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
        checked
          ? 'border-violet-600/70 bg-violet-950/40 text-violet-200'
          : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
      }`}
      aria-pressed={checked}
    >
      {checked ? onLabel : offLabel}
    </button>
  );
}

function ResolutionSelect({ value, onChange }: { value: ToolsNdiResolution; onChange: (value: ToolsNdiResolution) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ToolsNdiResolution)}
      style={{ colorScheme: 'dark' }}
      className="h-8 px-2 rounded-lg border border-zinc-700 bg-zinc-900 text-[10px] font-bold uppercase tracking-wider text-zinc-200 focus:outline-none focus:border-violet-600"
    >
      <option value="720p">720p (1280×720)</option>
      <option value="1080p">1080p (1920×1080)</option>
      <option value="4k">4K (3840×2160)</option>
    </select>
  );
}
