import { useEffect, useRef } from 'react';

// Bridges the native application menu (File / View / Transport / Window /
// Help etc.) with the renderer's workspace + session state. App.tsx owns
// the source of truth (blackout, mute, routing mode, view mode, window-
// open flags, last-saved timestamp); this hook pushes a flat view of that
// state to main.cjs whenever it changes so menu check / radio / label
// states stay in sync, and routes incoming commands back into app-level
// handlers.
//
// Kept intentionally thin — the caller owns state + dispatchers; this
// hook is only plumbing. Companion to useToolsMenuNdi which does the same
// for the NDI submenu specifically.
export function useAppMenuBridge(
  state: AppMenuState | null,
  onCommand: (cmd: ToolsCommand) => void,
): void {
  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  // Destructure flat fields so identical object churn doesn't re-push.
  const sessionActive = state?.sessionActive;
  const viewMode = state?.viewMode;
  const blackout = state?.blackout;
  const outputMuted = state?.outputMuted;
  const lowerThirdsEnabled = state?.lowerThirdsEnabled;
  const routingMode = state?.routingMode;
  const audienceWindowOpen = state?.audienceWindowOpen;
  const stageWindowOpen = state?.stageWindowOpen;
  const lastSavedAt = state?.lastSavedAt;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bridge = window.electron?.tools;
    if (!bridge?.setAppMenuState || !state) return;
    bridge.setAppMenuState(state);
  }, [
    sessionActive,
    viewMode,
    blackout,
    outputMuted,
    lowerThirdsEnabled,
    routingMode,
    audienceWindowOpen,
    stageWindowOpen,
    lastSavedAt,
    state,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bridge = window.electron?.tools;
    if (!bridge?.onCommand) return;
    const unsubscribe = bridge.onCommand((cmd) => {
      try {
        onCommandRef.current(cmd);
      } catch {
        /* swallow — a bad handler shouldn't break menu bridging */
      }
    });
    return unsubscribe;
  }, []);
}
