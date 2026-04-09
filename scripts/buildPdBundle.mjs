#!/usr/bin/env node
/**
 * scripts/buildPdBundle.mjs
 *
 * Reads every approved JSON from data/hymns/pd/ and regenerates
 * seed/publicDomainHymns.ts — the authoritative bundled hymn seed.
 *
 * Usage:
 *   node scripts/buildPdBundle.mjs
 *   node scripts/buildPdBundle.mjs --dry-run     # print output without writing
 *   node scripts/buildPdBundle.mjs --check        # exit 1 if output would change (CI gate)
 *
 * Workflow:
 *   1. Add / edit JSON files in data/hymns/pd/
 *   2. node scripts/normalizePdHymn.mjs data/hymns/pd/   # validate + stamp
 *   3. Set "status": "approved" in each file when ready
 *   4. node scripts/buildPdBundle.mjs                    # regenerate seed
 *   5. Commit both the JSON source files and the updated seed
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const DATA_DIR = resolve('data/hymns/pd');
const OUT_FILE = resolve('seed/publicDomainHymns.ts');

// ─── Text normalization (mirrors hymnSearch.ts + normalizePdHymn.mjs) ─────────

const normalizeText = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

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

// ─── JSON → TypeScript code-gen ───────────────────────────────────────────────

const q = (s) => JSON.stringify(s);
const indent = (s, spaces) => s.split('\n').map((l) => ' '.repeat(spaces) + l).join('\n');

const genAuthors = (authors) =>
  authors.map((a) => {
    const parts = [`name: ${q(a.name)}`, `role: ${q(a.role)}`];
    if (a.notes) parts.push(`notes: ${q(a.notes)}`);
    return `{ ${parts.join(', ')} }`;
  }).join(', ');

const genTunes = (tunes) =>
  tunes.map((t) => {
    const parts = [`name: ${q(t.name)}`, 'publicDomain: true'];
    if (t.composer) parts.push(`composer: ${q(t.composer)}`);
    if (t.meter) parts.push(`meter: ${q(t.meter)}`);
    if (t.alternateNames?.length) parts.push(`alternateNames: [${t.alternateNames.map(q).join(', ')}]`);
    return `{ ${parts.join(', ')} }`;
  }).join(', ');

const genSection = (s) => {
  const text = s.text.replace(/`/g, '\\`');
  const lines = [
    `      id: ${q(s.id)},`,
    `      type: ${q(s.type)},`,
    `      label: ${q(s.label)},`,
    `      order: ${s.order},`,
    `      text: \`\n${text}\n      \`,`,
  ];
  const pres = [];
  if (s.repeatMode && s.repeatMode !== 'none') {
    pres.push(`repeatMode: ${q(s.repeatMode)}`);
    if (s.repeatMode === 'each-verse') pres.push(`repeatAfterSectionTypes: ['verse']`);
  }
  if (s.visuallyDistinct) pres.push('visuallyDistinct: true');
  if (pres.length) {
    lines.push(`      presentation: { ${pres.join(', ')} },`);
  }
  return `    {\n${lines.join('\n')}\n    }`;
};

const genSearchIndex = (idx) => `{
      normalizedTitle: ${q(idx.normalizedTitle)},
      normalizedFirstLine: ${q(idx.normalizedFirstLine)},
      keywords: [${idx.keywords.map(q).join(', ')}],
      themes: [${idx.themes.map(q).join(', ')}],
      tokens: [${idx.tokens.map(q).join(', ')}],
      searchableText: ${q(idx.searchableText)},
    }`;

const genHymnalNumbers = (nums) => {
  if (!nums || Object.keys(nums).length === 0) return null;
  const entries = Object.entries(nums).map(([k, v]) => `${q(k)}: ${v}`).join(', ');
  return `{ ${entries} }`;
};

const genHymn = (rec) => {
  const si = buildSearchIndex(rec);
  const hymnalNums = genHymnalNumbers(rec.hymnalNumbers);

  const lines = [
    `  {`,
    `    id: ${q(rec.id)},`,
    `    title: ${q(rec.title)},`,
    `    alternateTitles: [${(rec.alternateTitles ?? []).map(q).join(', ')}],`,
    `    firstLine: ${q(rec.firstLine)},`,
  ];

  if (rec.meter) lines.push(`    meter: ${q(rec.meter)},`);
  if (hymnalNums) lines.push(`    hymnalNumbers: ${hymnalNums},`);

  lines.push(
    `    authors: [${genAuthors(rec.authors)}],`,
    `    tunes: [${genTunes(rec.tunes)}],`,
    `    themes: [${rec.themes.map(q).join(', ')}],`,
    `    scriptureThemes: [${(rec.scriptureThemes ?? []).map(q).join(', ')}],`,
    `    copyright: {`,
    `      publicDomain: true,`,
    `      requiresReview: false,`,
    `      textPd: true,`,
    `      tunePd: true,`,
    `      textAttribution: ${q(rec.textAttribution)},`,
    `      tuneAttribution: ${q(rec.tuneAttribution)},`,
    `      publicDomainBasis: ${q(rec.publicDomainBasis ?? 'Historic hymn text and tune are treated as public domain for bundled Lumina content.')},`,
    ...(rec.copyrightNotes?.length ? [`      notes: [${rec.copyrightNotes.map(q).join(', ')}],`] : []),
    `    },`,
    `    searchKeywords: [${(rec.searchKeywords ?? []).map(q).join(', ')}],`,
    `    presentationDefaults: {`,
    `      defaultTypographyPresetId: ${q(rec.defaultTypographyPresetId ?? 'classic-worship-serif')},`,
    `      defaultThemeCategory: ${q(rec.defaultThemeCategory ?? rec.themes[0])},`,
    `      defaultChorusStrategy: ${q(rec.defaultChorusStrategy ?? 'smart')},`,
    `      preferredBackgroundMotion: ${q(rec.preferredBackgroundMotion ?? 'either')},`,
    `      maxLinesPerSlide: ${rec.maxLinesPerSlide ?? 2},`,
    `      preferredCharsPerLine: ${rec.preferredCharsPerLine ?? 32},`,
    `      allowThreeLineSlides: ${rec.allowThreeLineSlides !== false},`,
    `      chorusVisuallyDistinct: ${rec.chorusVisuallyDistinct !== false},`,
    `    },`,
    `    sections: [`,
    rec.sections.map(genSection).join(',\n'),
    `    ],`,
    `    librarySource: {`,
    `      kind: 'bundled-pd',`,
    `      isBundled: true,`,
    `      providerId: 'lumina-bundled',`,
    `      providerName: 'Lumina Bundled Hymns',`,
    `      catalogId: 'built-in-public-domain-hymns',`,
    `      displayLabel: 'Bundled Hymn',`,
    `    },`,
    `    usageRights: {`,
    `      licenseScope: 'bundled-distribution',`,
    `      canStoreText: true,`,
    `      canDistributeInApp: true,`,
    `      canProject: true,`,
    `      canStream: true,`,
    `      requiresAttribution: false,`,
    `      requiresLicenseCheck: false,`,
    `      notice: 'Bundled with Lumina as verified public-domain hymn content.',`,
    `    },`,
    `    searchIndex: ${genSearchIndex(si)},`,
    `  }`,
  );

  return lines.join('\n');
};

// ─── Load approved hymns ──────────────────────────────────────────────────────

const loadApproved = () => {
  let files;
  try {
    files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).sort();
  } catch {
    console.error(`Cannot read ${DATA_DIR}. Run from the project root.`);
    process.exit(1);
  }

  const hymns = [];
  const skipped = [];

  for (const file of files) {
    const abs = join(DATA_DIR, file);
    let rec;
    try {
      rec = JSON.parse(readFileSync(abs, 'utf8'));
    } catch (e) {
      console.error(`Cannot parse ${file}: ${e.message}`);
      process.exit(1);
    }

    if (rec.status !== 'approved') {
      skipped.push(`  skip  ${file} (status: ${rec.status})`);
      continue;
    }

    hymns.push({ file, rec });
  }

  if (skipped.length) console.log(skipped.join('\n'));
  return hymns;
};

// ─── Generate seed file content ───────────────────────────────────────────────

const generateSeed = (hymns) => {
  const hymnBlocks = hymns.map(({ rec }) => genHymn(rec)).join(',\n\n');

  return `/**
 * seed/publicDomainHymns.ts
 *
 * AUTO-GENERATED — do not edit by hand.
 * Source: data/hymns/pd/*.json  (status: "approved")
 * Generator: scripts/buildPdBundle.mjs
 *
 * To add or update hymns:
 *   1. Edit or add a JSON file in data/hymns/pd/
 *   2. node scripts/normalizePdHymn.mjs data/hymns/pd/<file>.json
 *   3. Set "status": "approved" in the JSON
 *   4. node scripts/buildPdBundle.mjs
 *   5. Commit both files
 *
 * Bundle: Lumina PD ${hymns.length} — ${new Date().toISOString().slice(0, 10)}
 */

import type {
  Hymn,
  HymnCopyright,
  HymnLibrarySource,
  HymnMetadataRecord,
  HymnPresentationDefaults,
  HymnSearchIndex,
  HymnUsageRights,
} from '../types/hymns.ts';

export const PUBLIC_DOMAIN_HYMNS: Hymn[] = [
${hymnBlocks}
];

export const PUBLIC_DOMAIN_HYMN_METADATA: HymnMetadataRecord[] = PUBLIC_DOMAIN_HYMNS.map((entry) => ({
  id: entry.id,
  title: entry.title,
  alternateTitles: entry.alternateTitles,
  firstLine: entry.firstLine,
  meter: entry.meter,
  hymnalNumbers: entry.hymnalNumbers,
  authors: entry.authors,
  tunes: entry.tunes,
  themes: entry.themes,
  scriptureThemes: entry.scriptureThemes,
  copyright: entry.copyright,
  searchKeywords: entry.searchKeywords,
  presentationDefaults: entry.presentationDefaults,
  librarySource: entry.librarySource,
  usageRights: entry.usageRights,
  searchIndex: entry.searchIndex,
  sectionCount: entry.sections.length,
}));
`;
};

// ─── Entry point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const check = args.includes('--check');

console.log(`\nLumina PD Bundle Builder`);
console.log(`Source : ${DATA_DIR}`);
console.log(`Output : ${OUT_FILE}\n`);

const hymns = loadApproved();

if (hymns.length === 0) {
  console.error('No approved hymns found. Set "status": "approved" in at least one JSON file.');
  process.exit(1);
}

console.log(`\nBuilding bundle with ${hymns.length} approved hymn(s):`);
hymns.forEach(({ file, rec }) => console.log(`  +  ${file}  (${rec.title})`));

const output = generateSeed(hymns);

if (dryRun) {
  console.log('\n--- DRY RUN: output preview (first 60 lines) ---\n');
  console.log(output.split('\n').slice(0, 60).join('\n'));
  console.log('\n--- end preview ---\n');
  process.exit(0);
}

if (check) {
  let existing = '';
  try { existing = readFileSync(OUT_FILE, 'utf8'); } catch { /* new file */ }
  if (existing === output) {
    console.log('\nCheck passed — seed is up to date.\n');
    process.exit(0);
  } else {
    console.error('\nCheck FAILED — seed is out of date. Run: node scripts/buildPdBundle.mjs\n');
    process.exit(1);
  }
}

writeFileSync(OUT_FILE, output, 'utf8');
console.log(`\nWrote ${hymns.length} hymn(s) to ${OUT_FILE}\n`);
