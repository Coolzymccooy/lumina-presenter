export interface LrclibHit {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  plainLyrics: string;
  syncedLyrics?: string | null;
  duration?: number | null;
}

export interface WebSearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export type LyricsSearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; tier: 'catalog' | 'lrclib' | 'web' }
  | { kind: 'catalog'; hymnId: string }
  | { kind: 'lrclib'; hit: LrclibHit }
  | { kind: 'web'; results: WebSearchResult[] }
  | { kind: 'empty'; reason: 'no-results' | 'flag-off' | 'error'; message?: string };

export interface LyricClipboardPayload {
  text: string;
  sourceUrl: string;
}
