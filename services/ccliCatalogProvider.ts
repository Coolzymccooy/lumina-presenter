import type { Hymn } from '../types/hymns';
import type {
  HymnCatalogListOptions,
  HymnCatalogProvider,
  HymnCatalogProviderAvailability,
} from './hymnCatalog';
import type { HymnSearchResult } from './hymnSearch';
import {
  mapCcliLyricsToHymn,
  mapCcliResultToSearchResult,
  searchSongSelectViaProxy,
  getSongSelectLyricsViaProxy,
  type CcliCredentials,
} from './ccliService';

// ─── Runtime state ────────────────────────────────────────────────────────────
// Note: the actual client_secret lives ONLY on the server. The renderer just
// tracks whether the workspace has connected credentials, plus the active
// workspace id used to scope server proxy calls.

let isConnected = false;
let activeWorkspaceId: string | null = null;

/**
 * Initialise the CCLI catalog provider with the connection status loaded at
 * startup. Pass the workspace id and a credentials sentinel (or null) returned
 * from `getCcliCredentials`.
 */
export const initCcliProvider = (
  credentials: CcliCredentials | null,
  workspaceId: string | null = null,
): void => {
  isConnected = !!credentials;
  activeWorkspaceId = workspaceId;
};

const isConfigured = (): boolean => isConnected && !!activeWorkspaceId;

// ─── Result caches ────────────────────────────────────────────────────────────

/** Cache of the most recent search results (query → results) */
const searchCache = new Map<string, HymnSearchResult[]>();

/** Hydrated hymn cache (CCLI song number → full Hymn with lyrics) */
const hymnCache = new Map<string, Hymn>();

// ─── Provider object ─────────────────────────────────────────────────────────

/**
 * The CCLI SongSelect catalog provider.
 *
 * The standard `search()` and `getById()` methods are synchronous (per the
 * HymnCatalogProvider interface) and return from the in-memory cache.
 *
 * The additional `asyncSearch()` method performs the live API call and
 * populates the cache; call it from React's useEffect and re-read results
 * via the sync `search()` method once the cache is warm.
 */
export const ccliCatalogProvider: HymnCatalogProvider & {
  asyncSearch: (query: string, options?: HymnCatalogListOptions) => Promise<HymnSearchResult[]>;
  asyncGetById: (id: string) => Promise<Hymn | null>;
} = {
  id: 'ccli-songselect',
  label: 'CCLI SongSelect',
  sourceKinds: ['licensed'],
  get availability(): HymnCatalogProviderAvailability {
    return isConfigured() ? 'active' : 'dark';
  },
  get isVisibleInLibrary(): boolean {
    return isConfigured();
  },
  providerId: 'ccli',
  providerName: 'CCLI SongSelect',
  capabilities: {
    search: true,
    hydration: true,
    entitlementCheck: true,
  },

  // ── Sync interface ──────────────────────────────────────────────────────────

  listHymns(options: HymnCatalogListOptions = {}): Hymn[] {
    const limit = options.limit ?? 25;
    const all = Array.from(hymnCache.values());
    return all.slice(0, limit);
  },

  search(query: string, options: HymnCatalogListOptions = {}): HymnSearchResult[] {
    const normalizedQuery = query.trim().toLowerCase();
    const cached = searchCache.get(normalizedQuery);
    if (!cached) return [];
    const limit = options.limit ?? 25;
    return cached.slice(0, limit);
  },

  getById(id: string): Hymn | null {
    return hymnCache.get(id) ?? null;
  },

  // ── Async interface (used by HymnLibrary for live search) ──────────────────

  async asyncSearch(
    query: string,
    options: HymnCatalogListOptions = {},
  ): Promise<HymnSearchResult[]> {
    if (!isConfigured() || !activeWorkspaceId) return [];

    const normalizedQuery = query.trim().toLowerCase();
    const limit = options.limit ?? 25;

    try {
      const { licenseNumber, results: raw } = await searchSongSelectViaProxy(
        activeWorkspaceId,
        normalizedQuery,
        limit,
      );

      const results: HymnSearchResult[] = raw.map((song) =>
        mapCcliResultToSearchResult(song, licenseNumber),
      );

      searchCache.set(normalizedQuery, results);
      results.forEach(({ hymn }) => hymnCache.set(hymn.id, hymn));

      return results;
    } catch {
      return [];
    }
  },

  async asyncGetById(id: string): Promise<Hymn | null> {
    const cached = hymnCache.get(id);
    if (cached && cached.sections.length > 0) return cached;

    if (!isConfigured() || !activeWorkspaceId) return null;

    const match = /^ccli-(\d+)$/.exec(id);
    if (!match) return null;
    const songNumber = parseInt(match[1], 10);

    try {
      const result = await getSongSelectLyricsViaProxy(activeWorkspaceId, songNumber);
      if (!result) return null;
      const { licenseNumber, lyrics } = result;

      const stub = cached ?? {
        id,
        title: lyrics.title,
        authors: (lyrics.authors ?? []).map((name) => ({ name, role: 'text' as const })),
      };

      const hymn = mapCcliLyricsToHymn(
        {
          songNumber,
          title: (stub as Hymn).title ?? lyrics.title,
          authors: lyrics.authors,
          copyright: lyrics.copyright,
        },
        lyrics,
        licenseNumber,
      );

      hymnCache.set(id, hymn);
      return hymn;
    } catch {
      return null;
    }
  },
};
