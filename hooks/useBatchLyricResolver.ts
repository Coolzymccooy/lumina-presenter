import { useCallback, useState } from 'react';
import { searchCatalogHymns } from '../services/hymnCatalog';
import { searchLrclib } from '../services/lyricSources/lrclibAdapter';
import { searchTavilyForLyrics } from '../services/lyricSources/tavilyAdapter';
import { searchWebForLyrics } from '../services/lyricSources/braveAdapter';
import { isWebLyricsFetchEnabled } from '../services/lyricSources/featureFlag';
import { parseServiceSongList } from '../services/lyricSources/serviceListParser';
import { isStrongCatalogLyricHit } from '../services/lyricSources/catalogConfidence';
import type { BatchSongResolution, ParsedServiceSong } from '../services/lyricSources/types';

const CONCURRENCY = 2;

const toIdleResolution = (song: ParsedServiceSong): BatchSongResolution => ({
  song,
  status: 'idle',
});

async function resolveOne(song: ParsedServiceSong): Promise<BatchSongResolution> {
  const catalogHits = searchCatalogHymns(song.title);
  const top = catalogHits[0];
  if (isStrongCatalogLyricHit(song.title, top)) {
    return { song, status: 'catalog', hymnId: top.hymn.id };
  }

  if (!isWebLyricsFetchEnabled()) {
    return { song, status: 'empty' };
  }

  const lrclibHit = await searchLrclib(song.title);
  if (lrclibHit) return { song, status: 'lrclib', lrclibHit };

  const tavilySources = await searchTavilyForLyrics(song.title);
  if (tavilySources.length) return { song, status: 'sources', sources: tavilySources };

  const braveSources = await searchWebForLyrics(song.title);
  if (braveSources.length) return { song, status: 'sources', sources: braveSources };

  return { song, status: 'empty' };
}

export function useBatchLyricResolver() {
  const [resolutions, setResolutions] = useState<BatchSongResolution[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const updateResolution = useCallback((songId: string, patch: Partial<BatchSongResolution>) => {
    setResolutions((current) => current.map((entry) => (
      entry.song.id === songId ? { ...entry, ...patch, song: entry.song } : entry
    )));
  }, []);

  const resolveServiceList = useCallback(async (input: string) => {
    const songs = parseServiceSongList(input);
    const initial = songs.map(toIdleResolution);
    setResolutions(initial);
    if (!songs.length) {
      setIsResolving(false);
      return;
    }

    setIsResolving(true);
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < songs.length) {
        const song = songs[nextIndex];
        nextIndex += 1;
        updateResolution(song.id, { status: 'resolving', error: undefined });
        try {
          const resolved = await resolveOne(song);
          updateResolution(song.id, resolved);
        } catch (error) {
          updateResolution(song.id, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to resolve song.',
          });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, songs.length) }, () => worker()));
    setIsResolving(false);
  }, [updateResolution]);

  const setPastedLyrics = useCallback((songId: string, pastedLyrics: string) => {
    updateResolution(songId, { pastedLyrics });
  }, [updateResolution]);

  const clear = useCallback(() => {
    setResolutions([]);
    setIsResolving(false);
  }, []);

  return {
    resolutions,
    isResolving,
    resolveServiceList,
    setPastedLyrics,
    clear,
  };
}
