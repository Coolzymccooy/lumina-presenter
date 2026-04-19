const MIN_CHARS = 200;
const MAX_CHARS = 8000;
const MIN_LINES = 4;
const MAX_DIGIT_PUNCT_RATIO = 0.5;
const URL_RE = /^https?:\/\//i;

export function looksLikeLyrics(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < MIN_CHARS || trimmed.length > MAX_CHARS) return false;

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < MIN_LINES) return false;
  if (URL_RE.test(lines[0])) return false;

  const nonWhitespace = trimmed.replace(/\s/g, '');
  if (nonWhitespace.length === 0) return false;
  const digitsPunct = nonWhitespace.replace(/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g, '').length;
  const ratio = digitsPunct / nonWhitespace.length;
  if (ratio >= MAX_DIGIT_PUNCT_RATIO) return false;

  return true;
}
