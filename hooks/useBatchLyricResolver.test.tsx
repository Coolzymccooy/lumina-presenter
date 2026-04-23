import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const searchCatalogHymnsMock = vi.fn();
const searchLrclibMock = vi.fn();
const searchTavilyForLyricsMock = vi.fn();
const searchWebForLyricsMock = vi.fn();
const isFlagOnMock = vi.fn();

vi.mock('../services/hymnCatalog', () => ({ searchCatalogHymns: (...a: unknown[]) => searchCatalogHymnsMock(...a) }));
vi.mock('../services/lyricSources/lrclibAdapter', () => ({ searchLrclib: (...a: unknown[]) => searchLrclibMock(...a) }));
vi.mock('../services/lyricSources/tavilyAdapter', () => ({ searchTavilyForLyrics: (...a: unknown[]) => searchTavilyForLyricsMock(...a) }));
vi.mock('../services/lyricSources/braveAdapter', () => ({ searchWebForLyrics: (...a: unknown[]) => searchWebForLyricsMock(...a) }));
vi.mock('../services/lyricSources/featureFlag', () => ({ isWebLyricsFetchEnabled: () => isFlagOnMock() }));

import { useBatchLyricResolver } from './useBatchLyricResolver';

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useBatchLyricResolver> | null = null;

function Harness() {
  latest = useBatchLyricResolver();
  return null;
}

function catalogHit(id: string, title: string, score = 220, matchedFields = ['title']) {
  return {
    hymn: {
      id,
      title,
      alternateTitles: [],
      searchIndex: { normalizedTitle: title.toLowerCase(), normalizedFirstLine: '' },
    },
    score,
    matchedFields,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
  searchCatalogHymnsMock.mockReset().mockReturnValue([]);
  searchLrclibMock.mockReset().mockResolvedValue(null);
  searchTavilyForLyricsMock.mockReset().mockResolvedValue([]);
  searchWebForLyricsMock.mockReset().mockResolvedValue([]);
  isFlagOnMock.mockReset().mockReturnValue(true);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useBatchLyricResolver', () => {
  it('resolves catalog, LRCLIB, Tavily, Brave, and empty statuses in order', async () => {
    searchCatalogHymnsMock.mockImplementation((q: string) => (
      q === 'Amazing Grace'
        ? [catalogHit('amazing-grace', 'Amazing Grace')]
        : []
    ));
    searchLrclibMock.mockImplementation(async (q: string) => (
      q === 'Way Maker' ? { id: 1, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'lyrics' } : null
    ));
    searchTavilyForLyricsMock.mockImplementation(async (q: string) => (
      q === 'Joy overflow' ? [{ title: 'Joy Overflow', url: 'https://t.test/joy', domain: 't.test', snippet: 'source', provider: 'tavily' }] : []
    ));
    searchWebForLyricsMock.mockImplementation(async (q: string) => (
      q === 'Unknown web' ? [{ title: 'Unknown', url: 'https://b.test/u', domain: 'b.test', snippet: 'source', provider: 'brave' }] : []
    ));

    act(() => root.render(<Harness />));
    await act(async () => {
      await latest?.resolveServiceList(`
Praise
1) Amazing Grace
2) Way Maker
3) Joy overflow
4) Unknown web
5) No result
`);
    });

    expect(latest?.resolutions.map((entry) => entry.status)).toEqual(['catalog', 'lrclib', 'sources', 'sources', 'empty']);
    expect(searchWebForLyricsMock).toHaveBeenCalledWith('Unknown web');
  });
});
