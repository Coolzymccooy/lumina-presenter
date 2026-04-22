import { getServerApiBaseCandidates } from '../serverApi';
import type { WebSearchResult } from './types';

const TIMEOUT_MS = 12_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_WORDS = 40;

function clampSnippet(snippet: string): string {
  const words = String(snippet || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_SNIPPET_WORDS) return words.join(' ');
  return `${words.slice(0, MAX_SNIPPET_WORDS).join(' ')}...`;
}

export async function searchTavilyForLyrics(query: string): Promise<WebSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const bases = getServerApiBaseCandidates();
  if (!bases.length) return [];

  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/lyrics/tavily-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return [];
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { results?: WebSearchResult[] } } | null;
      const raw = json?.data?.results ?? [];
      return raw
        .slice(0, MAX_RESULTS)
        .map((r) => ({
          title: String(r.title || '').trim(),
          url: String(r.url || '').trim(),
          domain: String(r.domain || '').trim(),
          snippet: clampSnippet(r.snippet || ''),
          provider: 'tavily',
          score: typeof r.score === 'number' ? r.score : undefined,
          detectedTitle: r.detectedTitle,
          detectedArtist: r.detectedArtist,
        }))
        .filter((r) => r.title && r.url);
    } catch {
      clearTimeout(timer);
      return [];
    }
  }
  return [];
}
