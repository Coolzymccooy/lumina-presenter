import type { BibleVerse } from './bibleLookup.ts';

const SERVER_BASE = 'http://localhost:8787';

// These translation IDs are routed through the local API.Bible proxy.
// Must match the keys in APIBIBLE_TRANSLATION_IDS in server/index.js.
export const API_BIBLE_TRANSLATIONS = new Set(['niv', 'nkjv', 'esv', 'nlt', 'amp', 'msg']);

export const isApiBibleTranslation = (translation: string): boolean =>
  API_BIBLE_TRANSLATIONS.has(String(translation || '').toLowerCase().trim());

export const lookupBibleVerseApiBible = async (
  reference: string,
  translation: string
): Promise<BibleVerse[] | null> => {
  try {
    const url = new URL(`${SERVER_BASE}/api/bible/verse`);
    url.searchParams.set('ref', reference);
    url.searchParams.set('translation', translation);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return null;

    const data = await response.json() as { ok: boolean; verses?: BibleVerse[] };
    if (!data?.ok || !Array.isArray(data.verses) || !data.verses.length) return null;
    return data.verses;
  } catch {
    return null;
  }
};
