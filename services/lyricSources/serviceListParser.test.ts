import { describe, expect, it } from 'vitest';
import { parseServiceSongList } from './serviceListParser';

describe('parseServiceSongList', () => {
  it('parses headings, bullets, numbering, and invisible mobile paste marks', () => {
    const parsed = parseServiceSongList(`
Songs for Today.👇

Call to worship
-Worthy is your name Jesus

Praise
1) Praise ye the Lord o my soul
2) Praise the Lord, Halle

Offering
- ⁠He reigns
- ⁠Joy overflows in my heart
`);
    expect(parsed.map((song) => [song.section, song.title])).toEqual([
      ['Call to worship', 'Worthy is your name Jesus'],
      ['Praise', 'Praise ye the Lord o my soul'],
      ['Praise', 'Praise the Lord, Halle'],
      ['Offering', 'He reigns'],
      ['Offering', 'Joy overflows in my heart'],
    ]);
  });

  it('dedupes within a section and limits output', () => {
    const parsed = parseServiceSongList(`
Praise
1) Joy overflow
2) Joy overflow
3) Jehovah Reigns
`, 2);
    expect(parsed.map((song) => song.title)).toEqual(['Joy overflow', 'Jehovah Reigns']);
  });
});
