// hooks/useLyricSearchOrchestrator.test.tsx
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

import { useLyricSearchOrchestrator, type LyricSearchReturn } from './useLyricSearchOrchestrator';

let container: HTMLDivElement;
let root: Root;
let latest: LyricSearchReturn | null = null;

function Harness({ query }: { query: string }) {
  latest = useLyricSearchOrchestrator(query);
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
  searchCatalogHymnsMock.mockReset();
  searchLrclibMock.mockReset();
  searchTavilyForLyricsMock.mockReset().mockResolvedValue([]);
  searchWebForLyricsMock.mockReset();
  isFlagOnMock.mockReset().mockReturnValue(true);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function flush() { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); }

describe('useLyricSearchOrchestrator', () => {
  it('returns catalog hit when tier 1 strong match succeeds', async () => {
    searchCatalogHymnsMock.mockReturnValue([
      catalogHit('amazing-grace', 'Amazing Grace'),
    ]);
    act(() => root.render(<Harness query="amazing grace" />));
    await flush();
    expect(latest?.state.kind).toBe('catalog');
    expect(searchLrclibMock).not.toHaveBeenCalled();
  });

  it('cascades past weak catalog hit and returns empty when all providers miss', async () => {
    searchCatalogHymnsMock.mockReturnValue([
      catalogHit('weak-match', 'I give my heart to Thee', 281, ['title', 'first-line', 'keyword']),
    ]);
    searchLrclibMock.mockResolvedValue(null);
    searchTavilyForLyricsMock.mockResolvedValue([]);
    searchWebForLyricsMock.mockResolvedValue([]);
    act(() => root.render(<Harness query="weak query" />));
    await flush(); await flush(); await flush();
    expect(searchLrclibMock).toHaveBeenCalled();
    expect(searchWebForLyricsMock).toHaveBeenCalled();
    expect(latest?.state.kind).toBe('empty');
  });

  it('falls through to LRCLIB when catalog misses', async () => {
    searchCatalogHymnsMock.mockReturnValue([]);
    searchLrclibMock.mockResolvedValue({ id: 1, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'Way maker...' });
    act(() => root.render(<Harness query="way maker" />));
    await flush();
    await flush();
    expect(latest?.state.kind).toBe('lrclib');
    expect(searchWebForLyricsMock).not.toHaveBeenCalled();
  });

  it('falls through to Tavily when LRCLIB misses', async () => {
    searchCatalogHymnsMock.mockReturnValue([]);
    searchLrclibMock.mockResolvedValue(null);
    searchTavilyForLyricsMock.mockResolvedValue([{ title: 't', url: 'https://t/y', domain: 't', snippet: 's', provider: 'tavily' }]);
    act(() => root.render(<Harness query="olowogbogboro" />));
    await flush(); await flush(); await flush();
    expect(latest?.state.kind).toBe('web');
    if (latest?.state.kind === 'web') expect(latest.state.results[0].provider).toBe('tavily');
    expect(searchWebForLyricsMock).not.toHaveBeenCalled();
  });

  it('falls through to Brave when LRCLIB and Tavily miss', async () => {
    searchCatalogHymnsMock.mockReturnValue([]);
    searchLrclibMock.mockResolvedValue(null);
    searchTavilyForLyricsMock.mockResolvedValue([]);
    searchWebForLyricsMock.mockResolvedValue([{ title: 'a', url: 'https://x/y', domain: 'x', snippet: 's' }]);
    act(() => root.render(<Harness query="olowogbogboro" />));
    await flush(); await flush(); await flush();
    expect(latest?.state.kind).toBe('web');
  });

  it('skips Tier 2/3 when flag OFF', async () => {
    isFlagOnMock.mockReturnValue(false);
    searchCatalogHymnsMock.mockReturnValue([]);
    act(() => root.render(<Harness query="something" />));
    await flush();
    expect(latest?.state.kind).toBe('empty');
    if (latest?.state.kind === 'empty') expect(latest.state.reason).toBe('flag-off');
    expect(searchLrclibMock).not.toHaveBeenCalled();
    expect(searchTavilyForLyricsMock).not.toHaveBeenCalled();
  });

  it('returns empty when all three tiers miss', async () => {
    searchCatalogHymnsMock.mockReturnValue([]);
    searchLrclibMock.mockResolvedValue(null);
    searchTavilyForLyricsMock.mockResolvedValue([]);
    searchWebForLyricsMock.mockResolvedValue([]);
    act(() => root.render(<Harness query="unknown" />));
    await flush(); await flush(); await flush();
    expect(latest?.state.kind).toBe('empty');
  });
});
