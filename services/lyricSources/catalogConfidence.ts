import type { HymnSearchResult } from '../hymnSearch';

const normalize = (value: unknown) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/['\u2019]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .toLowerCase();

const tokenize = (value: string) => normalize(value).split(/\s+/).filter((token) => token.length > 2);

function hasHighTitleConfidence(query: string, candidate: string): boolean {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return false;
  if (q === c) return true;
  if (c.length >= 8 && q.includes(c)) return true;
  if (q.length >= 8 && c.includes(q)) return true;

  const queryTokens = tokenize(q);
  const candidateTokens = tokenize(c);
  if (!queryTokens.length || !candidateTokens.length) return false;
  const querySet = new Set(queryTokens);
  const candidateSet = new Set(candidateTokens);
  const candidateOverlap = candidateTokens.filter((token) => querySet.has(token)).length;
  const queryOverlap = queryTokens.filter((token) => candidateSet.has(token)).length;
  return candidateOverlap / candidateTokens.length >= 0.8 && queryOverlap / queryTokens.length >= 0.6;
}

export function isStrongCatalogLyricHit(query: string, result: HymnSearchResult | undefined): boolean {
  if (!result?.hymn) return false;
  const hymn = result.hymn;
  const candidates = [
    hymn.title,
    hymn.searchIndex?.normalizedTitle,
    hymn.searchIndex?.normalizedFirstLine,
    ...(Array.isArray(hymn.alternateTitles) ? hymn.alternateTitles : []),
  ].filter(Boolean);

  return candidates.some((candidate) => hasHighTitleConfidence(query, String(candidate)));
}
