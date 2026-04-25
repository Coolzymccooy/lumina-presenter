import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_TOOLS_SETTINGS: ToolsSettings = {
  overlays: { safeAreas: false, centerCross: false },
  aspect: 'off',
  testPattern: 'off',
};

export interface UseToolsMenuReturn {
  settings: ToolsSettings;
  setAspect: (aspect: ToolsAspect) => void;
  setTestPattern: (pattern: ToolsTestPattern) => void;
  setOverlay: (name: keyof ToolsSettings['overlays'], value: boolean) => void;
  isSupported: boolean;
}

// Subscribes to the Electron Tools menu: loads the current settings once on
// mount, listens for `tools:state` broadcasts when the menu is clicked, and
// exposes stable setters that write back through the main-process store.
// On non-Electron (web) builds, isSupported is false and setters are no-ops.
export function useToolsMenu(): UseToolsMenuReturn {
  const [settings, setSettings] = useState<ToolsSettings>(DEFAULT_TOOLS_SETTINGS);
  const bridgeRef = useRef(typeof window !== 'undefined' ? window.electron?.tools : undefined);
  const isSupported = !!bridgeRef.current;

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    let cancelled = false;
    bridge.getSettings?.().then((loaded) => {
      if (!cancelled && loaded) setSettings(loaded);
    }).catch(() => { /* keep defaults */ });
    const unsubscribe = bridge.onState?.((next) => {
      if (next) setSettings(next);
    });
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const applyPatch = useCallback(async (patch: ToolsSettingsPatch) => {
    const bridge = bridgeRef.current;
    if (!bridge?.setSettings) return;
    try {
      const next = await bridge.setSettings(patch);
      if (next) setSettings(next);
    } catch {
      /* swallow — menu click will retry on next toggle */
    }
  }, []);

  const setAspect = useCallback((aspect: ToolsAspect) => {
    void applyPatch({ aspect });
  }, [applyPatch]);

  const setTestPattern = useCallback((pattern: ToolsTestPattern) => {
    void applyPatch({ testPattern: pattern });
  }, [applyPatch]);

  const setOverlay = useCallback((name: keyof ToolsSettings['overlays'], value: boolean) => {
    void applyPatch({ overlays: { [name]: value } });
  }, [applyPatch]);

  return { settings, setAspect, setTestPattern, setOverlay, isSupported };
}
