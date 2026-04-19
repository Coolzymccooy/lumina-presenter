import { useEffect, useState } from 'react';
import { Mode } from '../types';

const KEY = 'lumina.audienceStudio.mode';

const VALID: ReadonlySet<Mode> = new Set<Mode>([
  'broadcast',
  'stage',
  'queue',
  'submissions',
]);

function read(fallback: Mode): Mode {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v && VALID.has(v as Mode)) return v as Mode;
  } catch {
    // sessionStorage unavailable (SSR, private mode); fall through
  }
  return fallback;
}

export function useAudienceMode(fallback: Mode = 'broadcast'): [Mode, (m: Mode) => void] {
  const [mode, setMode] = useState<Mode>(() => read(fallback));

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, mode);
    } catch {
      // swallow — persistence is best-effort
    }
  }, [mode]);

  return [mode, setMode];
}
