import { normalizeBibleReference, type BibleVerse } from './bibleLookup.ts';

export type BibleMemoryProviderKind = 'bundled-json' | 'indexeddb' | 'sqlite' | 'hybrid';
export type BibleMemorySource = 'bundled' | 'device-cache' | 'runtime-prefetch' | 'remote-mirror';
export type BibleMemorySearchMode = 'auto' | 'reference' | 'phrase' | 'keyword' | 'theme' | 'semantic-hint';
export type BibleMemoryQueryOrigin = 'typed' | 'voice_partial' | 'voice_final' | 'auto_project' | 'system';
export type BibleMemoryHealthStatus = 'ready' | 'warming' | 'degraded' | 'offline';
export type BibleCanonicalDivision = 'old-testament' | 'new-testament';

export interface BibleMemoryPassageLocator {
  reference: string;
  normalizedReference: string;
  translationId: string;
  bookName: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  verseCount: number;
  division: BibleCanonicalDivision;
}

export interface BibleMemoryTokenProfile {
  allTokens: string[];
  matchedTokens?: string[];
  rareTokens?: string[];
}

export interface BibleMemoryPassageDocument {
  id: string;
  locator: BibleMemoryPassageLocator;
  title: string;
  plainText: string;
  lines: string[];
  themes: string[];
  keywords: string[];
  aliases: string[];
  people?: string[];
  places?: string[];
  events?: string[];
  popularityHint?: number;
  source: BibleMemorySource;
  lastAccessedAt?: number;
  verses: BibleVerse[];
}

export interface BibleMemorySearchQuery {
  rawQuery: string;
  normalizedQuery: string;
  translationId: string;
  origin: BibleMemoryQueryOrigin;
  mode: BibleMemorySearchMode;
  maxResults: number;
  includeThemes: boolean;
  includeAliases: boolean;
  exactOnly: boolean;
  recentReferences: string[];
  contextHints: string[];
  preferredBooks?: string[];
}

export interface BibleMemorySearchHit {
  passage: BibleMemoryPassageDocument;
  reference: string;
  confidence: number;
  matchedTerms: string[];
  matchedThemes: string[];
  matchReason: string;
  mode: Exclude<BibleMemorySearchMode, 'auto'> | 'reference-cache';
  tokenProfile: BibleMemoryTokenProfile;
}

export interface BibleMemorySearchResult {
  providerId: string;
  cacheStatus: 'memory-hit' | 'storage-hit' | 'fresh' | 'miss';
  tookMs: number;
  query: BibleMemorySearchQuery;
  hits: BibleMemorySearchHit[];
}

export interface BibleMemoryPrefetchRequest {
  references: string[];
  translationId: string;
  priority: 'immediate' | 'warm' | 'idle';
  reason: string;
}

export interface BibleMemoryPrefetchResult {
  requestedReferences: string[];
  hydratedReferences: string[];
  skippedReferences: string[];
}

export interface BibleMemoryHealth {
  providerId: string;
  kind: BibleMemoryProviderKind;
  status: BibleMemoryHealthStatus;
  totalPassages: number;
  translations: string[];
  supportsThemeSearch: boolean;
  supportsSemanticHints: boolean;
  lastIndexedAt?: number;
}

export interface BibleMemoryProvider {
  id: string;
  kind: BibleMemoryProviderKind;
  isReady: () => boolean | Promise<boolean>;
  getHealth: () => BibleMemoryHealth | Promise<BibleMemoryHealth>;
  getPassageByReference: (reference: string, translationId: string) => Promise<BibleMemoryPassageDocument | null>;
  search: (query: BibleMemorySearchQuery) => Promise<BibleMemorySearchResult>;
  prefetch: (request: BibleMemoryPrefetchRequest) => Promise<BibleMemoryPrefetchResult>;
}

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_TOPIC_MEMORY_TRANSLATION = 'kjv';

const CURATED_TOPIC_MEMORY_SEED: Array<{
  reference: string;
  lines: string[];
  themes: string[];
  keywords: string[];
  aliases: string[];
  division: BibleCanonicalDivision;
}> = [
  {
    reference: 'Philippians 4:6-7',
    lines: ['Be careful for nothing...', 'the peace of God, which passeth all understanding...'],
    themes: ['peace', 'anxiety', 'comfort'],
    keywords: ['peace', 'anxiety', 'worry', 'stress', 'trouble', 'comfort'],
    aliases: ['do not be anxious', 'peace of God'],
    division: 'new-testament',
  },
  {
    reference: 'Psalms 34:18',
    lines: ['The Lord is nigh unto them that are of a broken heart...'],
    themes: ['grief', 'comfort', 'healing'],
    keywords: ['grief', 'mourning', 'loss', 'broken', 'sad', 'comfort'],
    aliases: ['broken heart', 'crushed in spirit'],
    division: 'old-testament',
  },
  {
    reference: 'Isaiah 41:10',
    lines: ['Fear thou not; for I am with thee...'],
    themes: ['fear', 'courage', 'presence'],
    keywords: ['fear', 'afraid', 'panic', 'courage', 'help'],
    aliases: ['do not fear', 'I am with thee'],
    division: 'old-testament',
  },
  {
    reference: 'Isaiah 40:31',
    lines: ['But they that wait upon the Lord shall renew their strength...'],
    themes: ['strength', 'renewal', 'endurance'],
    keywords: ['strength', 'weak', 'tired', 'weary', 'renewal'],
    aliases: ['renew their strength', 'mount up with wings'],
    division: 'old-testament',
  },
  {
    reference: 'Proverbs 3:5-6',
    lines: ['Trust in the Lord with all thine heart...', 'and he shall direct thy paths.'],
    themes: ['guidance', 'wisdom', 'trust'],
    keywords: ['guidance', 'direction', 'decision', 'wisdom', 'trust'],
    aliases: ['direct thy paths', 'lean not on your own understanding'],
    division: 'old-testament',
  },
  {
    reference: 'Jeremiah 30:17',
    lines: ['For I will restore health unto thee, and I will heal thee of thy wounds...'],
    themes: ['healing', 'restoration', 'health'],
    keywords: ['healing', 'sick', 'pain', 'disease', 'restore'],
    aliases: ['restore health', 'heal thy wounds'],
    division: 'old-testament',
  },
  {
    reference: '1 John 1:9',
    lines: ['If we confess our sins, he is faithful and just to forgive us our sins...'],
    themes: ['forgiveness', 'mercy', 'cleansing'],
    keywords: ['forgive', 'forgiveness', 'guilt', 'sin', 'shame', 'cleanse'],
    aliases: ['confess our sins', 'forgive us our sins'],
    division: 'new-testament',
  },
  {
    reference: '1 Corinthians 13:4-7',
    lines: ['Charity suffereth long, and is kind...', 'beareth all things, believeth all things...'],
    themes: ['love', 'marriage', 'family'],
    keywords: ['marriage', 'family', 'relationship', 'love', 'wedding'],
    aliases: ['love is patient', 'love is kind'],
    division: 'new-testament',
  },
  {
    reference: 'Romans 15:13',
    lines: ['Now the God of hope fill you with all joy and peace in believing...'],
    themes: ['hope', 'joy', 'future'],
    keywords: ['hope', 'future', 'discourage', 'depress', 'joy'],
    aliases: ['God of hope', 'abound in hope'],
    division: 'new-testament',
  },
  {
    reference: 'Psalms 91:1-2',
    lines: ['He that dwelleth in the secret place of the most High...', 'I will say of the Lord, He is my refuge...'],
    themes: ['protection', 'refuge', 'safety'],
    keywords: ['protection', 'danger', 'battle', 'war', 'refuge', 'safety'],
    aliases: ['secret place', 'my refuge and fortress'],
    division: 'old-testament',
  },
  {
    reference: 'Psalms 23:1-4',
    lines: ['The Lord is my shepherd; I shall not want...', 'Yea, though I walk through the valley...'],
    themes: ['comfort', 'guidance', 'hope'],
    keywords: ['comfort', 'shepherd', 'valley', 'guidance', 'care'],
    aliases: ['the Lord is my shepherd', 'valley of the shadow of death'],
    division: 'old-testament',
  },
];

export const normalizeBibleMemoryText = (value: string): string => (
  String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9:\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

export const tokenizeBibleMemoryText = (value: string): string[] => (
  normalizeBibleMemoryText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
);

export const buildBibleMemoryPassageId = (reference: string, translationId: string): string => {
  const normalizedReference = normalizeBibleReference(reference) || normalizeBibleMemoryText(reference) || 'unknown-reference';
  const safeTranslation = normalizeBibleMemoryText(translationId) || 'kjv';
  return `${safeTranslation}:${normalizedReference.replace(/\s+/g, '-').replace(/:/g, '_').replace(/-+/g, '-')}`;
};

export const createBibleMemorySearchQuery = (
  rawQuery: string,
  options: Partial<Omit<BibleMemorySearchQuery, 'rawQuery' | 'normalizedQuery'>> = {}
): BibleMemorySearchQuery => ({
  rawQuery: String(rawQuery || '').trim(),
  normalizedQuery: normalizeBibleMemoryText(rawQuery),
  translationId: String(options.translationId || 'kjv').trim().toLowerCase() || 'kjv',
  origin: options.origin || 'typed',
  mode: options.mode || 'auto',
  maxResults: Math.max(1, Math.min(10, Number(options.maxResults || DEFAULT_MAX_RESULTS))),
  includeThemes: options.includeThemes ?? true,
  includeAliases: options.includeAliases ?? true,
  exactOnly: options.exactOnly ?? false,
  recentReferences: Array.isArray(options.recentReferences) ? options.recentReferences.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
  contextHints: Array.isArray(options.contextHints) ? options.contextHints.map((entry) => normalizeBibleMemoryText(entry)).filter(Boolean) : [],
  preferredBooks: Array.isArray(options.preferredBooks) ? options.preferredBooks.map((entry) => String(entry || '').trim()).filter(Boolean) : undefined,
});

export const createNullBibleMemoryProvider = (): BibleMemoryProvider => ({
  id: 'null-bible-memory',
  kind: 'bundled-json',
  isReady: () => false,
  getHealth: () => ({
    providerId: 'null-bible-memory',
    kind: 'bundled-json',
    status: 'offline',
    totalPassages: 0,
    translations: [],
    supportsThemeSearch: false,
    supportsSemanticHints: false,
  }),
  getPassageByReference: async () => null,
  search: async (query) => ({
    providerId: 'null-bible-memory',
    cacheStatus: 'miss',
    tookMs: 0,
    query,
    hits: [],
  }),
  prefetch: async (request) => ({
    requestedReferences: request.references,
    hydratedReferences: [],
    skippedReferences: request.references,
  }),
});

const parseReferenceParts = (reference: string): BibleMemoryPassageLocator => {
  const normalizedReference = normalizeBibleReference(reference) || reference;
  const match = normalizedReference.match(/^(.*)\s+(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/);
  const bookName = String(match?.[1] || normalizedReference).trim();
  const chapter = Number(match?.[2] || 1);
  const verseStart = Number(match?.[3] || 1);
  const verseEnd = Number(match?.[4] || match?.[3] || 1);
  return {
    reference: normalizedReference,
    normalizedReference,
    translationId: DEFAULT_TOPIC_MEMORY_TRANSLATION,
    bookName,
    chapter,
    verseStart,
    verseEnd,
    verseCount: Math.max(1, verseEnd - verseStart + 1),
    division: normalizedReference.startsWith('Matthew') || normalizedReference.startsWith('Mark') || normalizedReference.startsWith('Luke') || normalizedReference.startsWith('John') || normalizedReference.startsWith('Acts') || normalizedReference.startsWith('Romans') || normalizedReference.startsWith('1 Corinthians') || normalizedReference.startsWith('2 Corinthians') || normalizedReference.startsWith('Galatians') || normalizedReference.startsWith('Ephesians') || normalizedReference.startsWith('Philippians') || normalizedReference.startsWith('Colossians') || normalizedReference.startsWith('1 Thessalonians') || normalizedReference.startsWith('2 Thessalonians') || normalizedReference.startsWith('1 Timothy') || normalizedReference.startsWith('2 Timothy') || normalizedReference.startsWith('Titus') || normalizedReference.startsWith('Philemon') || normalizedReference.startsWith('Hebrews') || normalizedReference.startsWith('James') || normalizedReference.startsWith('1 Peter') || normalizedReference.startsWith('2 Peter') || normalizedReference.startsWith('1 John') || normalizedReference.startsWith('2 John') || normalizedReference.startsWith('3 John') || normalizedReference.startsWith('Jude') || normalizedReference.startsWith('Revelation')
      ? 'new-testament'
      : 'old-testament',
  };
};

const createCuratedPassageDocument = (
  entry: (typeof CURATED_TOPIC_MEMORY_SEED)[number]
): BibleMemoryPassageDocument => {
  const locator = parseReferenceParts(entry.reference);
  locator.division = entry.division;
  return {
    id: buildBibleMemoryPassageId(locator.reference, DEFAULT_TOPIC_MEMORY_TRANSLATION),
    locator,
    title: locator.reference,
    plainText: entry.lines.join(' '),
    lines: entry.lines,
    themes: entry.themes,
    keywords: entry.keywords,
    aliases: entry.aliases,
    source: 'bundled',
    verses: [],
  };
};

const scoreBundledTopicMemoryHit = (
  passage: BibleMemoryPassageDocument,
  query: BibleMemorySearchQuery
): BibleMemorySearchHit | null => {
  const normalizedReference = normalizeBibleReference(query.rawQuery);
  if (normalizedReference && normalizedReference === passage.locator.normalizedReference) {
    return {
      passage,
      reference: passage.locator.reference,
      confidence: 0.99,
      matchedTerms: [normalizedReference],
      matchedThemes: [],
      matchReason: 'Matched an exact bundled topical reference.',
      mode: 'reference',
      tokenProfile: { allTokens: tokenizeBibleMemoryText(query.rawQuery), matchedTokens: [normalizedReference] },
    };
  }

  const queryTokens = tokenizeBibleMemoryText(query.rawQuery);
  const hintTokens = query.contextHints.flatMap((entry) => tokenizeBibleMemoryText(entry));
  const allQueryTokens = Array.from(new Set([...queryTokens, ...hintTokens]));
  if (!allQueryTokens.length) return null;

  const keywordTokens = tokenizeBibleMemoryText(passage.keywords.join(' '));
  const aliasTokens = tokenizeBibleMemoryText(passage.aliases.join(' '));
  const themeTokens = tokenizeBibleMemoryText(passage.themes.join(' '));
  const passageTokens = tokenizeBibleMemoryText(`${passage.title} ${passage.plainText}`);
  const tokenPool = new Set([...keywordTokens, ...aliasTokens, ...themeTokens, ...passageTokens]);
  const matchedTerms = allQueryTokens.filter((token) => tokenPool.has(token));
  const matchedThemes = passage.themes.filter((theme) => allQueryTokens.includes(normalizeBibleMemoryText(theme)));
  if (!matchedTerms.length && !matchedThemes.length) return null;

  const recentBoost = query.recentReferences.includes(passage.locator.reference) ? 0.05 : 0;
  const phraseBoost = passage.aliases.some((alias) => query.normalizedQuery.includes(normalizeBibleMemoryText(alias))) ? 0.18 : 0;
  const themeBoost = matchedThemes.length ? 0.12 : 0;
  const overlapScore = matchedTerms.length / Math.max(1, Math.min(allQueryTokens.length, 5));
  const confidence = Math.max(0.55, Math.min(0.96, (overlapScore * 0.68) + phraseBoost + themeBoost + recentBoost));

  return {
    passage,
    reference: passage.locator.reference,
    confidence,
    matchedTerms,
    matchedThemes,
    matchReason: matchedThemes.length
      ? 'Matched bundled topical themes and keyword overlap.'
      : 'Matched bundled topical keywords and aliases.',
    mode: matchedThemes.length ? 'theme' : 'keyword',
    tokenProfile: {
      allTokens: allQueryTokens,
      matchedTokens: matchedTerms,
    },
  };
};

export const createBundledTopicBibleMemoryProvider = (
  documents: BibleMemoryPassageDocument[] = CURATED_TOPIC_MEMORY_SEED.map(createCuratedPassageDocument)
): BibleMemoryProvider => {
  const byReference = new Map(
    documents.map((document) => [document.locator.normalizedReference.toLowerCase(), document])
  );

  return {
    id: 'bundled-topic-memory',
    kind: 'bundled-json',
    isReady: () => true,
    getHealth: () => ({
      providerId: 'bundled-topic-memory',
      kind: 'bundled-json',
      status: 'ready',
      totalPassages: documents.length,
      translations: [DEFAULT_TOPIC_MEMORY_TRANSLATION],
      supportsThemeSearch: true,
      supportsSemanticHints: true,
    }),
    getPassageByReference: async (reference) => {
      const normalizedReference = normalizeBibleReference(reference);
      if (!normalizedReference) return null;
      return byReference.get(normalizedReference.toLowerCase()) || null;
    },
    search: async (query) => {
      const startedAt = Date.now();
      const hits = documents
        .map((document) => scoreBundledTopicMemoryHit(document, query))
        .filter((entry): entry is BibleMemorySearchHit => Boolean(entry))
        .sort((left, right) => right.confidence - left.confidence)
        .slice(0, query.maxResults);
      return {
        providerId: 'bundled-topic-memory',
        cacheStatus: hits.length ? 'memory-hit' : 'miss',
        tookMs: Math.max(0, Date.now() - startedAt),
        query,
        hits,
      };
    },
    prefetch: async (request) => {
      const normalizedReferences = request.references
        .map((reference) => normalizeBibleReference(reference))
        .filter((reference): reference is string => Boolean(reference));
      const hydratedReferences = normalizedReferences.filter((reference) => byReference.has(reference.toLowerCase()));
      const hydratedSet = new Set(hydratedReferences);
      return {
        requestedReferences: request.references,
        hydratedReferences,
        skippedReferences: request.references.filter((reference) => {
          const normalizedReference = normalizeBibleReference(reference);
          return !normalizedReference || !hydratedSet.has(normalizedReference);
        }),
      };
    },
  };
};
