import { describe, it, expect } from 'vitest';
import { sanitizeLyricsForSlideGeneration } from './lyricSanitizer';

const PRAISE_GENIUS = `[Verse 1: Brandon Lake]
I'll praise in the valley
Praise on the mountain
Praise when I'm sure
Praise when I'm doubting

[Pre-Chorus: Chris Brown]
I'll praise when outnumbered
Praise when surrounded
'Cause praise is the waters
My enemies drown in

You might also like
See Elevation Worship Live
Get tickets as low as $66

[Chorus: Chandler Moore, All]
My praise is a weapon (oh-oh)
It's more than a sound (oh-oh)
My praise is the shout
That brings Jericho down`;

describe('sanitizeLyricsForSlideGeneration', () => {
  it('strips Genius section-marker headers but records them as labels', () => {
    const result = sanitizeLyricsForSlideGeneration(PRAISE_GENIUS);
    expect(result).not.toContain('[Verse 1: Brandon Lake]');
    expect(result).not.toContain('[Pre-Chorus: Chris Brown]');
    expect(result).toContain('Verse 1');
    expect(result).toContain('Pre-Chorus');
    expect(result).toContain('Chorus');
  });

  it('strips Genius ad and upsell blocks', () => {
    const result = sanitizeLyricsForSlideGeneration(PRAISE_GENIUS);
    expect(result).not.toContain('You might also like');
    expect(result).not.toContain('See Elevation Worship Live');
    expect(result).not.toMatch(/tickets as low as/i);
  });

  it('strips producer ad-libs wrapped in parentheses', () => {
    const result = sanitizeLyricsForSlideGeneration(PRAISE_GENIUS);
    expect(result).not.toContain('(oh-oh)');
    expect(result).toContain('My praise is a weapon');
    expect(result).toContain("It's more than a sound");
  });

  it('preserves stanza line breaks between lyric lines', () => {
    const result = sanitizeLyricsForSlideGeneration(PRAISE_GENIUS);
    expect(result).toContain("I'll praise in the valley\nPraise on the mountain");
    expect(result).toContain("'Cause praise is the waters\nMy enemies drown in");
  });

  it('keeps blank lines between stanzas so the AI can group them', () => {
    const result = sanitizeLyricsForSlideGeneration(PRAISE_GENIUS);
    expect(result).toMatch(/Praise when I'm doubting\n\n/);
  });

  it('repairs glued-punctuation artifacts like "waters,Praise"', () => {
    const glued = `'Cause praise is the waters,Praise when outnumbered.Praise when surrounded`;
    const result = sanitizeLyricsForSlideGeneration(glued);
    expect(result).not.toContain('waters,Praise');
    expect(result).not.toContain('outnumbered.Praise');
    expect(result).toMatch(/waters,\s*Praise/);
    expect(result).toMatch(/outnumbered\.\s*Praise/);
  });

  it('repairs missing-space lowercase→uppercase word boundaries like "watersMy"', () => {
    const glued = `Cause praise is the watersMy enemies drown in`;
    const result = sanitizeLyricsForSlideGeneration(glued);
    expect(result).not.toContain('watersMy');
    expect(result).toContain('waters My');
  });

  it('collapses repeated blank lines to at most one', () => {
    const noisy = `Line one\n\n\n\nLine two\n\n\nLine three`;
    const result = sanitizeLyricsForSlideGeneration(noisy);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('returns trimmed text and never leading/trailing blank lines', () => {
    const padded = `\n\n\n   [Verse]\n\nHello world\n\n\n`;
    const result = sanitizeLyricsForSlideGeneration(padded);
    expect(result.startsWith('\n')).toBe(false);
    expect(result.endsWith('\n')).toBe(false);
  });

  it('is a no-op (other than trim) on text that has no Genius markers', () => {
    const plain = 'Amazing grace, how sweet the sound\nThat saved a wretch like me';
    const result = sanitizeLyricsForSlideGeneration(plain);
    expect(result).toBe(plain);
  });

  it('returns empty string for falsy / whitespace-only input', () => {
    expect(sanitizeLyricsForSlideGeneration('')).toBe('');
    expect(sanitizeLyricsForSlideGeneration('   \n\n  ')).toBe('');
  });
});
