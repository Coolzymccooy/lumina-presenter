import type { ParsedServiceSong } from './types';

const MAX_SONGS = 20;
const DEFAULT_SECTION = 'Songs';

const SECTION_HINTS = new Set([
  'call to worship',
  'praise',
  'worship',
  'offering',
  'thanksgiving',
  'communion',
  'altar call',
  'closing',
  'special',
  'choir',
]);

const normalizeLine = (value: string) => value
  .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const hasSongMarker = (value: string) => /^([-*\u2022]+|\d+[\).:-]|[a-z][\).:-])\s*/iu.test(normalizeLine(value));

const stripSongMarker = (value: string) => normalizeLine(value
  .replace(/^[-*\u2022]+\s*/u, '')
  .replace(/^\d+[\).:-]\s*/u, '')
  .replace(/^[a-z][\).:-]\s*/iu, '')
  .replace(/^[-*\u2022]+\s*/u, ''));

const looksLikeHeader = (line: string) => {
  const normalized = normalizeLine(line).toLowerCase().replace(/[:.]+$/g, '');
  if (!normalized) return false;
  if (hasSongMarker(normalized)) return false;
  if (SECTION_HINTS.has(normalized)) return true;
  if (/^songs?\s+for\s+/i.test(normalized)) return false;
  if (/^today'?s?\s+songs?/i.test(normalized)) return false;
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length <= 3 && !/[?!,]/.test(normalized) && !/\b(you|your|jesus|lord|god|joy|halle|hosanna|reigns|praise)\b/i.test(normalized);
};

const makeSongId = (section: string, title: string, index: number) => {
  const slug = `${section}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `${index + 1}-${slug || 'song'}`;
};

export function parseServiceSongList(input: string, maxSongs = MAX_SONGS): ParsedServiceSong[] {
  const lines = String(input || '')
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const songs: ParsedServiceSong[] = [];
  const seen = new Set<string>();
  let section = DEFAULT_SECTION;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\u{1F447}/gu, '').trim();
    if (!line) continue;
    if (looksLikeHeader(line)) {
      section = line.replace(/[:.]+$/g, '').trim();
      continue;
    }

    const title = stripSongMarker(line);
    if (!title || /^songs?\s+for\s+/i.test(title)) continue;
    const key = `${section.toLowerCase()}::${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    songs.push({ id: makeSongId(section, title, songs.length), section, title });
    if (songs.length >= maxSongs) break;
  }

  return songs;
}
