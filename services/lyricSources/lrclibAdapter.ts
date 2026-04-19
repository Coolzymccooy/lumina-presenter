import { getServerApiBaseCandidates } from '../serverApi';
import type { LrclibHit } from './types';

const TIMEOUT_MS = 10_000;

export async function searchLrclib(query: string): Promise<LrclibHit | null> {
  const q = query.trim();
  if (!q) return null;
  const bases = getServerApiBaseCandidates();
  if (!bases.length) return null;

  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/lyrics/lrclib`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { hit?: LrclibHit | null } } | null;
      return json?.data?.hit ?? null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
  return null;
}
