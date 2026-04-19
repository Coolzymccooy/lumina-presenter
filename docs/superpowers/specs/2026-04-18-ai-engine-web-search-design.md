# Lumina AI Engine — Web Search for Lyrics (Tier-2 + Tier-3)

**Date:** 2026-04-18
**Status:** Design — awaiting user review
**Branch (planned):** `feature/ai-engine-web-search` (off `dev`)
**Owner:** Segun

## Problem

The Lumina AI Engine (V3.0) resolves song lyrics via a two-step flow:
1. Local public-domain hymn catalog (`searchCatalogHymns`)
2. Gemini 2.5 Flash via `/api/ai/assist-query`

This flow has a real gap for the growing Nigerian / African church user base. When a user searches for contemporary Nigerian gospel (Nathaniel Bassey, Mercy Chinwo, Sinach, Dunsin Oyekan, Victoria Orenze, etc.), both tiers fail:

- Catalog misses — those artists are not in the public-domain hymn library.
- Gemini deliberately refuses to fabricate copyrighted lyrics (`requiresManualInput: true` safeguard), so the user hits a "paste manually" wall.

Outside Lumina those users already visit naijalyrics-style sites in a browser to find the same lyrics. The goal is to shorten that loop inside Lumina without breaking copyright.

## Goals

- Close the "catalog miss + Gemini refuses" gap for lyrics-intent searches
- Preserve the existing copyright safeguard — do not store or redisplay copyrighted snippet scrapes
- Keep scope surgical: Search tab, lyrics intent only; no behaviour change elsewhere
- Ship behind a feature flag, default OFF, so rollout is reversible

## Non-Goals

- No change to LYRICS / ANNOUNCE / SERMON / SCRIPTURE tab flows
- No change to local hymn catalog, scripture API, or Gemini sermon generation
- No paid lyrics API integration (Musixmatch commercial, CCLI SongSelect) in this phase
- No in-app embedded webview for external lyric sites

## Approach — three-tier waterfall for lyrics intent

When `detectQueryIntent(query) === 'SONG'` (existing detector), the orchestrator walks three tiers. Non-lyrics intents are untouched.

```
[Tier 1] searchCatalogHymns                 (existing, local, ~instant)
         │ miss
         ▼
[Tier 2] LRCLIB adapter → Gemini sectioniser   (new, ~1-3s)
         │ miss
         ▼
[Tier 3] Brave Search → WebSearchResultCard   (new, snippets + Open Source link)
         │ user clicks Open Source
         ▼
[Clipboard capture] Electron main polls clipboard (armed, 5-min TTL)
         │ heuristic pass
         ▼
[Same pipeline] generateSlidesFromText → existing AIResultCard → slides
```

### Tier 2 — LRCLIB

- Free, licensed, open API: `GET https://lrclib.net/api/search?q=…`
- Server-side call (avoids client CORS issues and keeps the renderer agnostic to lyric providers)
- Response returns `plainLyrics` (or `syncedLyrics`) — unstructured text, no section labels
- Feed plain lyrics into existing `generateSlidesFromText` which uses Gemini to sectionise into `verse`/`chorus`/`bridge` and structure into slides
- Artist + source attribution ("Lyrics via LRCLIB") shown on result card

### Tier 3 — Brave Search fallback (snippets + links only)

- Server-side call to Brave `GET /v1/web/search?q=…`
- API key stored server-side only (`BRAVE_SEARCH_API_KEY` env var)
- Return 3–5 top results: `{ title, url, domain, snippet (≤ 40 words) }`
- Render `WebSearchResultCard`:
  - Title · domain · snippet
  - `[ Open Source ↗ ]` button — opens URL via `shell.openExternal` and arms clipboard watcher
  - `[ Generate ]` button — disabled until clipboard capture succeeds
- Lumina never stores, persists, or re-displays the full copyrighted lyric text from scraped pages. Only snippets (already public via search engines) are shown.

### Clipboard capture (Electron main)

State machine:

```
IDLE ── user clicks Open Source ─▶ ARMED (5-min TTL)
                                     │
                                     ├─ window blur → shell.openExternal(url)
                                     ├─ poll clipboard.readText() every 1s
                                     │
                clipboard changed ───┤
                                     ▼
                         passes lyric heuristic?
                           │                │
                          YES              NO
                           │                │
             CAPTURED → IPC to renderer   keep polling
                           │
           Renderer auto-fills textarea,
           enables [Generate], disarms watcher
                           │
                     Timeout OR modal close → DISARMED
```

**Lyric heuristic (pure function, all must pass):**
- ≥ 4 non-empty lines
- 200 ≤ length ≤ 8 000 chars
- First line is not a URL
- < 50 % of chars are digits or punctuation
- Not identical to the previously captured text

**Privacy guardrails (non-negotiable):**
- Watcher only arms on explicit `Open Source ↗` click
- Auto-disarms on: successful capture, 5-min TTL expiry, modal close
- Settings toggle `Smart lyric paste` (default ON) disables auto-capture entirely; user falls back to manual paste textarea
- Clipboard content never logged or persisted — transient only
- IPC is one-way renderer-in (renderer cannot trigger arbitrary clipboard reads)

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Renderer                                                    │
│  ├─ AIModal (SEARCH mode, lyrics intent)                     │
│  ├─ useLyricSearchOrchestrator   (3-tier state machine)      │
│  ├─ useLyricClipboardCapture     (IPC bridge + arm/disarm)   │
│  ├─ WebSearchResultCard          (new Brave result UI)       │
│  └─ services/lyricSources/                                   │
│       ├─ lrclibAdapter.ts                                    │
│       ├─ braveAdapter.ts                                     │
│       ├─ lyricHeuristic.ts                                   │
│       └─ types.ts                                            │
├──────────────────────────────────────────────────────────────┤
│  Electron main                                               │
│  ├─ clipboardLyricWatcher.ts     (poll + TTL + heuristic)    │
│  └─ ipc/lyricClipboard.ts        (one-way IPC)               │
├──────────────────────────────────────────────────────────────┤
│  Server (Express)                                            │
│  ├─ POST /api/lyrics/lrclib         → LRCLIB proxy           │
│  └─ POST /api/lyrics/web-search     → Brave Search proxy     │
│      (BRAVE_SEARCH_API_KEY required; 503 if flag OFF)        │
└──────────────────────────────────────────────────────────────┘
```

### Boundaries and contracts

**`useLyricSearchOrchestrator(query)`**
- Input: query string, lyrics intent confirmed by caller
- Output: discriminated union `{ kind: 'idle' | 'catalog' | 'lrclib' | 'web' | 'empty', data }`
- Does not render UI; modal selects the right card based on `kind`

**LRCLIB adapter**
- `searchLrclib(q: string): Promise<LrclibHit | null>`
- Single call, 10s timeout, returns first relevant hit or null

**Brave adapter**
- `searchWebForLyrics(q: string): Promise<WebSearchResult[]>`
- Returns 0–5 results, empty array on miss; throws on transport error

**Lyric heuristic**
- `looksLikeLyrics(text: string): boolean` — pure, unit-testable

**Clipboard watcher IPC channels**
- `lyric-clipboard:arm { url }` — renderer → main
- `lyric-clipboard:disarm` — renderer → main
- `lyric-clipboard:captured { text, sourceUrl }` — main → renderer (one-way)

## Feature flag

- `AI_WEB_LYRICS_FETCH` env var, default `false`
- Server routes return `503 { error: 'FEATURE_DISABLED' }` when off
- Orchestrator short-circuits past Tier 2/3 when flag off, preserving legacy Search flow
- Lets us merge dark and enable per-env (dev → staging → prod)

## Files

**New**
- `services/lyricSources/lrclibAdapter.ts`
- `services/lyricSources/braveAdapter.ts`
- `services/lyricSources/lyricHeuristic.ts`
- `services/lyricSources/types.ts`
- `hooks/useLyricSearchOrchestrator.ts`
- `hooks/useLyricClipboardCapture.ts`
- `electron/clipboardLyricWatcher.ts`
- `electron/ipc/lyricClipboard.ts`
- `components/ai-modal/WebSearchResultCard.tsx`
- `server/routes/lyrics.js` (dedicated router module, mounted from `server/index.js`)
- Co-located `.test.ts` files per module
- `tests/e2e/ai-engine-web-search.spec.ts`

**Modified**
- `components/AIModal.tsx` — wire orchestrator into SEARCH lyrics path; render `WebSearchResultCard`; read settings toggle
- `services/featureFlag.ts` — add `AI_WEB_LYRICS_FETCH`
- `server/index.js` — mount new routes, validate env vars on startup
- `.env.example` — add `BRAVE_SEARCH_API_KEY=` and `AI_WEB_LYRICS_FETCH=`
- `electron/main.ts` — register clipboard IPC

## Testing strategy

TDD, ≥ 80 % coverage, all existing gates still pass.

- `lyricHeuristic.test.ts` — truth table (empty, URL, code, lyrics, too short, too long, 3 lines)
- `lrclibAdapter.test.ts` — mocked HTTP, happy/miss/5xx/timeout
- `braveAdapter.test.ts` — mocked HTTP, snippet clamp, domain list, 5xx
- `useLyricSearchOrchestrator.test.tsx` — waterfall ordering, tier skip on hit, flag OFF skips 2+3
- `clipboardLyricWatcher.test.ts` — arm/disarm, TTL expiry, heuristic gate, disarm on modal close
- `routes/lyrics.test.js` — 200/404/503, API-key missing guard
- E2E `tests/e2e/ai-engine-web-search.spec.ts` — happy LRCLIB path + Brave fallback visibility
- Mandatory security-reviewer pass on server routes, clipboard watcher, env-var handling before PR

## Error handling

- LRCLIB 5xx / timeout → log + fall through to Tier 3 silently
- Brave 5xx / timeout → show friendly "Search unavailable — paste lyrics manually" empty state
- Brave API key missing → server 503; orchestrator treats as Tier 3 miss and shows manual-paste CTA
- Clipboard heuristic fail 3× in a row → auto-disarm and surface "Didn't detect lyrics — paste manually" hint

## Rollout plan

1. Merge with flag OFF → CI green, no regression in existing Search flow
2. Enable in dev → soak-test 10 popular Nigerian gospel titles (catalog hits, LRCLIB hits, Brave misses) + 10 edge cases (misspelled titles, non-lyrics queries accidentally classed as lyrics)
3. Enable in staging → capture LRCLIB hit-rate + Brave fallback-rate metrics
4. Enable in prod behind env flag with kill-switch
5. Monitor: LRCLIB hit rate, Brave fallback rate, clipboard-capture success rate, user-reported false positives

## Open questions (resolved during brainstorm)

- **Legal posture:** Scraping + redisplaying copyrighted lyrics is out. LRCLIB (licensed) + Brave snippets + user-initiated clipboard paste is in. Confirmed.
- **Scope:** Search tab, lyrics intent only. Confirmed.
- **Clipboard UX:** Electron-native smart capture with privacy guardrails + settings opt-out. Confirmed.
- **Cost tier:** Free only — LRCLIB + Brave free tier. Confirmed.

## Risks

- **LRCLIB Nigerian coverage:** may be 30–40 % initially; the Brave tier absorbs misses
- **Brave free-tier rate limit:** 2 000 queries/month — watch usage; may need per-user debounce or monthly cap
- **Clipboard false positive:** user copies unrelated text with 4 lines + 200 chars and trips the heuristic — mitigated by armed-only-after-click + settings opt-out
- **ToS drift:** LRCLIB or Brave change terms — feature flag enables instant disable
