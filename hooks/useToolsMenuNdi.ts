import { useEffect, useRef } from 'react';

// Bridges the native Tools → NDI submenu with the renderer's workspace +
// runtime NDI state. App.tsx owns workspace NDI settings (persisted server-
// side) and the live ndiState coming from window.electron.ndi.onState; this
// hook pushes a compact view to main.cjs whenever that combined state
// changes, and invokes onCommand when the operator clicks an NDI menu item.
//
// Kept deliberately thin: the caller owns the source of truth. Calling this
// in a non-Electron (web) build is a no-op because window.electron.tools is
// absent.
export function useToolsMenuNdi(
  state: ToolsNdiMenuState | null,
  onCommand: (cmd: ToolsCommand) => void,
): void {
  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  const active = state?.active;
  const broadcastMode = state?.broadcastMode;
  const audioEnabled = state?.audioEnabled;
  const resolution = state?.resolution;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bridge = window.electron?.tools;
    if (!bridge?.setNdiMenuState || !state) return;
    bridge.setNdiMenuState(state);
    // dep list uses individual flat fields so a new object with identical
    // values does not re-push; avoids noisy re-renders on unrelated workspace
    // settings churn.
  }, [active, broadcastMode, audioEnabled, resolution, state]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bridge = window.electron?.tools;
    if (!bridge?.onCommand) return;
    const unsubscribe = bridge.onCommand((cmd) => {
      try {
        onCommandRef.current(cmd);
      } catch {
        /* swallow — bad handler shouldn't break the menu bridge */
      }
    });
    return unsubscribe;
  }, []);
}
