/**
 * Runtime validators for Hymn JSON import records.
 * No external dependencies — pure TypeScript type narrowing.
 *
 * Used by the import pipeline scripts (normalizePdHymn, buildPdBundle)
 * to catch bad data before it reaches the seed or the catalog.
 */

import type {
  HymnSectionType,
  HymnThemeCategory,
  HymnChorusStrategy,
  HymnBackgroundMotionMode,
} from './hymns.ts';

// ─── Import record shape ──────────────────────────────────────────────────────
// This is the "raw" format stored in data/hymns/pd/*.json.
// It omits `searchIndex` (computed) and uses optional fields where sensible.

export type HymnImportStatus = 'raw' | 'normalized' | 'approved';

export interface HymnSectionImport {
  id: string;
  type: HymnSectionType;
  label: string;
  order: number;
  text: string;
  repeatMode?: 'none' | 'each-verse' | 'explicit';
  visuallyDistinct?: boolean;
}

export interface HymnImportRecord {
  status: HymnImportStatus;
  id: string;
  title: string;
  alternateTitles?: string[];
  firstLine: string;
  meter?: string;
  hymnalNumbers?: Record<string, number>;
  authors: Array<{
    name: string;
    role: 'text' | 'tune' | 'translator' | 'paraphrase' | 'attribution';
    notes?: string;
  }>;
  tunes: Array<{
    name: string;
    composer?: string;
    meter?: string;
    alternateNames?: string[];
  }>;
  themes: HymnThemeCategory[];
  scriptureThemes?: string[];
  searchKeywords?: string[];
  textAttribution: string;
  tuneAttribution: string;
  publicDomainBasis?: string;
  copyrightNotes?: string[];
  sections: HymnSectionImport[];
  defaultTypographyPresetId?: string;
  defaultThemeCategory?: HymnThemeCategory;
  defaultChorusStrategy?: HymnChorusStrategy;
  preferredBackgroundMotion?: HymnBackgroundMotionMode;
  maxLinesPerSlide?: number;
  preferredCharsPerLine?: number;
  allowThreeLineSlides?: boolean;
  chorusVisuallyDistinct?: boolean;
}

// ─── Validation error ─────────────────────────────────────────────────────────

export interface HymnValidationError {
  field: string;
  message: string;
}

export interface HymnValidationResult {
  valid: boolean;
  errors: HymnValidationError[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_SECTION_TYPES: HymnSectionType[] = [
  'verse', 'refrain', 'chorus', 'bridge', 'ending', 'doxology',
];

const VALID_THEMES: HymnThemeCategory[] = [
  'grace', 'prayer', 'reflection', 'praise', 'majesty', 'victory',
  'creation', 'communion', 'guidance', 'thanksgiving', 'assurance',
  'holiness', 'comfort', 'mission', 'surrender',
];

const VALID_AUTHOR_ROLES = ['text', 'tune', 'translator', 'paraphrase', 'attribution'] as const;

const VALID_CHORUS_STRATEGIES: HymnChorusStrategy[] = [
  'smart', 'repeat-after-every-verse', 'explicit-only', 'suppress-repeats',
];

const VALID_MOTION_MODES: HymnBackgroundMotionMode[] = ['still', 'motion', 'either'];

// ─── Field validators ─────────────────────────────────────────────────────────

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((item) => typeof item === 'string');

// ─── Main validator ───────────────────────────────────────────────────────────

export const validateHymnImportRecord = (raw: unknown): HymnValidationResult => {
  const errors: HymnValidationError[] = [];
  const err = (field: string, message: string) => errors.push({ field, message });

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'Record must be a non-null object.' }] };
  }

  const rec = raw as Record<string, unknown>;

  // status
  if (!['raw', 'normalized', 'approved'].includes(rec.status as string)) {
    err('status', `Must be 'raw', 'normalized', or 'approved'. Got: ${String(rec.status)}`);
  }

  // identity
  if (!isNonEmptyString(rec.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rec.id)) {
    err('id', 'Must be a non-empty kebab-case string (a-z, 0-9, hyphens).');
  }
  if (!isNonEmptyString(rec.title)) err('title', 'Must be a non-empty string.');
  if (!isNonEmptyString(rec.firstLine)) err('firstLine', 'Must be a non-empty string.');

  // hymnalNumbers
  if (rec.hymnalNumbers !== undefined) {
    if (typeof rec.hymnalNumbers !== 'object' || rec.hymnalNumbers === null || Array.isArray(rec.hymnalNumbers)) {
      err('hymnalNumbers', 'Must be a Record<string, number> if provided.');
    } else {
      const nums = rec.hymnalNumbers as Record<string, unknown>;
      Object.entries(nums).forEach(([key, val]) => {
        if (!isPositiveInt(val)) err(`hymnalNumbers.${key}`, `Must be a positive integer. Got: ${String(val)}`);
      });
    }
  }

  // authors
  if (!Array.isArray(rec.authors) || rec.authors.length === 0) {
    err('authors', 'Must be a non-empty array.');
  } else {
    (rec.authors as unknown[]).forEach((author, i) => {
      if (!author || typeof author !== 'object') { err(`authors[${i}]`, 'Must be an object.'); return; }
      const a = author as Record<string, unknown>;
      if (!isNonEmptyString(a.name)) err(`authors[${i}].name`, 'Must be a non-empty string.');
      if (!VALID_AUTHOR_ROLES.includes(a.role as never)) {
        err(`authors[${i}].role`, `Must be one of: ${VALID_AUTHOR_ROLES.join(', ')}.`);
      }
    });
  }

  // tunes
  if (!Array.isArray(rec.tunes)) {
    err('tunes', 'Must be an array (can be empty for unaccompanied hymns).');
  } else {
    (rec.tunes as unknown[]).forEach((tune, i) => {
      if (!tune || typeof tune !== 'object') { err(`tunes[${i}]`, 'Must be an object.'); return; }
      const t = tune as Record<string, unknown>;
      if (!isNonEmptyString(t.name)) err(`tunes[${i}].name`, 'Must be a non-empty string.');
    });
  }

  // themes
  if (!Array.isArray(rec.themes) || rec.themes.length === 0) {
    err('themes', 'Must be a non-empty array.');
  } else {
    (rec.themes as unknown[]).forEach((theme, i) => {
      if (!VALID_THEMES.includes(theme as HymnThemeCategory)) {
        err(`themes[${i}]`, `Unknown theme '${String(theme)}'. Valid: ${VALID_THEMES.join(', ')}.`);
      }
    });
  }

  // optional string arrays
  if (rec.scriptureThemes !== undefined && !isStringArray(rec.scriptureThemes)) {
    err('scriptureThemes', 'Must be a string array if provided.');
  }
  if (rec.searchKeywords !== undefined && !isStringArray(rec.searchKeywords)) {
    err('searchKeywords', 'Must be a string array if provided.');
  }

  // copyright
  if (!isNonEmptyString(rec.textAttribution)) err('textAttribution', 'Must be a non-empty string.');
  if (!isNonEmptyString(rec.tuneAttribution)) err('tuneAttribution', 'Must be a non-empty string.');

  // sections
  if (!Array.isArray(rec.sections) || rec.sections.length === 0) {
    err('sections', 'Must be a non-empty array.');
  } else {
    (rec.sections as unknown[]).forEach((section, i) => {
      if (!section || typeof section !== 'object') { err(`sections[${i}]`, 'Must be an object.'); return; }
      const s = section as Record<string, unknown>;
      if (!isNonEmptyString(s.id)) err(`sections[${i}].id`, 'Must be a non-empty string.');
      if (!VALID_SECTION_TYPES.includes(s.type as HymnSectionType)) {
        err(`sections[${i}].type`, `Unknown type '${String(s.type)}'. Valid: ${VALID_SECTION_TYPES.join(', ')}.`);
      }
      if (!isNonEmptyString(s.label)) err(`sections[${i}].label`, 'Must be a non-empty string.');
      if (typeof s.order !== 'number') err(`sections[${i}].order`, 'Must be a number.');
      if (!isNonEmptyString(s.text)) err(`sections[${i}].text`, 'Must be a non-empty string.');
    });

    // duplicate section IDs
    const sectionIds = (rec.sections as Array<Record<string, unknown>>).map((s) => s.id);
    const uniqueIds = new Set(sectionIds);
    if (uniqueIds.size !== sectionIds.length) {
      err('sections', 'Duplicate section IDs found.');
    }
  }

  // optional presentation defaults
  if (rec.defaultChorusStrategy !== undefined && !VALID_CHORUS_STRATEGIES.includes(rec.defaultChorusStrategy as HymnChorusStrategy)) {
    err('defaultChorusStrategy', `Must be one of: ${VALID_CHORUS_STRATEGIES.join(', ')}.`);
  }
  if (rec.preferredBackgroundMotion !== undefined && !VALID_MOTION_MODES.includes(rec.preferredBackgroundMotion as HymnBackgroundMotionMode)) {
    err('preferredBackgroundMotion', `Must be one of: ${VALID_MOTION_MODES.join(', ')}.`);
  }
  if (rec.maxLinesPerSlide !== undefined && (typeof rec.maxLinesPerSlide !== 'number' || rec.maxLinesPerSlide < 1 || rec.maxLinesPerSlide > 4)) {
    err('maxLinesPerSlide', 'Must be a number between 1 and 4.');
  }

  return { valid: errors.length === 0, errors };
};

/** Throws with a formatted message if the record is invalid. */
export const assertValidHymnImportRecord = (raw: unknown, source = 'unknown'): void => {
  const result = validateHymnImportRecord(raw);
  if (!result.valid) {
    const lines = result.errors.map((e) => `  • ${e.field}: ${e.message}`).join('\n');
    throw new Error(`Invalid hymn record in "${source}":\n${lines}`);
  }
};
