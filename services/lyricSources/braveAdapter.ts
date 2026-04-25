import { getServerApiBaseCandidates } from '../serverApi';
import type { WebSearchResult } from './types';

const TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_WORDS = 40;

function clampSnippet(snippet: string): string {
  const words = String(snippet || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_SNIPPET_WORDS) return words.join(' ');
  return `${words.slice(0, MAX_SNIPPET_WORDS).join(' ')}...`;
}

export async function searchWebForLyrics(query: string): Promise<WebSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const bases = getServerApiBaseCandidates();
  if (!bases.length) return [];

  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/lyrics/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        let code = `HTTP_${res.status}`;
        try {
          const payload = await res.clone().json().catch(() => null) as { error?: string } | null;
          if (payload?.error) code = payload.error;
        } catch { /* ignore */ }
        // eslint-disable-next-line no-console
        console.warn('[brave] search request rejected', { status: res.status, error: code, base });
        return [];
      }
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { results?: WebSearchResult[] } } | null;
      const raw = json?.data?.results ?? [];
      return raw
        .slice(0, MAX_RESULTS)
        .map((r): WebSearchResult => ({
          title: r.title,
          url: r.url,
          domain: r.domain,
          snippet: clampSnippet(r.snippet || ''),
          provider: r.provider || 'brave',
        }));
    } catch (err) {
      clearTimeout(timer);
      const reason = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn('[brave] search request failed', { reason, base });
      return [];
    }
  }
  return [];
}
