#!/usr/bin/env node
/**
 * scripts/normalizePdHymn.mjs
 *
 * Validates a raw hymn JSON file, builds its searchIndex, and stamps it
 * status: "normalized". Run before bulk ingest or review.
 *
 * Usage:
 *   node scripts/normalizePdHymn.mjs data/hymns/pd/amazing-grace.json
 *   node scripts/normalizePdHymn.mjs data/hymns/pd/   # process whole folder
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';

// ─── Text normalization (mirrors hymnSearch.ts) ───────────────────────────────

const normalizeText = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

// ─── searchIndex builder ──────────────────────────────────────────────────────

const buildSearchIndex = (rec) => {
  const searchables = [
    rec.title,
    ...(rec.alternateTitles ?? []),
    rec.firstLine,
    ...(rec.authors ?? []).map((a) => a.name),
    ...(rec.tunes ?? []).flatMap((t) => [t.name, ...(t.alternateNames ?? [])]),
    ...(rec.themes ?? []),
    ...(rec.scriptureThemes ?? []),
    ...(rec.searchKeywords ?? []),
  ].filter(Boolean);

  const tokens = Array.from(
    new Set(
      searchables
        .flatMap((s) => normalizeText(s).split(/\s+/))
        .filter((t) => t.length > 1),
    ),
  );

  return {
    normalizedTitle: normalizeText(rec.title),
    normalizedFirstLine: normalizeText(rec.firstLine),
    keywords: (rec.searchKeywords ?? []).map((k) => normalizeText(k)),
    themes: (rec.themes ?? []).map((t) => normalizeText(t)),
    tokens,
    searchableText: normalizeText(searchables.join(' ')),
  };
};

// ─── Inline validator (mirrors hymnValidators.ts without TS imports) ──────────

const VALID_SECTION_TYPES = ['verse', 'refrain', 'chorus', 'bridge', 'ending', 'doxology'];
const VALID_THEMES = [
  'grace', 'prayer', 'reflection', 'praise', 'majesty', 'victory',
  'creation', 'communion', 'guidance', 'thanksgiving', 'assurance',
  'holiness', 'comfort', 'mission', 'surrender',
];
const VALID_AUTHOR_ROLES = ['text', 'tune', 'translator', 'paraphrase', 'attribution'];

const validate = (rec, source) => {
  const errors = [];
  const err = (field, msg) => errors.push(`  • ${field}: ${msg}`);

  if (!rec || typeof rec !== 'object') return [`${source}: not a valid JSON object`];

  if (!['raw', 'normalized', 'approved'].includes(rec.status)) err('status', `must be raw/normalized/approved, got ${rec.status}`);
  if (!rec.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rec.id)) err('id', 'must be kebab-case');
  if (!rec.title?.trim()) err('title', 'required');
  if (!rec.firstLine?.trim()) err('firstLine', 'required');
  if (!rec.textAttribution?.trim()) err('textAttribution', 'required');
  if (!rec.tuneAttribution?.trim()) err('tuneAttribution', 'required');

  if (!Array.isArray(rec.authors) || rec.authors.length === 0) {
    err('authors', 'must be non-empty array');
  } else {
    rec.authors.forEach((a, i) => {
      if (!a?.name?.trim()) err(`authors[${i}].name`, 'required');
      if (!VALID_AUTHOR_ROLES.includes(a?.role)) err(`authors[${i}].role`, `must be one of ${VALID_AUTHOR_ROLES.join(', ')}`);
    });
  }

  if (!Array.isArray(rec.tunes)) err('tunes', 'must be an array');
  else rec.tunes.forEach((t, i) => { if (!t?.name?.trim()) err(`tunes[${i}].name`, 'required'); });

  if (!Array.isArray(rec.themes) || rec.themes.length === 0) {
    err('themes', 'must be non-empty array');
  } else {
    rec.themes.forEach((t, i) => {
      if (!VALID_THEMES.includes(t)) err(`themes[${i}]`, `unknown theme '${t}'`);
    });
  }

  if (!Array.isArray(rec.sections) || rec.sections.length === 0) {
    err('sections', 'must be non-empty array');
  } else {
    const ids = rec.sections.map((s) => s?.id);
    if (new Set(ids).size !== ids.length) err('sections', 'duplicate section IDs');
    rec.sections.forEach((s, i) => {
      if (!s?.id?.trim()) err(`sections[${i}].id`, 'required');
      if (!VALID_SECTION_TYPES.includes(s?.type)) err(`sections[${i}].type`, `unknown type '${s?.type}'`);
      if (!s?.label?.trim()) err(`sections[${i}].label`, 'required');
      if (typeof s?.order !== 'number') err(`sections[${i}].order`, 'must be a number');
      if (!s?.text?.trim()) err(`sections[${i}].text`, 'required');
    });
  }

  if (errors.length > 0) {
    return errors;
  }
  return [];
};

// ─── Process a single file — returns error list or null ──────────────────────

const processFile = (filePath) => {
  const abs = resolve(filePath);
  let raw;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    return [`Cannot parse: ${e.message}`];
  }

  const errors = validate(raw, basename(abs));
  if (errors.length > 0) return errors;

  if (raw.status === 'approved') {
    console.log(`  skip  ${basename(abs)} (already approved)`);
    return null;
  }

  const normalized = {
    ...raw,
    status: 'normalized',
    alternateTitles: raw.alternateTitles ?? [],
    scriptureThemes: raw.scriptureThemes ?? [],
    searchKeywords: raw.searchKeywords ?? [],
    searchIndex: buildSearchIndex(raw),
  };

  writeFileSync(abs, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
  console.log(`  ok    ${basename(abs)} → normalized`);
  return null;
};

// ─── Entry point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/normalizePdHymn.mjs <file.json|folder>');
  process.exit(1);
}

const failed = [];

for (const arg of args) {
  const abs = resolve(arg);
  const stat = statSync(abs);
  if (stat.isDirectory()) {
    const files = readdirSync(abs).filter((f) => extname(f) === '.json');
    if (files.length === 0) { console.log(`No JSON files found in ${abs}`); continue; }
    console.log(`\nNormalizing ${files.length} file(s) in ${abs}:`);
    for (const f of files) {
      const errs = processFile(`${abs}/${f}`);
      if (errs && errs.length > 0) {
        console.log(`  FAIL  ${f}`);
        failed.push({ file: f, errors: errs });
      }
    }
  } else {
    const errs = processFile(abs);
    if (errs && errs.length > 0) {
      console.log(`  FAIL  ${basename(abs)}`);
      failed.push({ file: basename(abs), errors: errs });
    }
  }
}

if (failed.length > 0) {
  console.log(`\n── Validation failures (${failed.length}) ──`);
  for (const { file, errors } of failed) {
    console.log(`\n  ${file}`);
    for (const e of errors) console.log(`    ${e}`);
  }
  console.log(`\nFix or delete these files, then re-run.\n`);
  process.exit(1);
}

console.log('\nDone.\n');
