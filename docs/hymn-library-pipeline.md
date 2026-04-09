# Lumina PD Hymn Library — End-to-End Pipeline

This document covers the complete lifecycle of public-domain hymns in Lumina: from raw source data through import, validation, approval, and final bundle generation.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [JSON Schema Reference](#json-schema-reference)
5. [npm Commands](#npm-commands)
6. [Full Pipeline Walkthrough](#full-pipeline-walkthrough)
7. [Bulk Import from hymnal.net](#bulk-import-from-hymnalnet)
8. [Adding a Hymn Manually](#adding-a-hymn-manually)
9. [Validation Rules](#validation-rules)
10. [Valid Themes](#valid-themes)
11. [Troubleshooting](#troubleshooting)

---

## Overview

Lumina ships a built-in library of public-domain (PD) hymns bundled directly into the app — no network required, no CCLI license needed. The library is maintained as a set of structured JSON source files that are validated, approved, and code-generated into a TypeScript seed file consumed by the app.

**Why JSON source files?**
- Human-readable and git-diffable
- Independent review/approval gate before anything reaches the app
- Separates data (what hymns say) from code (how the app uses them)

**Why code-generate the TypeScript seed?**
- Type-safe at compile time
- Zero runtime JSON parsing cost
- Single source of truth — the JSON files *are* the canonical record

---

## Architecture

```
hymnal.net (source)
        │
        ▼
scripts/importFromHymnal.mjs
        │  fetches pages, parses HTML, PD-filters by author death year
        ▼
data/hymns/pd/{slug}.json   ← status: "raw"
        │
        ▼
scripts/normalizePdHymn.mjs
        │  validates schema, builds searchIndex, stamps normalized
        ▼
data/hymns/pd/{slug}.json   ← status: "normalized"
        │
        ▼
  [human review / bulk approve]
        │  set status: "approved"
        ▼
data/hymns/pd/{slug}.json   ← status: "approved"
        │
        ▼
scripts/buildPdBundle.mjs
        │  code-generates TypeScript from all approved JSONs
        ▼
seed/publicDomainHymns.ts   ← consumed by app at compile time
```

---

## File Structure

```
lumina-presenter/
├── data/
│   └── hymns/
│       └── pd/                         ← one JSON file per hymn
│           ├── amazing-grace.json
│           ├── blessed-assurance.json
│           └── ...
├── seed/
│   └── publicDomainHymns.ts            ← AUTO-GENERATED, do not edit
├── scripts/
│   ├── importFromHymnal.mjs            ← fetches from hymnal.net
│   ├── normalizePdHymn.mjs             ← validates + stamps normalized
│   ├── buildPdBundle.mjs               ← generates seed/publicDomainHymns.ts
│   └── pd-hymn-ids.json                ← curated list of hymnal.net IDs (1–400)
├── types/
│   ├── hymns.ts                        ← TypeScript Hymn type definitions
│   └── hymnValidators.ts               ← runtime validators (no external deps)
└── docs/
    └── hymn-library-pipeline.md        ← this file
```

---

## JSON Schema Reference

Every file in `data/hymns/pd/` must conform to this shape.

```jsonc
{
  // ── Lifecycle ────────────────────────────────────────────────────────────
  "status": "raw",           // "raw" | "normalized" | "approved"
  //   raw        → just imported, not yet validated
  //   normalized → passed validation, searchIndex built
  //   approved   → cleared for bundle inclusion

  // ── Identity ─────────────────────────────────────────────────────────────
  "id": "amazing-grace",                  // kebab-case, must match filename
  "title": "Amazing Grace",
  "alternateTitles": [],                  // optional alternate titles
  "firstLine": "Amazing grace! how sweet the sound",

  // ── Music metadata ────────────────────────────────────────────────────────
  "meter": "CM",                          // Common Metre, LM D, etc.
  "hymnalNumbers": { "UMH": 378, "SBC": 330 },  // optional

  // ── Attribution ───────────────────────────────────────────────────────────
  "authors": [
    { "name": "John Newton", "role": "text", "notes": "Optional note." }
    //  roles: "text" | "tune" | "translator" | "paraphrase" | "attribution"
  ],
  "tunes": [
    { "name": "NEW BRITAIN", "composer": "Traditional American melody",
      "alternateNames": ["Amazing Grace"] }
  ],

  // ── Themes & Scripture ────────────────────────────────────────────────────
  "themes": ["grace", "assurance"],     // must use valid theme tokens (see below)
  "scriptureThemes": ["Ephesians 2:8-9"],

  // ── Copyright ─────────────────────────────────────────────────────────────
  "textAttribution": "Text: John Newton, 1779.",
  "tuneAttribution": "Tune: NEW BRITAIN, traditional American melody.",
  "publicDomainBasis": "John Newton (1725–1807). All public domain.",

  // ── Search ────────────────────────────────────────────────────────────────
  "searchKeywords": ["grace", "wretch", "blind", "lost", "found"],

  // ── Presentation defaults ─────────────────────────────────────────────────
  "defaultTypographyPresetId": "classic-worship-serif",
  "defaultThemeCategory": "grace",
  "defaultChorusStrategy": "smart",      // "smart" | "always" | "never"
  "preferredBackgroundMotion": "still",  // "still" | "subtle" | "either"
  "maxLinesPerSlide": 2,
  "preferredCharsPerLine": 34,
  "allowThreeLineSlides": false,
  "chorusVisuallyDistinct": false,

  // ── Sections ──────────────────────────────────────────────────────────────
  "sections": [
    {
      "id": "v1",           // unique within the hymn
      "type": "verse",      // "verse" | "chorus" | "refrain" | "bridge" | "ending" | "doxology"
      "label": "Verse 1",
      "order": 1,           // 1-based display order
      "text": "Amazing grace! how sweet the sound,\nThat saved a wretch like me!"
      // lines separated by \n, each line is one display line on a slide
    },
    {
      "id": "chorus",
      "type": "chorus",
      "label": "Chorus",
      "order": 2,
      "text": "...",
      "repeatMode": "each-verse",    // optional: repeat after every verse
      "visuallyDistinct": true       // optional: render with different styling
    }
  ]
}
```

### Section types

| Type | Use |
|------|-----|
| `verse` | Standard numbered verse |
| `chorus` | Repeating chorus (sung after verses) |
| `refrain` | Short repeated line, often at end of verse |
| `bridge` | Bridge section |
| `doxology` | Closing doxology |
| `ending` | Final tag or coda |

---

## npm Commands

| Command | What it does |
|---------|-------------|
| `npm run hymn:import -- --start N --end M` | Probe hymnal.net IDs N through M, write raw JSON |
| `npm run hymn:import -- --ids 313,319,308` | Import specific hymnal.net IDs |
| `npm run hymn:import -- --ids-file scripts/pd-hymn-ids.json` | Import from a curated ID list |
| `npm run hymn:normalize` | Validate all `data/hymns/pd/*.json`, stamp `normalized` |
| `npm run hymn:build` | Generate `seed/publicDomainHymns.ts` from all `approved` files |
| `npm run hymn:check` | CI gate — exits 1 if the seed is out of date |

> **Important:** `hymn:normalize` already targets `data/hymns/pd/` — do not pass the path again or the folder will be processed twice.

---

## Full Pipeline Walkthrough

This is the standard sequence whenever new hymns are added, whether imported or hand-crafted.

### Step 1 — Import (or create manually)

```bash
# Probe a range of hymnal.net IDs
npm run hymn:import -- --start 1 --end 400

# Or import a curated list
npm run hymn:import -- --ids-file scripts/pd-hymn-ids.json

# Or import specific known IDs
npm run hymn:import -- --ids 313,319,308
```

The importer:
- Fetches each page from `www.hymnal.net/en/hymn/h/{ID}`
- Checks if the page is a valid hymn (not a redirect to home/search)
- Extracts: title, authors, composers, meter, category, verse text
- Filters: author OR composer must have died before 1925 (PD cutoff)
- Skips hymns already present in `data/hymns/pd/` (by slug match)
- Writes `data/hymns/pd/{slug}.json` with `status: "raw"`
- Rate-limited to 700ms between requests to respect the server

### Step 2 — Normalize

```bash
npm run hymn:normalize
```

For every `raw` file (skips `approved`):
- Validates all required fields (see [Validation Rules](#validation-rules))
- Builds the `searchIndex` (normalised tokens for full-text search)
- Stamps `status: "normalized"`
- Reports all validation failures at the end without stopping early

If a file fails, either fix it or delete it, then re-run.

### Step 3 — Approve

Two options:

**Option A — Bulk approve all normalized** (after a trusted bulk import):

```bash
node --input-type=commonjs -e "
const {readdirSync,readFileSync,writeFileSync}=require('fs');
const path=require('path');
const dir='data/hymns/pd';
let n=0;
for(const f of readdirSync(dir).filter(f=>f.endsWith('.json'))){
  const fp=path.join(dir,f);
  const d=JSON.parse(readFileSync(fp,'utf8'));
  if(d.status==='normalized'){d.status='approved';writeFileSync(fp,JSON.stringify(d,null,2)+'\n','utf8');n++;}
}
console.log('Approved:',n);
"
```

**Option B — Approve individually** (for manual or spot-checked hymns):
Open `data/hymns/pd/{slug}.json`, change `"status": "normalized"` → `"status": "approved"`, save.

### Step 4 — Build

```bash
npm run hymn:build
```

Reads all `approved` JSON files, code-generates `seed/publicDomainHymns.ts`.  
The seed exports:
- `PUBLIC_DOMAIN_HYMNS` — full `Hymn[]` array with text, sections, search index
- `PUBLIC_DOMAIN_HYMN_METADATA` — lightweight metadata-only view (no section text)

### Step 5 — Commit

```bash
git add data/hymns/pd/ seed/publicDomainHymns.ts
git commit -m "feat(hymns): add N PD hymns to bundle"
```

Always commit both the JSON source files and the generated seed together.

---

## Bulk Import from hymnal.net

### How the importer works

hymnal.net uses sequential numeric IDs in the path `/en/hymn/h/{ID}`. The importer probes each ID in order. If an ID doesn't exist, hymnal.net redirects to the home page — the importer detects this and skips it.

**Public domain filter:** The importer extracts author and composer birth/death years from the parenthetical pattern `(1725–1807)` in the page HTML. If all contributors died before 1925, the hymn is treated as PD. If any contributor's death year is unknown and their birth year is after 1870, the hymn is skipped (conservative fallback).

**Verse parsing:** Verses are found in `.fullscreen-verse` divs with a `data-type` attribute (`verse`, `chorus`, `refrain`). Text is in `.fullscreen-verse-text` child divs, with lines separated by `<br/>` tags.

### Yield rate

From the 1–400 probe: ~30% PD rate (119 PD out of 400 IDs probed). Most non-PD hymns in the lower ID range are Brethren/Plymouth Brethren hymnody from the 20th century (Witness Lee, etc.).

### Scaling to 3000+ hymns

Run in batches to manage time and allow normalize/approve between runs:

| Batch | Command | Duration (est.) | Expected yield |
|-------|---------|-----------------|----------------|
| 1 | `--start 401 --end 2000` | ~20 min | ~480 PD |
| 2 | `--start 2001 --end 4000` | ~24 min | ~600 PD |
| 3 | `--start 4001 --end 6000` | ~24 min | ~600 PD |
| 4 | `--start 6001 --end 10000` | ~47 min | ~1200 PD |

After each batch:
```bash
npm run hymn:normalize
# bulk approve (Option A above)
npm run hymn:build
```

### Known limitations of imported data

Hymns imported from hymnal.net arrive as `status: "raw"` and may need manual cleanup:

- **Tune name:** Imported as `"Unknown"` — update with the actual tune name (e.g. `"DIADEMATA"`)
- **Hymnal numbers:** Left empty — fill in UMH, SBC, LW numbers where known
- **Scripture themes:** Not available on hymnal.net — add manually where relevant
- **Section type mismatch:** Some sites label later verses as `chorus` — verify and correct
- **Theme mapping:** Defaults to `"praise"` if the hymnal.net category has no mapping — review and adjust

---

## Adding a Hymn Manually

1. Create `data/hymns/pd/{slug}.json` using the schema above with `"status": "raw"`
2. Run `npm run hymn:normalize` to validate
3. Fix any reported errors
4. Open the file, set `"status": "approved"`
5. Run `npm run hymn:build`
6. Commit both files

**Slug convention:** kebab-case from the title, all lowercase, no punctuation.

Examples:
- "Amazing Grace" → `amazing-grace`
- "It Is Well with My Soul" → `it-is-well-with-my-soul`
- "O for a Thousand Tongues to Sing" → `o-for-a-thousand-tongues-to-sing`

---

## Validation Rules

`normalizePdHymn.mjs` enforces these rules before stamping `normalized`:

| Field | Rule |
|-------|------|
| `status` | Must be `raw`, `normalized`, or `approved` |
| `id` | Kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), must match filename |
| `title` | Non-empty string |
| `firstLine` | Non-empty string |
| `textAttribution` | Non-empty string |
| `tuneAttribution` | Non-empty string |
| `authors` | Non-empty array; each entry needs `name` and a valid `role` |
| `tunes` | Array; each entry needs a non-empty `name` |
| `themes` | Non-empty array; each token must be a valid theme (see below) |
| `sections` | Non-empty array; no duplicate `id` values |
| `sections[].id` | Non-empty string |
| `sections[].type` | Must be a valid section type |
| `sections[].label` | Non-empty string |
| `sections[].order` | Must be a number |
| `sections[].text` | Non-empty string |

---

## Valid Themes

Only these tokens are accepted in the `themes` array:

| Token | Description |
|-------|-------------|
| `grace` | Salvation, redemption, atonement |
| `prayer` | Prayer, supplication, devotion |
| `reflection` | Meditation, penitence, contemplation |
| `praise` | Praise, worship, adoration |
| `majesty` | God's majesty and glory |
| `victory` | Resurrection, triumph, overcoming |
| `creation` | Nature, creation, God as Creator |
| `communion` | Lord's Supper, Eucharist |
| `guidance` | Pilgrimage, trust, direction |
| `thanksgiving` | Gratitude, thankfulness |
| `assurance` | Faith, trust, confidence |
| `holiness` | Sanctification, consecration |
| `comfort` | Consolation, peace, rest |
| `mission` | Evangelism, witness, outreach |
| `surrender` | Commitment, consecration, yielding |

---

## Troubleshooting

### Normalize stops or reports failures

- Each failed file is listed in the summary at the end (does not stop early)
- Delete the file if it cannot be fixed, then re-run
- Common cause: importer could not extract authors (empty `authors` array)

### Importer writes wrong slug / bad filename

- Caused by HTML entities in the title not being decoded (e.g. `&mdash;`)
- Fixed in `importFromHymnal.mjs` `NAMED_ENTITIES` map — add missing entities there
- Delete the malformed file, re-run the importer for that ID

### Build skips a file

- `hymn:build` only includes `status: "approved"` — check the file's status field
- Run normalize first, then approve

### `hymn:normalize` double-processes the folder

- Caused by passing `data/hymns/pd/` as an argument when the npm script already includes it
- Always run `npm run hymn:normalize` with no extra arguments

### Duplicate hymn (same hymn, two files)

- Can happen if the same hymn exists under two different slugs
- Compare titles, keep the better one, delete the other, rebuild

### CI check fails (`hymn:check`)

- The seed is out of date — an approved JSON was changed without rebuilding
- Run `npm run hymn:build` and commit the updated seed

---

*Last updated: April 2026. Bundle: Lumina PD — 149 hymns at time of writing.*
