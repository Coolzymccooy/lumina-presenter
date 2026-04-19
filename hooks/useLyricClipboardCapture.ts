// hooks/useLyricClipboardCapture.ts
import { useCallback, useEffect, useState } from 'react';

interface LyricClipboardBridge {
  arm: (url: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  disarm: () => Promise<{ ok: boolean }>;
  onCaptured: (cb: (payload: { text: string; sourceUrl: string }) => void) => () => void;
}

export interface UseLyricClipboardReturn {
  isSupported: boolean;
  captured: { text: string; sourceUrl: string } | null;
  arm: (url: string) => Promise<boolean>;
  disarm: () => Promise<void>;
  clearCaptured: () => void;
}

function getBridge(): LyricClipboardBridge | null {
  const w = globalThis as unknown as { window?: { electron?: { lyricClipboard?: LyricClipboardBridge } } };
  return w.window?.electron?.lyricClipboard ?? null;
}

export function useLyricClipboardCapture(): UseLyricClipboardReturn {
  const [captured, setCaptured] = useState<{ text: string; sourceUrl: string } | null>(null);
  const bridge = getBridge();
  const isSupported = !!bridge;

  useEffect(() => {
    if (!bridge) return;
    const unsubscribe = bridge.onCaptured((payload) => setCaptured(payload));
    return unsubscribe;
  }, [bridge]);

  const arm = useCallback(async (url: string): Promise<boolean> => {
    if (!bridge) return false;
    const res = await bridge.arm(url);
    return !!res.ok;
  }, [bridge]);

  const disarm = useCallback(async (): Promise<void> => {
    if (!bridge) return;
    await bridge.disarm();
  }, [bridge]);

  const clearCaptured = useCallback(() => setCaptured(null), []);

  return { isSupported, captured, arm, disarm, clearCaptured };
}
