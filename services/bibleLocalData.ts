/**
 * bibleLocalData.ts
 *
 * Offline Bible service — loads bundled KJV and WEB translations from
 * static JSON files in public/data/bibles/.  Copyrighted translations
 * (NKJV, NIV, Amplified, The Message, ESV, NLT, etc.) are NOT included
 * and remain online-only via bible-api.com.
 */

import { type BibleVerse } from './bibleLookup';

// ── Bundled translation registry ─────────────────────────────────────
// Relative URL uses './' so it resolves under both Vite dev server
// (http://localhost:5173) and Electron file:// renderer.

const OFFLINE_TRANSLATIONS: Record<string, string> = {
  kjv: './data/bibles/kjv.json',
  web: './data/bibles/web.json',
};

export const OFFLINE_FALLBACK_TRANSLATION = 'kjv';

// ── Types ────────────────────────────────────────────────────────────

/** { "Genesis": { "1": { "1": "In the beginning...", ... }, ... }, ... } */
type BibleDataMap = Record<string, Record<string, Record<string, string>>>;

// ── In-memory cache (one fetch per translation, kept forever) ────────

const translationCache = new Map<string, BibleDataMap>();

// ── Public API ───────────────────────────────────────────────────────

/** Returns true when the given translation ID is bundled for offline use. */
export const isTranslationBundled = (translation: string): boolean =>
  Object.hasOwn(OFFLINE_TRANSLATIONS, String(translation || '').trim().toLowerCase());

/** Returns the offline fallback translation ID ('kjv'). */
export const getOfflineFallbackTranslation = (): string => OFFLINE_FALLBACK_TRANSLATION;

/**
 * Look up verses from the local bundle.
 *
 * @param reference - A normalised Bible reference, e.g. "John 3:16", "Genesis 1:1-5", "Psalms 23"
 * @param translation - Translation ID, e.g. "kjv" or "web"
 * @returns Matching BibleVerse[], or null when the translation is not
 *          bundled or the reference cannot be resolved locally.
 */
export const lookupBibleVerseLocal = async (
  reference: string,
  translation: string,
): Promise<BibleVerse[] | null> => {
  const tid = String(translation || '').trim().toLowerCase();
  if (!OFFLINE_TRANSLATIONS[tid]) return null;

  const data = await loadTranslation(tid);
  if (!data) return null;

  const parsed = parseReference(reference);
  if (!parsed) return null;

  const bookData = data[parsed.bookName];
  if (!bookData) return null;

  const bookId = toBookId(parsed.bookName);
  const verses: BibleVerse[] = [];

  if (parsed.verseFrom !== undefined) {
    // Specific verse or verse range
    const chapterData = bookData[String(parsed.chapter)];
    if (!chapterData) return null;

    for (let v = parsed.verseFrom; v <= (parsed.verseTo ?? parsed.verseFrom); v++) {
      const text = chapterData[String(v)];
      if (text !== undefined) {
        verses.push({
          book_id: bookId,
          book_name: parsed.bookName,
          chapter: parsed.chapter,
          verse: v,
          text,
        });
      }
    }
  } else {
    // Whole chapter
    const chapterData = bookData[String(parsed.chapter)];
    if (!chapterData) return null;

    const verseNums = Object.keys(chapterData).map(Number).sort((a, b) => a - b);
    for (const v of verseNums) {
      verses.push({
        book_id: bookId,
        book_name: parsed.bookName,
        chapter: parsed.chapter,
        verse: v,
        text: chapterData[String(v)],
      });
    }
  }

  return verses.length > 0 ? verses : null;
};

// ── Internal helpers ─────────────────────────────────────────────────

async function loadTranslation(tid: string): Promise<BibleDataMap | null> {
  const cached = translationCache.get(tid);
  if (cached) return cached;

  const url = OFFLINE_TRANSLATIONS[tid];
  if (!url) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: BibleDataMap = await res.json();
    translationCache.set(tid, data);
    return data;
  } catch {
    return null;
  }
}

interface ParsedRef {
  bookName: string;
  chapter: number;
  verseFrom?: number;
  verseTo?: number;
}

/**
 * Parse an already-normalised Bible reference (output of normalizeBibleReference).
 * Accepted forms:
 *   "Book Ch"          → whole chapter
 *   "Book Ch:V"        → single verse
 *   "Book Ch:V-V2"     → verse range
 *
 * Book names may contain spaces (e.g. "Song of Solomon"), so we use a greedy
 * regex that captures everything up to the trailing number block.
 */
function parseReference(reference: string): ParsedRef | null {
  const input = String(reference || '').trim();
  if (!input) return null;

  // Match: <book name> <chapter>[:<verseFrom>[-<verseTo>]]
  const m = input.match(/^(.+?) (\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/);
  if (!m) return null;

  const bookName = m[1];
  const chapter = Number(m[2]);
  const verseFrom = m[3] !== undefined ? Number(m[3]) : undefined;
  const verseTo = m[4] !== undefined ? Number(m[4]) : verseFrom;

  return { bookName, chapter, verseFrom, verseTo };
}

/** Convert canonical book name to book_id (lowercase, no spaces). */
function toBookId(bookName: string): string {
  return bookName.toLowerCase().replace(/\s+/g, '');
}
