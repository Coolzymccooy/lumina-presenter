// hooks/useLyricSearchOrchestrator.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const searchCatalogHymnsMock = vi.fn();
const searchLrclibMock = vi.fn();
const searchWebForLyricsMock = vi.fn();
const isFlagOnMock = vi.fn();

vi.mock('../services/hymnCatalog', () => ({ searchCatalogHymns: (...a: unknown[]) => searchCatalogHymnsMock(...a) }));
vi.mock('../services/lyricSources/lrclibAdapter', () => ({ searchLrclib: (...a: unknown[]) => searchLrclibMock(...a) }));
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

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
  searchCatalogHymnsMock.mockReset();
  searchLrclibMock.mockReset();
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
      { hymn: { id: 'amazing-grace' }, score: 220, matchedFields: ['title'] },
    ]);
    act(() => root.render(<Harness query="amazing grace" />));
    await flush();
    expect(latest?.state.kind).toBe('catalog');
    expect(searchLrclibMock).not.toHaveBeenCalled();
  });

  it('cascades past weak catalog hit to LRCLIB then falls back to catalog', async () => {
    searchCatalogHymnsMock.mockReturnValue([
      { hymn: { id: 'weak-match' }, score: 130, matchedFields: ['keyword'] },
    ]);
    searchLrclibMock.mockResolvedValue(null);
    searchWebForLyricsMock.mockResolvedValue([]);
    act(() => root.render(<Harness query="weak query" />));
    await flush(); await flush(); await flush();
    expect(searchLrclibMock).toHaveBeenCalled();
    expect(searchWebForLyricsMock).toHaveBeenCalled();
    expect(latest?.state.kind).toBe('catalog');
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

  it('falls through to Brave when LRCLIB misses', async () => {
    searchCatalogHymnsMock.mockReturnValue([]);
    searchLrclibMock.mockResolvedValue(null);
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
  });

  it('returns empty when all three tiers miss', async () => {
    searchCatalogHymnsMock.mockReturnValue([]);
    searchLrclibMock.mockResolvedValue(null);
    searchWebForLyricsMock.mockResolvedValue([]);
    act(() => root.render(<Harness query="unknown" />));
    await flush(); await flush(); await flush();
    expect(latest?.state.kind).toBe('empty');
  });
});
