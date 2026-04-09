#!/usr/bin/env node
/**
 * scripts/importFromHymnal.mjs
 *
 * Fetches hymn pages from www.hymnal.net and generates raw JSON files
 * in data/hymns/pd/ for public domain hymns (author must have died before 1925).
 *
 * Usage:
 *   node scripts/importFromHymnal.mjs --start 1 --end 500
 *   node scripts/importFromHymnal.mjs --ids 313,319,308,301
 *   node scripts/importFromHymnal.mjs --ids-file scripts/pd-hymn-ids.json
 *
 * After importing, run:
 *   npm run hymn:normalize data/hymns/pd/
 *   # Review files, set status: "approved"
 *   npm run hymn:build
 *
 * Rate limit: 700ms between requests to be respectful to the server.
 */

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import https from 'node:https';

// ─── Config ──────────────────────────────────────────────────────────────────

const PD_CUTOFF_YEAR = 1925;  // contributor must have died before this year
const RATE_LIMIT_MS  = 700;   // ms between requests
const OUT_DIR        = resolve('data/hymns/pd');
const BASE_URL       = 'https://www.hymnal.net';

// ─── Category → Lumina theme mapping ─────────────────────────────────────────

const CATEGORY_MAP = {
  praise:            'praise',
  worship:           'praise',
  adoration:         'praise',
  glory:             'praise',
  majesty:           'majesty',
  grace:             'grace',
  salvation:         'grace',
  redemption:        'grace',
  atonement:         'grace',
  prayer:            'prayer',
  devotion:          'prayer',
  supplication:      'prayer',
  assurance:         'assurance',
  faith:             'assurance',
  trust:             'assurance',
  comfort:           'comfort',
  peace:             'comfort',
  consolation:       'comfort',
  surrender:         'surrender',
  consecration:      'surrender',
  commitment:        'surrender',
  reflection:        'reflection',
  meditation:        'reflection',
  penitence:         'reflection',
  thanksgiving:      'thanksgiving',
  gratitude:         'thanksgiving',
  victory:           'victory',
  triumph:           'victory',
  resurrection:      'victory',
  holiness:          'holiness',
  sanctification:    'holiness',
  creation:          'creation',
  nature:            'creation',
  guidance:          'guidance',
  pilgrimage:        'guidance',
  communion:         'communion',
  "lord's supper":   'communion',
  mission:           'mission',
  evangelism:        'mission',
  witness:           'mission',
};

// ─── Slug generator ───────────────────────────────────────────────────────────

function toSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── HTML entity decoder ──────────────────────────────────────────────────────

const NAMED_ENTITIES = {
  amp:    '&',  quot:   '"',  apos:  "'",  lt:   '<',  gt:    '>',
  nbsp:   ' ',  mdash:  '\u2014',  ndash: '\u2013',
  lsquo:  '\u2018',  rsquo: '\u2019',
  ldquo:  '\u201C',  rdquo: '\u201D',
  hellip: '\u2026',  copy:  '\u00A9',  reg:   '\u00AE',  trade: '\u2122',
  eacute: '\u00E9',  egrave:'\u00E8',  ecirc: '\u00EA',  euml:  '\u00EB',
  agrave: '\u00E0',  aacute:'\u00E1',  acirc: '\u00E2',  auml:  '\u00E4',
  aring:  '\u00E5',  oacute:'\u00F3',  ograve:'\u00F2',  ocirc: '\u00F4',
  ouml:   '\u00F6',  uacute:'\u00FA',  ugrave:'\u00F9',  uuml:  '\u00FC',
  iacute: '\u00ED',  ntilde:'\u00F1',  ccedil:'\u00E7',
};

function decodeEntities(text) {
  return text
    .replace(/&([a-zA-Z]+);/g, (_, name) => NAMED_ENTITIES[name.toLowerCase()] ?? _)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// ─── HTTP fetch with redirect following ───────────────────────────────────────

function fetchPage(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 4) {
      reject(new Error('Too many redirects'));
      return;
    }

    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LuminaHymnImporter/1.0; +research)',
        'Accept':     'text/html,application/xhtml+xml',
      },
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : `${BASE_URL}${loc}`;
        resolve(fetchPage(next, redirectCount + 1));
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => resolve({ html: Buffer.concat(chunks).toString('utf8'), finalUrl: url }));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Request timeout')); });
  });
}

// ─── HTML parsers ─────────────────────────────────────────────────────────────

function parseTitle(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!m) return null;
  return decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim();
}

/**
 * Find the content of a metadata row identified by its label text.
 * Pattern: <label>LabelText:</label> <div>...content...</div>
 */
function parseLabelBlock(html, labelText) {
  const esc = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re  = new RegExp(
    `<label[^>]*>\\s*${esc}:\\s*<\\/label>\\s*<div[^>]*>([\\s\\S]*?)<\\/div>`,
    'i',
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

function extractPeople(html, labelText, linkPathSegment) {
  const block = parseLabelBlock(html, labelText);
  if (!block) return [];

  // Collect names from href-linked author/composer anchors
  const names   = [];
  const linkRe  = new RegExp(`href="[^"]*\\/${linkPathSegment}\\/[^"]+">([^<]+)<\\/a>`, 'g');
  let lm;
  while ((lm = linkRe.exec(block)) !== null) {
    names.push(decodeEntities(lm[1]).trim());
  }

  // Collect year pairs (birth–death) from parenthetical patterns
  const years  = [];
  const yearRe = /\((\d{4})(?:[–\-](\d{4}))?\)/g;
  let ym;
  while ((ym = yearRe.exec(block)) !== null) {
    years.push({
      birthYear: parseInt(ym[1], 10),
      deathYear: ym[2] ? parseInt(ym[2], 10) : null,
    });
  }

  // Zip names with years
  return names.map((name, i) => ({
    name,
    birthYear: years[i]?.birthYear ?? null,
    deathYear: years[i]?.deathYear ?? null,
  }));
}

const extractAuthors   = (html) => extractPeople(html, 'Lyrics', 'author');
const extractComposers = (html) => extractPeople(html, 'Music',  'composer');

function extractMeter(html) {
  const m = html.match(/\/search\/all\/meter\/[^"]+">([^<]+)<\/a>/);
  return m ? decodeEntities(m[1]).trim() : null;
}

function extractCategory(html) {
  const m = html.match(/\/search\/all\/category\/[^"]+">([^<]+)<\/a>/);
  return m ? decodeEntities(m[1]).trim().toLowerCase() : null;
}

/**
 * Parse verse/chorus blocks from .fullscreen-verse divs.
 * Each block has a data-type attribute and a .fullscreen-verse-text child.
 */
function parseVerses(html) {
  // Single-pass: capture data-type + verse-text together
  const blockRe = /<div[^>]*class="fullscreen-verse"[^>]*data-type="([^"]*)"[^>]*>[\s\S]*?<div[^>]*class="fullscreen-verse-text"[^>]*>([\s\S]*?)<\/div>/g;

  const sections    = [];
  let verseCount    = 0;
  let chorusCount   = 0;
  let m;

  while ((m = blockRe.exec(html)) !== null) {
    const rawType = m[1].toLowerCase().trim();
    let rawText   = m[2];

    // Convert line breaks, strip tags, decode entities
    rawText = rawText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      ;
    rawText = decodeEntities(rawText);
    // Normalize whitespace per line
    rawText = rawText
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 0)
      .join('\n')
      .trim();

    if (!rawText) continue;

    let type, id, label;

    if (rawType === 'chorus') {
      chorusCount++;
      type  = 'chorus';
      id    = chorusCount === 1 ? 'chorus' : `chorus-${chorusCount}`;
      label = 'Chorus';
    } else if (rawType === 'refrain') {
      chorusCount++;
      type  = 'refrain';
      id    = chorusCount === 1 ? 'refrain' : `refrain-${chorusCount}`;
      label = 'Refrain';
    } else {
      verseCount++;
      type  = 'verse';
      id    = `v${verseCount}`;
      label = `Verse ${verseCount}`;
    }

    sections.push({ id, type, label, order: sections.length + 1, text: rawText });
  }

  return sections;
}

// ─── PD eligibility ───────────────────────────────────────────────────────────

function isPD(authors, composers) {
  const everyone = [...authors, ...composers];
  if (everyone.length === 0) return false;

  for (const person of everyone) {
    if (person.deathYear === null) {
      // Unknown death year: conservative — assume not PD
      // Exception: if birth year is very early (< 1870), likely PD
      if (person.birthYear !== null && person.birthYear < 1870) continue;
      return false;
    }
    if (person.deathYear >= PD_CUTOFF_YEAR) return false;
  }
  return true;
}

// ─── Lumina JSON builder ──────────────────────────────────────────────────────

function buildRecord(title, authors, composers, meter, category, sections) {
  const slug      = toSlug(title);
  const themeKey  = category ? (CATEGORY_MAP[category] ?? 'praise') : 'praise';
  const themes    = [themeKey];

  // Attribution strings
  const fmtPerson = (p) =>
    p.birthYear && p.deathYear ? `${p.name} (${p.birthYear}–${p.deathYear})` : p.name;

  const textAttr = `Text: ${authors.map(fmtPerson).join(', ') || 'Unknown'}.`;
  const tuneAttr = `Tune: ${composers.map(fmtPerson).join(', ') || 'Unknown'}.`;

  const pdBasis = [
    ...authors.map(fmtPerson),
    ...composers.map(fmtPerson),
  ].join(', ') + '. All public domain.';

  const firstVerse = sections.find((s) => s.type === 'verse');
  const firstLine  = firstVerse ? firstVerse.text.split('\n')[0].trim() : title;

  const searchKeywords = [
    ...new Set(
      title.toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3),
    ),
  ];

  const hasChorus = sections.some((s) => s.type === 'chorus' || s.type === 'refrain');

  return {
    status:                    'raw',
    id:                        slug,
    title,
    alternateTitles:           [],
    firstLine,
    meter:                     meter ?? '',
    hymnalNumbers:             {},
    authors:                   authors.map((a) => ({ name: a.name, role: 'text' })),
    tunes:                     composers.length > 0
                                 ? [{ name: 'Unknown', composer: composers[0].name }]
                                 : [],
    themes,
    scriptureThemes:           [],
    textAttribution:           textAttr,
    tuneAttribution:           tuneAttr,
    publicDomainBasis:         pdBasis,
    searchKeywords,
    defaultTypographyPresetId: 'classic-worship-serif',
    defaultThemeCategory:      themeKey,
    defaultChorusStrategy:     'smart',
    preferredBackgroundMotion: 'still',
    maxLinesPerSlide:          2,
    preferredCharsPerLine:     36,
    allowThreeLineSlides:      false,
    chorusVisuallyDistinct:    hasChorus,
    sections,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRedirectedAway(finalUrl) {
  return (
    finalUrl.includes('/en/home') ||
    finalUrl.includes('/en/search') ||
    !finalUrl.includes('/en/hymn/')
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const idsToFetch = [];
  let startId = null, endId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start') {
      startId = parseInt(args[++i], 10);
    } else if (args[i] === '--end') {
      endId = parseInt(args[++i], 10);
    } else if (args[i] === '--ids') {
      args[++i].split(',').forEach((s) => {
        const n = parseInt(s.trim(), 10);
        if (!isNaN(n)) idsToFetch.push(n);
      });
    } else if (args[i] === '--ids-file') {
      const { readFileSync } = await import('node:fs');
      const loaded = JSON.parse(readFileSync(resolve(args[++i]), 'utf8'));
      idsToFetch.push(...loaded);
    }
  }

  if (startId !== null && endId !== null) {
    for (let id = startId; id <= endId; id++) idsToFetch.push(id);
  }

  if (idsToFetch.length === 0) {
    console.error('Usage:');
    console.error('  node scripts/importFromHymnal.mjs --start 1 --end 500');
    console.error('  node scripts/importFromHymnal.mjs --ids 313,319,308');
    console.error('  node scripts/importFromHymnal.mjs --ids-file scripts/pd-hymn-ids.json');
    process.exit(1);
  }

  // Load existing slugs so we can skip duplicates
  const existingSlugs = new Set(
    readdirSync(OUT_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', '')),
  );

  console.log('\nLumina Hymn Importer — hymnal.net');
  console.log('══════════════════════════════════');
  console.log(`IDs to probe:     ${idsToFetch.length}`);
  console.log(`Already have:     ${existingSlugs.size} hymns`);
  console.log(`PD cutoff:        died before ${PD_CUTOFF_YEAR}`);
  console.log(`Output dir:       ${OUT_DIR}`);
  console.log('');

  let written = 0, skipped = 0, notPD = 0, errors = 0;

  for (let i = 0; i < idsToFetch.length; i++) {
    const hymnId = idsToFetch[i];
    const url    = `${BASE_URL}/en/hymn/h/${hymnId}`;
    const prefix = `[${String(i + 1).padStart(4)}/${idsToFetch.length}] h/${hymnId}`;
    process.stdout.write(`${prefix} ... `);

    try {
      const { html, finalUrl } = await fetchPage(url);

      // Redirected away → hymn ID doesn't exist
      if (isRedirectedAway(finalUrl)) {
        process.stdout.write('not found\n');
        skipped++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      // Must have the stanzas container
      if (!html.includes('fullscreen-stanzas')) {
        process.stdout.write('no stanzas\n');
        skipped++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      const title = parseTitle(html);
      if (!title) {
        process.stdout.write('no title\n');
        skipped++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      const slug = toSlug(title);

      // Already have this hymn
      if (existingSlugs.has(slug)) {
        process.stdout.write(`exists (${slug})\n`);
        skipped++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      const authors   = extractAuthors(html);
      const composers = extractComposers(html);
      const meter     = extractMeter(html);
      const category  = extractCategory(html);
      const sections  = parseVerses(html);

      // PD check
      if (!isPD(authors, composers)) {
        const info = [...authors, ...composers]
          .map((p) => `${p.name}(d.${p.deathYear ?? '?'})`)
          .join(', ');
        process.stdout.write(`not PD — ${info}\n`);
        notPD++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      // Must have at least one verse
      if (sections.length === 0) {
        process.stdout.write('no verses\n');
        skipped++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      const record  = buildRecord(title, authors, composers, meter, category, sections);
      const outPath = join(OUT_DIR, `${slug}.json`);
      writeFileSync(outPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
      existingSlugs.add(slug);
      written++;
      process.stdout.write(`✓  "${title}"\n`);

    } catch (err) {
      process.stdout.write(`ERROR: ${err.message}\n`);
      errors++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log('');
  console.log('══════════════════════════════════');
  console.log(`Written:  ${written}`);
  console.log(`Skipped:  ${skipped}  (not found / already exists / no verses)`);
  console.log(`Not PD:   ${notPD}`);
  console.log(`Errors:   ${errors}`);

  if (written > 0) {
    console.log('');
    console.log('Next steps:');
    console.log('  npm run hymn:normalize data/hymns/pd/');
    console.log('  # Review files, change status to "approved"');
    console.log('  npm run hymn:build');
  }

  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
