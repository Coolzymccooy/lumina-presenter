export interface LrclibHit {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  plainLyrics: string;
  syncedLyrics?: string | null;
  duration?: number | null;
}

export type LyricSourceProvider = 'brave' | 'tavily';

export interface WebSearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  provider?: LyricSourceProvider;
  score?: number;
  detectedTitle?: string;
  detectedArtist?: string;
}

export type LyricsSearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; tier: 'catalog' | 'lrclib' | 'tavily' | 'web' }
  | { kind: 'catalog'; hymnId: string }
  | { kind: 'lrclib'; hit: LrclibHit }
  | { kind: 'web'; results: WebSearchResult[] }
  | { kind: 'empty'; reason: 'no-results' | 'flag-off' | 'error'; message?: string };

export interface LyricClipboardPayload {
  text: string;
  sourceUrl: string;
}

export interface ParsedServiceSong {
  id: string;
  section: string;
  title: string;
}

export type BatchSongStatus = 'idle' | 'resolving' | 'catalog' | 'lrclib' | 'sources' | 'empty' | 'error';

export interface BatchSongResolution {
  song: ParsedServiceSong;
  status: BatchSongStatus;
  hymnId?: string;
  lrclibHit?: LrclibHit;
  sources?: WebSearchResult[];
  error?: string;
  pastedLyrics?: string;
}
