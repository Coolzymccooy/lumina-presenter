import { describe, expect, it } from 'vitest';
import { isStrongCatalogLyricHit } from './catalogConfidence';

const hymnResult = (title: string, firstLine = '') => ({
  hymn: {
    id: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    alternateTitles: [],
    searchIndex: {
      normalizedTitle: title.toLowerCase(),
      normalizedFirstLine: firstLine.toLowerCase(),
    },
  },
  score: 300,
  matchedFields: ['title'],
} as any);

describe('isStrongCatalogLyricHit', () => {
  it('accepts exact title and title plus lyrics queries', () => {
    expect(isStrongCatalogLyricHit('Amazing Grace', hymnResult('Amazing Grace'))).toBe(true);
    expect(isStrongCatalogLyricHit('Amazing Grace lyrics', hymnResult('Amazing Grace'))).toBe(true);
  });

  it('rejects high-scoring token overlap with the wrong title', () => {
    expect(isStrongCatalogLyricHit('Wetin I go give to You', hymnResult('I give my heart to Thee'))).toBe(false);
    expect(isStrongCatalogLyricHit('Ah eh dis kind God another one no dey o', hymnResult('O God, Our Help in Ages Past'))).toBe(false);
  });
});
