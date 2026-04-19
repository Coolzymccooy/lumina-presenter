// hooks/useLyricSearchOrchestrator.ts
import { useEffect, useState } from 'react';
import { searchCatalogHymns } from '../services/hymnCatalog';
import { searchLrclib } from '../services/lyricSources/lrclibAdapter';
import { searchWebForLyrics } from '../services/lyricSources/braveAdapter';
import { isWebLyricsFetchEnabled } from '../services/lyricSources/featureFlag';
import type { LyricsSearchState } from '../services/lyricSources/types';

export interface LyricSearchReturn {
  state: LyricsSearchState;
}

export function useLyricSearchOrchestrator(query: string): LyricSearchReturn {
  const [state, setState] = useState<LyricsSearchState>({ kind: 'idle' });

  useEffect(() => {
    const q = query.trim();
    if (!q) { setState({ kind: 'idle' }); return; }

    let cancelled = false;
    setState({ kind: 'searching', tier: 'catalog' });

    (async () => {
      const catalogHits = searchCatalogHymns(q);
      if (cancelled) return;
      const top = catalogHits[0];
      const isStrongCatalogMatch = !!top && (
        top.score >= 200 ||
        (top.matchedFields.includes('title') && top.score >= 165)
      );
      if (isStrongCatalogMatch) {
        setState({ kind: 'catalog', hymnId: top.hymn.id });
        return;
      }

      if (!isWebLyricsFetchEnabled()) {
        if (top) {
          setState({ kind: 'catalog', hymnId: top.hymn.id });
          return;
        }
        setState({ kind: 'empty', reason: 'flag-off' });
        return;
      }

      setState({ kind: 'searching', tier: 'lrclib' });
      const hit = await searchLrclib(q);
      if (cancelled) return;
      if (hit) { setState({ kind: 'lrclib', hit }); return; }

      setState({ kind: 'searching', tier: 'web' });
      const results = await searchWebForLyrics(q);
      if (cancelled) return;
      if (results.length > 0) { setState({ kind: 'web', results }); return; }

      if (top) {
        setState({ kind: 'catalog', hymnId: top.hymn.id });
        return;
      }
      setState({ kind: 'empty', reason: 'no-results' });
    })().catch((err) => {
      if (cancelled) return;
      setState({ kind: 'empty', reason: 'error', message: String(err?.message || err) });
    });

    return () => { cancelled = true; };
  }, [query]);

  return { state };
}
