#!/usr/bin/env node
/**
 * buildBibleBundle.mjs
 *
 * Downloads KJV and WEB (public-domain) translations and writes
 * pre-indexed JSON files to public/data/bibles/.
 *
 * Sources:
 *   KJV — scrollmapper/bible_databases (MIT licence)
 *   WEB — getbible.net v2 API (public domain)
 *
 * Output schema per file:
 *   { "Genesis": { "1": { "1": "In the beginning...", ... }, ... }, ... }
 *
 * Usage:  node scripts/buildBibleBundle.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'data', 'bibles');

// ── Canonical book names ─────────────────────────────────────────────
// Must match BIBLE_BOOKS in services/bibleLookup.ts exactly.
const CANONICAL_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms',
  'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
  'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah',
  'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai',
  'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke',
  'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter', '1 John',
  '2 John', '3 John', 'Jude', 'Revelation',
];

// Map upstream scrollmapper book names → canonical names.
const SCROLLMAPPER_NAME_MAP = {
  'I Samuel': '1 Samuel', 'II Samuel': '2 Samuel',
  'I Kings': '1 Kings', 'II Kings': '2 Kings',
  'I Chronicles': '1 Chronicles', 'II Chronicles': '2 Chronicles',
  'I Corinthians': '1 Corinthians', 'II Corinthians': '2 Corinthians',
  'I Thessalonians': '1 Thessalonians', 'II Thessalonians': '2 Thessalonians',
  'I Timothy': '1 Timothy', 'II Timothy': '2 Timothy',
  'I Peter': '1 Peter', 'II Peter': '2 Peter',
  'I John': '1 John', 'II John': '2 John', 'III John': '3 John',
  'Revelation of John': 'Revelation',
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

// ── KJV: scrollmapper/bible_databases ────────────────────────────────
// Schema: { books: [{ name, chapters: [{ chapter, verses: [{ verse, text }] }] }] }

async function downloadKJV() {
  console.log('Downloading KJV from scrollmapper/bible_databases...');
  const url = 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json';
  const raw = await fetchJSON(url);

  if (!Array.isArray(raw?.books)) {
    throw new Error('Unexpected KJV schema — expected books array');
  }

  const bible = {};

  for (const book of raw.books) {
    const upstreamName = book.name;
    const canonical = SCROLLMAPPER_NAME_MAP[upstreamName] || upstreamName;

    if (!CANONICAL_BOOKS.includes(canonical)) {
      console.warn(`  ⚠ Skipping unknown book: "${upstreamName}"`);
      continue;
    }

    bible[canonical] = {};
    for (const ch of book.chapters) {
      const chKey = String(ch.chapter);
      bible[canonical][chKey] = {};
      for (const v of ch.verses) {
        bible[canonical][chKey][String(v.verse)] = String(v.text).trim();
      }
    }
  }

  verifyBooks(bible, 'KJV');
  return bible;
}

// ── WEB: getbible.net v2 API ─────────────────────────────────────────
// One request per book: /v2/web/{bookNr}.json
// Schema: { book_nr, book_name, chapters: [{ chapter, verses: [{ verse, text }] }] }
// (66 book requests; chapters is an array ordered by chapter number.)

async function downloadWEB() {
  console.log('Downloading WEB from getbible.net v2 API (66 books)...');
  const bible = {};

  // Fetch all 66 books. getbible.net supports /v2/web/{bookNr}.json for
  // the full book (all chapters in one response).
  for (let bookNr = 1; bookNr <= 66; bookNr++) {
    const canonical = CANONICAL_BOOKS[bookNr - 1];
    const url = `https://api.getbible.net/v2/web/${bookNr}.json`;

    process.stdout.write(`  ${bookNr}/66 ${canonical}...\r`);
    const raw = await fetchJSON(url);

    bible[canonical] = {};
    const chapters = raw.chapters || [];
    for (const ch of chapters) {
      const chKey = String(ch.chapter);
      bible[canonical][chKey] = {};
      for (const v of ch.verses) {
        bible[canonical][chKey][String(v.verse)] = String(v.text).trim();
      }
    }

    // Be polite to the API
    if (bookNr < 66) await sleep(100);
  }

  console.log('');
  verifyBooks(bible, 'WEB');
  return bible;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function verifyBooks(bible, label) {
  const missing = CANONICAL_BOOKS.filter((name) => !bible[name]);
  if (missing.length > 0) {
    console.warn(`  ⚠ ${label} missing books: ${missing.join(', ')}`);
  } else {
    console.log(`  ✓ ${label}: all 66 books present`);
  }
}

function writeBible(id, bible) {
  const outPath = join(OUT_DIR, `${id}.json`);
  const json = JSON.stringify(bible);
  writeFileSync(outPath, json, 'utf-8');
  const size = (Buffer.byteLength(json) / (1024 * 1024)).toFixed(1);
  console.log(`  ✓ ${outPath} — ${Object.keys(bible).length} books, ${size} MB`);
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const kjv = await downloadKJV();
  writeBible('kjv', kjv);

  const web = await downloadWEB();
  writeBible('web', web);

  console.log('\nDone. Bible bundles written to public/data/bibles/');
}

main().catch((err) => {
  console.error('Failed to build bible bundle:', err);
  process.exit(1);
});
