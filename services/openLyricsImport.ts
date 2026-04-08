import type {
  Hymn,
  HymnAuthor,
  HymnCopyright,
  HymnSection,
  HymnSectionType,
  HymnThemeCategory,
} from '../types/hymns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map an OpenLyrics verse name attribute → HymnSectionType and human label */
const resolveVerseInfo = (name: string): { type: HymnSectionType; label: string } => {
  const n = name.toLowerCase().trim();

  // verses: v1, v2, v3 …
  const verseMatch = /^v(\d+)$/.exec(n);
  if (verseMatch) return { type: 'verse', label: `Verse ${verseMatch[1]}` };

  // chorus variants
  if (n === 'c' || n === 'ch' || n === 'chorus') return { type: 'chorus', label: 'Chorus' };
  const chorusMatch = /^c(\d+)$/.exec(n);
  if (chorusMatch) return { type: 'chorus', label: `Chorus ${chorusMatch[1]}` };

  // bridge variants
  if (n === 'b' || n === 'br' || n === 'bridge') return { type: 'bridge', label: 'Bridge' };
  const bridgeMatch = /^b(\d+)$/.exec(n);
  if (bridgeMatch) return { type: 'bridge', label: `Bridge ${bridgeMatch[1]}` };

  // other section types
  if (n === 'e' || n === 'ending') return { type: 'ending', label: 'Ending' };
  if (n === 'd' || n === 'doxology') return { type: 'doxology', label: 'Doxology' };
  if (n === 'p' || n === 'prechorus' || n === 'pre') return { type: 'refrain', label: 'Pre-Chorus' };
  if (n === 'o' || n === 'outro') return { type: 'refrain', label: 'Outro' };
  if (n === 'i' || n === 'intro') return { type: 'verse', label: 'Intro' };
  if (n === 't' || n === 'tag') return { type: 'refrain', label: 'Tag' };

  return { type: 'verse', label: name || 'Verse' };
};

/**
 * Extract text from a <lines> element, converting <br/> to newlines
 * and stripping chord / comment elements.
 */
const extractLinesText = (linesEl: Element): string => {
  const clone = linesEl.cloneNode(true) as Element;

  // Replace <br/> with newline markers before text extraction
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));

  // Remove chord, comment, and repeat elements (presentation metadata)
  clone.querySelectorAll('chord, comment, repeat').forEach((el) => el.remove());

  return (clone.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
};

const VALID_THEMES = new Set<HymnThemeCategory>([
  'grace', 'prayer', 'reflection', 'praise', 'majesty', 'victory', 'creation',
  'communion', 'guidance', 'thanksgiving', 'assurance', 'holiness', 'comfort',
  'mission', 'surrender',
]);

const normalizeText = (s: string) =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

const buildId = (title: string, ccliNo: string | null): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return ccliNo ? `ol-${slug}-${ccliNo}` : `ol-${slug}-${Date.now()}`;
};

// ─── Parser ───────────────────────────────────────────────────────────────────

const parseDocument = (doc: Document, fileName: string): Hymn => {
  const songEl = doc.querySelector('song');
  if (!songEl) {
    throw new Error(
      'No <song> element found. This does not appear to be an OpenLyrics file.',
    );
  }

  const propsEl = songEl.querySelector('properties');

  // ── Titles ──────────────────────────────────────────────────────────────────
  const titleEls = propsEl
    ? Array.from(propsEl.querySelectorAll('titles > title'))
    : [];
  const titles = titleEls.map((el) => el.textContent?.trim() ?? '').filter(Boolean);
  const title = titles[0] || fileName.replace(/\.xml$/i, '').trim() || 'Untitled';
  const alternateTitles = titles.slice(1);

  // ── Authors ─────────────────────────────────────────────────────────────────
  const authorEls = propsEl
    ? Array.from(propsEl.querySelectorAll('authors > author'))
    : [];
  const authors: HymnAuthor[] = authorEls.map((el) => {
    const typeAttr = el.getAttribute('type') ?? 'words';
    const roleMap: Record<string, HymnAuthor['role']> = {
      words: 'text',
      music: 'tune',
      translation: 'translator',
    };
    return {
      name: el.textContent?.trim() ?? 'Unknown',
      role: roleMap[typeAttr] ?? 'text',
    };
  });

  // ── Copyright & CCLI ────────────────────────────────────────────────────────
  const copyrightText = propsEl?.querySelector('copyright')?.textContent?.trim() ?? '';
  const ccliNo = propsEl?.querySelector('ccliNo')?.textContent?.trim() ?? null;

  const copyright: HymnCopyright = {
    publicDomain: /public\s+domain/i.test(copyrightText),
    requiresReview: false,
    textPd: /public\s+domain/i.test(copyrightText),
    tunePd: false,
    textAttribution: copyrightText,
    tuneAttribution: '',
  };

  // ── Themes ──────────────────────────────────────────────────────────────────
  const themeEls = propsEl
    ? Array.from(propsEl.querySelectorAll('themes > theme'))
    : [];
  const themes: HymnThemeCategory[] = themeEls
    .map((el) => el.textContent?.trim().toLowerCase() as HymnThemeCategory)
    .filter((t) => VALID_THEMES.has(t));

  // ── Lyrics / Sections ───────────────────────────────────────────────────────
  const lyricsEl = songEl.querySelector('lyrics');
  const verseEls = lyricsEl
    ? Array.from(lyricsEl.querySelectorAll('verse'))
    : [];

  const sections: HymnSection[] = [];
  for (let i = 0; i < verseEls.length; i++) {
    const verseEl = verseEls[i];
    const name = verseEl.getAttribute('name') ?? `v${i + 1}`;
    const { type, label } = resolveVerseInfo(name);

    const linesEls = Array.from(verseEl.querySelectorAll('lines'));
    const text =
      linesEls.length > 0
        ? linesEls
            .map(extractLinesText)
            .filter(Boolean)
            .join('\n\n')
        : (verseEl.textContent?.trim() ?? '');

    if (!text) continue;

    sections.push({ id: `${name}-${i}`, type, label, order: i, text });
  }

  if (sections.length === 0) {
    throw new Error(
      'No lyric verses found in this OpenLyrics file. ' +
      'Please ensure the file contains <verse> elements under <lyrics>.',
    );
  }

  // ── Derived fields ──────────────────────────────────────────────────────────
  const firstLine = sections[0].text.split('\n')[0]?.trim() ?? '';
  const id = buildId(title, ccliNo);
  const normalizedTitle = normalizeText(title.toLowerCase());
  const normalizedFirstLine = normalizeText(firstLine.toLowerCase());
  const tokens = [
    ...new Set([
      ...normalizedTitle.split(' '),
      ...normalizedFirstLine.split(' '),
    ].filter((t) => t.length > 2)),
  ];
  const effectiveThemes: HymnThemeCategory[] = themes.length > 0 ? themes : ['praise'];

  return {
    id,
    title,
    alternateTitles,
    firstLine,
    authors,
    tunes: [],
    themes: effectiveThemes,
    scriptureThemes: [],
    copyright,
    sections,
    searchKeywords: tokens,
    presentationDefaults: {
      defaultTypographyPresetId: 'classic-worship-serif',
      defaultThemeCategory: effectiveThemes[0],
      defaultChorusStrategy: 'smart',
      preferredBackgroundMotion: 'either',
      maxLinesPerSlide: 4,
      preferredCharsPerLine: 40,
      allowThreeLineSlides: true,
      chorusVisuallyDistinct: true,
    },
    librarySource: {
      kind: 'imported',
      isBundled: false,
      ...(ccliNo ? { externalId: ccliNo } : {}),
      displayLabel: 'OpenLyrics Import',
    },
    usageRights: {
      licenseScope: 'single-workspace-import',
      canProject: true,
      canStream: false,
      requiresLicenseCheck: false,
      canStoreText: true,
      canDistributeInApp: false,
      requiresAttribution: false,
    },
    searchIndex: {
      normalizedTitle,
      normalizedFirstLine,
      keywords: tokens,
      themes: effectiveThemes,
      tokens,
      searchableText: `${normalizedTitle} ${normalizedFirstLine}`,
    },
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse an OpenLyrics .xml file into a {@link Hymn}.
 *
 * OpenLyrics is an open XML standard used by OpenLP, WorshipAssistant, and
 * other free worship databases.  Spec: https://openlyrics.org/dataformat.html
 */
export const parseOpenLyricsFile = async (file: File): Promise<Hymn> => {
  if (!file.name.toLowerCase().endsWith('.xml')) {
    throw new Error(
      'Please upload an OpenLyrics .xml file. ' +
      'You can export songs in OpenLyrics format from OpenLP, WorshipAssistant, and similar apps.',
    );
  }

  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error(
      'This file could not be parsed as XML. ' +
      'Please ensure it is a valid OpenLyrics file exported from your worship software.',
    );
  }

  if (!doc.querySelector('song')) {
    throw new Error(
      'No <song> element found. This does not appear to be an OpenLyrics file. ' +
      'Supported format: OpenLyrics XML (.xml).',
    );
  }

  return parseDocument(doc, file.name);
};
