export interface BibleVerse {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleBook {
  name: string;
  chapters: number;
}

const VERSE_CACHE_PREFIX = 'lumina_bible_verse_cache_v1';
const SEMANTIC_CACHE_PREFIX = 'lumina_bible_semantic_cache_v1';
const VERSE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const SEMANTIC_CACHE_TTL_MS = 1000 * 60 * 15;
const verseMemoryCache = new Map<string, { savedAt: number; verses: BibleVerse[] }>();
const semanticMemoryCache = new Map<string, { savedAt: number; reference: string }>();

export const BIBLE_BOOKS: BibleBook[] = [
  { name: 'Genesis', chapters: 50 }, { name: 'Exodus', chapters: 40 }, { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 }, { name: 'Deuteronomy', chapters: 34 }, { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 }, { name: 'Ruth', chapters: 4 }, { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 }, { name: '1 Kings', chapters: 22 }, { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 }, { name: '2 Chronicles', chapters: 36 }, { name: 'Ezra', chapters: 10 },
  { name: 'Nehemiah', chapters: 13 }, { name: 'Esther', chapters: 10 }, { name: 'Job', chapters: 42 },
  { name: 'Psalms', chapters: 150 }, { name: 'Proverbs', chapters: 31 }, { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Solomon', chapters: 8 }, { name: 'Isaiah', chapters: 66 }, { name: 'Jeremiah', chapters: 52 },
  { name: 'Lamentations', chapters: 5 }, { name: 'Ezekiel', chapters: 48 }, { name: 'Daniel', chapters: 12 },
  { name: 'Hosea', chapters: 14 }, { name: 'Joel', chapters: 3 }, { name: 'Amos', chapters: 9 },
  { name: 'Obadiah', chapters: 1 }, { name: 'Jonah', chapters: 4 }, { name: 'Micah', chapters: 7 },
  { name: 'Nahum', chapters: 3 }, { name: 'Habakkuk', chapters: 3 }, { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 }, { name: 'Zechariah', chapters: 14 }, { name: 'Malachi', chapters: 4 },
  { name: 'Matthew', chapters: 28 }, { name: 'Mark', chapters: 16 }, { name: 'Luke', chapters: 24 },
  { name: 'John', chapters: 21 }, { name: 'Acts', chapters: 28 }, { name: 'Romans', chapters: 16 },
  { name: '1 Corinthians', chapters: 16 }, { name: '2 Corinthians', chapters: 13 }, { name: 'Galatians', chapters: 6 },
  { name: 'Ephesians', chapters: 6 }, { name: 'Philippians', chapters: 4 }, { name: 'Colossians', chapters: 4 },
  { name: '1 Thessalonians', chapters: 5 }, { name: '2 Thessalonians', chapters: 3 }, { name: '1 Timothy', chapters: 6 },
  { name: '2 Timothy', chapters: 4 }, { name: 'Titus', chapters: 3 }, { name: 'Philemon', chapters: 1 },
  { name: 'Hebrews', chapters: 13 }, { name: 'James', chapters: 5 }, { name: '1 Peter', chapters: 5 },
  { name: '2 Peter', chapters: 3 }, { name: '1 John', chapters: 5 }, { name: '2 John', chapters: 1 },
  { name: '3 John', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Revelation', chapters: 22 },
];

// KJV per-chapter verse counts. Index 0 = chapter 1.
const BIBLE_VERSE_COUNTS: Record<string, number[]> = {
  'Genesis':       [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26],
  'Exodus':        [22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38],
  'Leviticus':     [17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34],
  'Numbers':       [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13],
  'Deuteronomy':   [46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12],
  'Joshua':        [18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33],
  'Judges':        [36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25],
  'Ruth':          [22,23,18,22],
  '1 Samuel':      [28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13],
  '2 Samuel':      [27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25],
  '1 Kings':       [53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53],
  '2 Kings':       [18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30],
  '1 Chronicles':  [54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30],
  '2 Chronicles':  [17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23],
  'Ezra':          [11,70,13,24,17,22,28,36,15,44],
  'Nehemiah':      [11,20,32,23,19,19,73,18,38,39,36,47,31],
  'Esther':        [22,23,15,17,14,14,10,17,32,3],
  'Job':           [22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17],
  'Psalms':        [6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6],
  'Proverbs':      [33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31],
  'Ecclesiastes':  [18,26,22,16,20,12,29,17,18,20,10,14],
  'Song of Solomon':[17,17,11,16,16,13,13,14],
  'Isaiah':        [31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24],
  'Jeremiah':      [19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34],
  'Lamentations':  [22,22,66,22,22],
  'Ezekiel':       [28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35],
  'Daniel':        [21,49,30,37,31,28,28,27,27,21,45,13],
  'Hosea':         [11,23,5,19,15,11,16,14,17,15,12,14,16,9],
  'Joel':          [20,32,21],
  'Amos':          [15,16,15,13,27,14,17,14,15],
  'Obadiah':       [21],
  'Jonah':         [17,10,10,11],
  'Micah':         [16,13,12,13,15,16,20],
  'Nahum':         [15,13,19],
  'Habakkuk':      [17,20,19],
  'Zephaniah':     [18,15,20],
  'Haggai':        [15,23],
  'Zechariah':     [21,13,10,14,11,15,14,23,17,12,17,14,9,21],
  'Malachi':       [14,17,18,6],
  'Matthew':       [25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20],
  'Mark':          [45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20],
  'Luke':          [80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53],
  'John':          [51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25],
  'Acts':          [26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31],
  'Romans':        [32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27],
  '1 Corinthians': [31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24],
  '2 Corinthians': [24,17,18,18,21,18,16,24,15,18,33,21,14],
  'Galatians':     [24,21,29,31,26,18],
  'Ephesians':     [23,22,21,32,33,24],
  'Philippians':   [30,30,21,23],
  'Colossians':    [29,23,25,18],
  '1 Thessalonians':[10,20,13,18,28],
  '2 Thessalonians':[12,17,18],
  '1 Timothy':     [20,15,16,16,25,21],
  '2 Timothy':     [18,26,17,22],
  'Titus':         [16,15,15],
  'Philemon':      [25],
  'Hebrews':       [14,18,19,16,14,20,28,13,28,39,40,29,25],
  'James':         [27,26,18,17,20],
  '1 Peter':       [25,25,22,19,14],
  '2 Peter':       [21,22,18],
  '1 John':        [10,29,24,21,21],
  '2 John':        [13],
  '3 John':        [14],
  'Jude':          [25],
  'Revelation':    [20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21],
};

/** Returns the verse count for a specific chapter, falling back to a reasonable default. */
export const getChapterVerseCount = (bookName: string, chapter: number): number => {
  const counts = BIBLE_VERSE_COUNTS[bookName];
  if (!counts || counts.length === 0) return 50;
  const idx = Math.max(0, Math.min(counts.length - 1, chapter - 1));
  return counts[idx] || 30;
};

const BIBLE_BOOK_ALIASES: Array<{ alias: string; canonicalName: string }> = [
  { alias: 'Psalm', canonicalName: 'Psalms' },
];

const BOOK_MATCHERS = [
  ...BIBLE_BOOKS.map((book) => ({ match: book.name, canonicalBook: book })),
  ...BIBLE_BOOK_ALIASES
    .map((entry) => ({
      match: entry.alias,
      canonicalBook: BIBLE_BOOKS.find((book) => book.name === entry.canonicalName) || null,
    }))
    .filter((entry): entry is { match: string; canonicalBook: BibleBook } => Boolean(entry.canonicalBook)),
].sort((a, b) => b.match.length - a.match.length);

const safeStorageGet = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // best effort
  }
};

const makeVerseCacheKey = (version: string, reference: string) => (
  `${VERSE_CACHE_PREFIX}:${String(version || 'kjv').trim().toLowerCase()}:${reference.toLowerCase()}`
);

const makeSemanticCacheKey = (query: string) => (
  `${SEMANTIC_CACHE_PREFIX}:${String(query || '').trim().toLowerCase()}`
);

export const buildStructuredBibleReference = (
  bookName: string,
  chapter: number,
  verseFrom: number,
  verseTo?: number
) => {
  const safeBook = String(bookName || '').trim();
  if (!safeBook) return '';
  const safeChapter = Math.max(1, Math.round(Number(chapter) || 1));
  const safeVerseFrom = Math.max(1, Math.round(Number(verseFrom) || 1));
  const safeVerseTo = Math.max(safeVerseFrom, Math.round(Number(verseTo) || safeVerseFrom));
  return `${safeBook} ${safeChapter}:${safeVerseFrom}${safeVerseTo > safeVerseFrom ? `-${safeVerseTo}` : ''}`;
};

export const normalizeBibleReference = (input: string): string | null => {
  const compact = String(input || '')
    .replace(/[–—]/g, '-')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) return null;

  const lower = compact.toLowerCase();
  const match = BOOK_MATCHERS.find((entry) => lower.startsWith(entry.match.toLowerCase()));
  if (!match) return null;

  const remainder = compact.slice(match.match.length).trim();
  if (!remainder) return null;

  const chapterVerseMatch = remainder.match(/^(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/);
  if (!chapterVerseMatch) return null;

  const chapter = Number(chapterVerseMatch[1]);
  const verseFromRaw = chapterVerseMatch[2];
  const verseToRaw = chapterVerseMatch[3];

  if (!Number.isFinite(chapter) || chapter < 1) return null;
  if (!verseFromRaw) return `${match.canonicalBook.name} ${chapter}`;

  const verseFrom = Number(verseFromRaw);
  const verseTo = verseToRaw ? Number(verseToRaw) : verseFrom;
  if (!Number.isFinite(verseFrom) || verseFrom < 1) return null;
  if (!Number.isFinite(verseTo) || verseTo < verseFrom) return null;
  return `${match.canonicalBook.name} ${chapter}:${verseFrom}${verseTo > verseFrom ? `-${verseTo}` : ''}`;
};

export const getCachedBibleVerses = (reference: string, version: string): BibleVerse[] | null => {
  const normalized = normalizeBibleReference(reference) || String(reference || '').trim();
  if (!normalized) return null;
  const cacheKey = makeVerseCacheKey(version, normalized);
  const inMemory = verseMemoryCache.get(cacheKey);
  if (inMemory?.verses?.length && (Date.now() - inMemory.savedAt) <= VERSE_CACHE_TTL_MS) {
    return inMemory.verses;
  }
  const raw = safeStorageGet(cacheKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: number; verses?: BibleVerse[] };
    const savedAt = Number(parsed?.savedAt || 0);
    const verses = Array.isArray(parsed?.verses) ? parsed.verses : [];
    if (!savedAt || !verses.length || (Date.now() - savedAt) > VERSE_CACHE_TTL_MS) return null;
    verseMemoryCache.set(cacheKey, { savedAt, verses });
    return verses;
  } catch {
    return null;
  }
};

export const setCachedBibleVerses = (reference: string, version: string, verses: BibleVerse[]) => {
  const normalized = normalizeBibleReference(reference) || String(reference || '').trim();
  if (!normalized || !Array.isArray(verses) || !verses.length) return;
  const cacheKey = makeVerseCacheKey(version, normalized);
  const payload = {
    savedAt: Date.now(),
    verses,
  };
  verseMemoryCache.set(cacheKey, payload);
  safeStorageSet(cacheKey, JSON.stringify(payload));
};

export const getCachedSemanticReference = (query: string): string | null => {
  const cacheKey = makeSemanticCacheKey(query);
  const inMemory = semanticMemoryCache.get(cacheKey);
  if (inMemory?.reference && (Date.now() - inMemory.savedAt) <= SEMANTIC_CACHE_TTL_MS) {
    return inMemory.reference;
  }
  const raw = safeStorageGet(cacheKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: number; reference?: string };
    const savedAt = Number(parsed?.savedAt || 0);
    const reference = normalizeBibleReference(String(parsed?.reference || ''));
    if (!savedAt || !reference || (Date.now() - savedAt) > SEMANTIC_CACHE_TTL_MS) return null;
    semanticMemoryCache.set(cacheKey, { savedAt, reference });
    return reference;
  } catch {
    return null;
  }
};

export const setCachedSemanticReference = (query: string, reference: string) => {
  const normalized = normalizeBibleReference(reference);
  const safeQuery = String(query || '').trim();
  if (!safeQuery || !normalized) return;
  const cacheKey = makeSemanticCacheKey(safeQuery);
  const payload = {
    savedAt: Date.now(),
    reference: normalized,
  };
  semanticMemoryCache.set(cacheKey, payload);
  safeStorageSet(cacheKey, JSON.stringify(payload));
};

export const lookupBibleReference = async (query: string, version: string): Promise<BibleVerse[]> => {
  const normalized = normalizeBibleReference(query) || String(query || '').trim();
  if (!normalized) return [];

  // 1. Cache — shared across all strategies
  const cached = getCachedBibleVerses(normalized, version);
  if (cached?.length) return cached;

  // 2. API.Bible — for copyrighted translations (niv, nkjv, esv, nlt, amp, msg)
  const { isApiBibleTranslation, lookupBibleVerseApiBible } = await import('./bibleApiBible.ts');
  if (isApiBibleTranslation(version)) {
    const apiBibleVerses = await lookupBibleVerseApiBible(normalized, version);
    if (apiBibleVerses?.length) {
      setCachedBibleVerses(normalized, version, apiBibleVerses);
      return apiBibleVerses;
    }
    // Server unavailable or not configured — fall through to KJV via bible-api.com
    const kjvFallback = await lookupBibleReference(normalized, 'kjv');
    return kjvFallback;
  }

  // 3. bible-api.com — public domain translations (kjv, web, bbe, asv, ylt, etc.)
  const lookup = async (translation: string): Promise<BibleVerse[]> => {
    const response = await fetch(`https://bible-api.com/${encodeURIComponent(normalized)}?translation=${translation}`);
    const data = await response.json();
    const verses = Array.isArray(data?.verses) ? data.verses as BibleVerse[] : [];
    if (verses.length) {
      setCachedBibleVerses(normalized, translation, verses);
      if (translation !== version) {
        setCachedBibleVerses(normalized, version, verses);
      }
    }
    return verses;
  };

  let verses = await lookup(version);
  if (!verses.length && String(version || '').toLowerCase() !== 'kjv') {
    verses = await lookup('kjv');
  }
  return verses;
};
