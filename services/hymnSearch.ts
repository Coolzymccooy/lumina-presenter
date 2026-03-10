import type { Hymn, HymnLibrarySourceKind } from '../types/hymns.ts';

export interface HymnSearchResult {
  hymn: Hymn;
  score: number;
  matchedFields: string[];
}

export interface HymnSearchOptions {
  sourceKinds?: HymnLibrarySourceKind[];
  requireProjectableRights?: boolean;
}

export const normalizeHymnSearchText = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/['’]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .toLowerCase();

export const filterHymnsByCatalogRules = (
  hymns: Hymn[],
  options: HymnSearchOptions = {},
) => hymns.filter((hymn) => {
  if (options.sourceKinds?.length && !options.sourceKinds.includes(hymn.librarySource.kind)) {
    return false;
  }
  if (options.requireProjectableRights && !hymn.usageRights.canProject) {
    return false;
  }
  return true;
});

const scoreField = (field: string, query: string, base: number) => {
  if (!field) return 0;
  if (field === query) return base + 80;
  if (field.startsWith(query)) return base + 45;
  if (field.includes(query)) return base + 20;
  const queryTokens = query.split(/\s+/).filter((entry) => entry.length > 2);
  const fieldTokens = new Set(field.split(/\s+/).filter((entry) => entry.length > 2));
  const overlap = queryTokens.filter((token) => fieldTokens.has(token)).length;
  return overlap > 0 ? base + overlap * 6 : 0;
};

export const searchHymns = (
  hymns: Hymn[],
  query: string,
  limit = 25,
  options: HymnSearchOptions = {},
): HymnSearchResult[] => {
  const eligibleHymns = filterHymnsByCatalogRules(hymns, options);
  const normalizedQuery = normalizeHymnSearchText(query);
  if (!normalizedQuery) {
    return eligibleHymns.slice(0, limit).map((hymn, index) => ({
      hymn,
      score: Math.max(1, 999 - index),
      matchedFields: [],
    }));
  }

  return eligibleHymns
    .map((hymn) => {
      const matchedFields = new Set<string>();
      let score = 0;

      const titleScore = scoreField(hymn.searchIndex.normalizedTitle, normalizedQuery, 120);
      if (titleScore) {
        score += titleScore;
        matchedFields.add('title');
      }

      const firstLineScore = scoreField(hymn.searchIndex.normalizedFirstLine, normalizedQuery, 95);
      if (firstLineScore) {
        score += firstLineScore;
        matchedFields.add('first-line');
      }

      hymn.alternateTitles.forEach((title) => {
        const nextScore = scoreField(normalizeHymnSearchText(title), normalizedQuery, 80);
        if (nextScore) {
          score += nextScore;
          matchedFields.add('alternate-title');
        }
      });

      hymn.authors.forEach((author) => {
        const nextScore = scoreField(normalizeHymnSearchText(author.name), normalizedQuery, 55);
        if (nextScore) {
          score += nextScore;
          matchedFields.add('author');
        }
      });

      hymn.tunes.forEach((tune) => {
        const nextScore = scoreField(normalizeHymnSearchText(tune.name), normalizedQuery, 50);
        if (nextScore) {
          score += nextScore;
          matchedFields.add('tune');
        }
      });

      hymn.searchKeywords.forEach((keyword) => {
        const nextScore = scoreField(normalizeHymnSearchText(keyword), normalizedQuery, 32);
        if (nextScore) {
          score += nextScore;
          matchedFields.add('keyword');
        }
      });

      hymn.themes.forEach((theme) => {
        const nextScore = scoreField(normalizeHymnSearchText(theme), normalizedQuery, 30);
        if (nextScore) {
          score += nextScore;
          matchedFields.add('theme');
        }
      });

      const searchableTextScore = scoreField(hymn.searchIndex.searchableText, normalizedQuery, 10);
      if (searchableTextScore) {
        score += searchableTextScore;
      }

      return {
        hymn,
        score,
        matchedFields: Array.from(matchedFields),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.hymn.title.localeCompare(right.hymn.title);
    })
    .slice(0, limit);
};
