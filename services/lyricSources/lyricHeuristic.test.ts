import { describe, it, expect } from 'vitest';
import { looksLikeLyrics } from './lyricHeuristic';

const validLyrics = `Way maker, miracle worker
Promise keeper, light in the darkness
My God, that is who you are
My God, that is who you are

Even when I don't see it, you're working
Even when I don't feel it, you're working
You never stop, you never stop working`;

describe('looksLikeLyrics', () => {
  it('accepts well-formed lyrics', () => {
    expect(looksLikeLyrics(validLyrics)).toBe(true);
  });

  it('rejects empty string', () => {
    expect(looksLikeLyrics('')).toBe(false);
  });

  it('rejects text under 200 chars', () => {
    expect(looksLikeLyrics('short\nshort\nshort\nshort')).toBe(false);
  });

  it('rejects text over 8000 chars', () => {
    const huge = 'line one has more than forty characters in it\n'.repeat(400);
    expect(looksLikeLyrics(huge)).toBe(false);
  });

  it('rejects text with fewer than 4 non-empty lines', () => {
    const three = `line one has more than forty characters in it\nline two has more than forty characters here\nline three has more than forty characters too\n\n`.padEnd(250, ' ');
    expect(looksLikeLyrics(three)).toBe(false);
  });

  it('rejects text whose first line is a URL', () => {
    const urlLead = `https://example.com/song\n${validLyrics}`;
    expect(looksLikeLyrics(urlLead)).toBe(false);
  });

  it('rejects text that is mostly digits/punctuation', () => {
    const numeric = ('1234567890!@#$%^&*()\n'.repeat(20)).padEnd(300, '1');
    expect(looksLikeLyrics(numeric)).toBe(false);
  });

  it('rejects code-shaped text', () => {
    const code = `function foo() {\n  return bar;\n}\nconst x = { a: 1, b: 2 };\nif (x.a > 0) { console.log('hi'); }\n`.padEnd(250, ' ');
    expect(looksLikeLyrics(code)).toBe(false);
  });
});
