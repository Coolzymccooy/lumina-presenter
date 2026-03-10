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

  const cached = getCachedBibleVerses(normalized, version);
  if (cached?.length) return cached;

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
