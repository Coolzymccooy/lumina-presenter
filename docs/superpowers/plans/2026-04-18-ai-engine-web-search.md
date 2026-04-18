# AI Engine Web Search for Lyrics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Nigerian/African gospel lyrics gap in the Lumina AI Engine SEARCH tab by adding a three-tier waterfall (local catalog → LRCLIB licensed API → Brave Search snippets + Electron clipboard capture), all behind feature flag `AI_WEB_LYRICS_FETCH` default OFF.

**Architecture:** New `services/lyricSources/` module owns provider adapters and the lyric heuristic. A React hook `useLyricSearchOrchestrator` runs the waterfall as a discriminated state machine and is wired into `AIModal.tsx` only on SEARCH + lyrics intent. An Electron main-process `clipboardLyricWatcher` arms on explicit `Open Source ↗` click, polls `clipboard.readText()` for lyrics-shaped paste, and forwards via one-way IPC. A small Express router (`server/routes/lyrics.js`) proxies LRCLIB + Brave with server-side API keys.

**Tech Stack:** React 19, TypeScript 5.8, Vitest, Electron 40 (ESM main + CJS preload), Express 5, Node 22, Playwright E2E. No new runtime deps required (uses built-in `fetch` + existing `postAi` helper).

**Source spec:** `docs/superpowers/specs/2026-04-18-ai-engine-web-search-design.md`

---

## File Structure

**New files**
- `services/lyricSources/types.ts` — shared types (LyricSourceKind, LrclibHit, WebSearchResult, LyricsSearchState)
- `services/lyricSources/lyricHeuristic.ts` — pure `looksLikeLyrics(text)` predicate
- `services/lyricSources/lyricHeuristic.test.ts` — truth-table tests
- `services/lyricSources/lrclibAdapter.ts` — client-side fetch to `/api/lyrics/lrclib`
- `services/lyricSources/lrclibAdapter.test.ts`
- `services/lyricSources/braveAdapter.ts` — client-side fetch to `/api/lyrics/web-search`
- `services/lyricSources/braveAdapter.test.ts`
- `services/lyricSources/featureFlag.ts` — `isWebLyricsFetchEnabled()` (reads `import.meta.env.VITE_AI_WEB_LYRICS_FETCH`)
- `services/lyricSources/featureFlag.test.ts`
- `hooks/useLyricSearchOrchestrator.ts` — three-tier waterfall state machine
- `hooks/useLyricSearchOrchestrator.test.tsx`
- `hooks/useLyricClipboardCapture.ts` — IPC bridge arm/disarm/onCaptured
- `hooks/useLyricClipboardCapture.test.tsx`
- `components/ai-modal/WebSearchResultCard.tsx` — Brave results UI
- `components/ai-modal/WebSearchResultCard.test.tsx`
- `electron/clipboardLyricWatcher.js` — poll + TTL + heuristic state machine
- `electron/clipboardLyricWatcher.test.js`
- `electron/ipc/lyricClipboard.js` — register `lyric-clipboard:arm|disarm|captured`
- `server/routes/lyrics.js` — Express router (LRCLIB + Brave proxies)
- `server/routes/lyrics.test.js`
- `tests/e2e/ai-engine-web-search.spec.ts` — Playwright happy path + Brave fallback

**Modified files**
- `components/AIModal.tsx` — wire orchestrator into SEARCH lyrics path
- `electron/main.js` — register clipboard IPC module
- `electron/preload.js` — expose `lyricClipboard` namespace
- `server/index.js` — mount `/api/lyrics` router, validate env vars
- `.env.example` — new file, document `BRAVE_SEARCH_API_KEY`, `AI_WEB_LYRICS_FETCH`, `VITE_AI_WEB_LYRICS_FETCH`

---

## Task Decomposition

### Task 0: Branch setup and baseline

**Files:**
- None changed yet; creates `feature/ai-engine-web-search` off `dev`

- [ ] **Step 1: Verify working tree clean**

Run: `git status`
Expected: either clean, or only the committed spec file present. If dirty with unrelated work, stash before proceeding.

- [ ] **Step 2: Create the feature branch off `dev`**

Run: `git fetch origin && git checkout -b feature/ai-engine-web-search origin/dev`
Expected: `Switched to a new branch 'feature/ai-engine-web-search'`. If `dev` does not exist remotely, branch off `master` instead and note the deviation in the PR.

- [ ] **Step 3: Confirm test tooling works**

Run: `npx vitest run --reporter=basic --pool=forks --testTimeout=5000 services/hymnCatalog.test.ts`
Expected: existing tests PASS. This establishes the baseline before we add new tests.

- [ ] **Step 4: Commit branch starting point (empty marker commit, optional)**

No changes to commit. Proceed to Task 1.

---

### Task 1: Shared types for lyric sources

**Files:**
- Create: `services/lyricSources/types.ts`

- [ ] **Step 1: Write the types module**

```typescript
// services/lyricSources/types.ts
export interface LrclibHit {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  plainLyrics: string;
  syncedLyrics?: string | null;
  duration?: number | null;
}

export interface WebSearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export type LyricsSearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; tier: 'catalog' | 'lrclib' | 'web' }
  | { kind: 'catalog'; hymnId: string }
  | { kind: 'lrclib'; hit: LrclibHit }
  | { kind: 'web'; results: WebSearchResult[] }
  | { kind: 'empty'; reason: 'no-results' | 'flag-off' | 'error'; message?: string };

export interface LyricClipboardPayload {
  text: string;
  sourceUrl: string;
}
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "lyricSources/types" || echo "no errors"`
Expected: `no errors`.

- [ ] **Step 3: Commit**

```bash
git add services/lyricSources/types.ts
git commit -m "feat(ai-engine): add lyric source shared types"
```

---

### Task 2: Lyric heuristic (pure function, TDD truth table)

**Files:**
- Create: `services/lyricSources/lyricHeuristic.ts`
- Test: `services/lyricSources/lyricHeuristic.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// services/lyricSources/lyricHeuristic.test.ts
import { describe, it, expect } from 'vitest';
import { looksLikeLyrics } from './lyricHeuristic';

const validLyrics = `Way maker, miracle worker
Promise keeper, light in the darkness
My God, that is who you are
My God, that is who you are

Even when I don't see it, you're working
Even when I don't feel it, you're working
You never stop, you never stop working`;

describe('looksLikeLyrics', () => {
  it('accepts well-formed lyrics', () => {
    expect(looksLikeLyrics(validLyrics)).toBe(true);
  });

  it('rejects empty string', () => {
    expect(looksLikeLyrics('')).toBe(false);
  });

  it('rejects text under 200 chars', () => {
    expect(looksLikeLyrics('short\nshort\nshort\nshort')).toBe(false);
  });

  it('rejects text over 8000 chars', () => {
    const huge = 'line one has more than forty characters in it\n'.repeat(400);
    expect(looksLikeLyrics(huge)).toBe(false);
  });

  it('rejects text with fewer than 4 non-empty lines', () => {
    const three = `line one has more than forty characters in it\nline two has more than forty characters here\nline three has more than forty characters too\n\n`.padEnd(250, ' ');
    expect(looksLikeLyrics(three)).toBe(false);
  });

  it('rejects text whose first line is a URL', () => {
    const urlLead = `https://example.com/song\n${validLyrics}`;
    expect(looksLikeLyrics(urlLead)).toBe(false);
  });

  it('rejects text that is mostly digits/punctuation', () => {
    const numeric = ('1234567890!@#$%^&*()\n'.repeat(20)).padEnd(300, '1');
    expect(looksLikeLyrics(numeric)).toBe(false);
  });

  it('rejects code-shaped text', () => {
    const code = `function foo() {\n  return bar;\n}\nconst x = { a: 1, b: 2 };\nif (x.a > 0) { console.log('hi'); }\n`.padEnd(250, ' ');
    // code tends to fail the digit/punct ratio; assert rejection either way
    expect(looksLikeLyrics(code)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/lyricSources/lyricHeuristic.test.ts`
Expected: FAIL with `Cannot find module './lyricHeuristic'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/lyricSources/lyricHeuristic.ts
const MIN_CHARS = 200;
const MAX_CHARS = 8000;
const MIN_LINES = 4;
const MAX_DIGIT_PUNCT_RATIO = 0.5;
const URL_RE = /^https?:\/\//i;

export function looksLikeLyrics(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < MIN_CHARS || trimmed.length > MAX_CHARS) return false;

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < MIN_LINES) return false;
  if (URL_RE.test(lines[0])) return false;

  const nonWhitespace = trimmed.replace(/\s/g, '');
  if (nonWhitespace.length === 0) return false;
  const digitsPunct = nonWhitespace.replace(/[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g, '').length;
  const ratio = digitsPunct / nonWhitespace.length;
  if (ratio >= MAX_DIGIT_PUNCT_RATIO) return false;

  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/lyricSources/lyricHeuristic.test.ts`
Expected: 8/8 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/lyricSources/lyricHeuristic.ts services/lyricSources/lyricHeuristic.test.ts
git commit -m "feat(ai-engine): add lyric-shape heuristic for clipboard capture"
```

---

### Task 3: LRCLIB adapter (client)

**Files:**
- Create: `services/lyricSources/lrclibAdapter.ts`
- Test: `services/lyricSources/lrclibAdapter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// services/lyricSources/lrclibAdapter.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../serverApi', () => ({
  getServerApiBaseCandidates: () => ['http://localhost:3001'],
  getServerApiBaseUrl: () => 'http://localhost:3001',
}));

import { searchLrclib } from './lrclibAdapter';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchJson(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }) as unknown as Response) as unknown as typeof fetch;
}

describe('searchLrclib', () => {
  it('returns first hit on success', async () => {
    mockFetchJson(200, {
      ok: true,
      data: { hit: { id: 1, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'Way maker...' } },
    });
    const hit = await searchLrclib('Way Maker Sinach');
    expect(hit?.trackName).toBe('Way Maker');
    expect(hit?.plainLyrics).toContain('Way maker');
  });

  it('returns null on miss (200 + no data)', async () => {
    mockFetchJson(200, { ok: true, data: { hit: null } });
    const hit = await searchLrclib('unknown song');
    expect(hit).toBeNull();
  });

  it('returns null on server 503 (flag off)', async () => {
    mockFetchJson(503, { ok: false, error: 'FEATURE_DISABLED' });
    const hit = await searchLrclib('anything');
    expect(hit).toBeNull();
  });

  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof fetch;
    const hit = await searchLrclib('anything');
    expect(hit).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run services/lyricSources/lrclibAdapter.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write implementation**

```typescript
// services/lyricSources/lrclibAdapter.ts
import { getServerApiBaseCandidates } from '../serverApi';
import type { LrclibHit } from './types';

const TIMEOUT_MS = 10_000;

export async function searchLrclib(query: string): Promise<LrclibHit | null> {
  const q = query.trim();
  if (!q) return null;
  const bases = getServerApiBaseCandidates();
  if (!bases.length) return null;

  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/lyrics/lrclib`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { hit?: LrclibHit | null } } | null;
      return json?.data?.hit ?? null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/lyricSources/lrclibAdapter.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/lyricSources/lrclibAdapter.ts services/lyricSources/lrclibAdapter.test.ts
git commit -m "feat(ai-engine): add LRCLIB client adapter"
```

---

### Task 4: Brave Search adapter (client)

**Files:**
- Create: `services/lyricSources/braveAdapter.ts`
- Test: `services/lyricSources/braveAdapter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// services/lyricSources/braveAdapter.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../serverApi', () => ({
  getServerApiBaseCandidates: () => ['http://localhost:3001'],
  getServerApiBaseUrl: () => 'http://localhost:3001',
}));

import { searchWebForLyrics } from './braveAdapter';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function mockFetchJson(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }) as unknown as Response) as unknown as typeof fetch;
}

describe('searchWebForLyrics', () => {
  it('returns up to 5 results on success', async () => {
    mockFetchJson(200, {
      ok: true,
      data: {
        results: Array.from({ length: 8 }, (_, i) => ({
          title: `Song ${i}`,
          url: `https://naijalyrics.example/song-${i}`,
          domain: 'naijalyrics.example',
          snippet: 'Short snippet',
        })),
      },
    });
    const results = await searchWebForLyrics('Nathaniel Bassey Olowogbogboro');
    expect(results.length).toBe(5);
    expect(results[0].domain).toBe('naijalyrics.example');
  });

  it('returns empty array on miss', async () => {
    mockFetchJson(200, { ok: true, data: { results: [] } });
    expect(await searchWebForLyrics('nothing')).toEqual([]);
  });

  it('returns empty array on 503 (flag off)', async () => {
    mockFetchJson(503, { ok: false, error: 'FEATURE_DISABLED' });
    expect(await searchWebForLyrics('any')).toEqual([]);
  });

  it('clamps snippet to 40 words', async () => {
    const longSnippet = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    mockFetchJson(200, {
      ok: true,
      data: { results: [{ title: 't', url: 'https://x.example/y', domain: 'x.example', snippet: longSnippet }] },
    });
    const [r] = await searchWebForLyrics('q');
    expect(r.snippet.split(/\s+/).length).toBeLessThanOrEqual(40);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run services/lyricSources/braveAdapter.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write implementation**

```typescript
// services/lyricSources/braveAdapter.ts
import { getServerApiBaseCandidates } from '../serverApi';
import type { WebSearchResult } from './types';

const TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_WORDS = 40;

function clampSnippet(snippet: string): string {
  const words = snippet.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_SNIPPET_WORDS) return words.join(' ');
  return words.slice(0, MAX_SNIPPET_WORDS).join(' ') + '…';
}

export async function searchWebForLyrics(query: string): Promise<WebSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const bases = getServerApiBaseCandidates();
  if (!bases.length) return [];

  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/lyrics/web-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return [];
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { results?: WebSearchResult[] } } | null;
      const raw = json?.data?.results ?? [];
      return raw
        .slice(0, MAX_RESULTS)
        .map((r) => ({ title: r.title, url: r.url, domain: r.domain, snippet: clampSnippet(r.snippet || '') }));
    } catch {
      clearTimeout(timer);
      return [];
    }
  }
  return [];
}
```

- [ ] **Step 4: Run test to verify passes**

Run: `npx vitest run services/lyricSources/braveAdapter.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/lyricSources/braveAdapter.ts services/lyricSources/braveAdapter.test.ts
git commit -m "feat(ai-engine): add Brave Search client adapter"
```

---

### Task 5: Client feature flag

**Files:**
- Create: `services/lyricSources/featureFlag.ts`
- Test: `services/lyricSources/featureFlag.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// services/lyricSources/featureFlag.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWebLyricsFetchEnabled } from './featureFlag';

afterEach(() => { vi.unstubAllEnvs(); });

describe('isWebLyricsFetchEnabled', () => {
  it('returns false by default', () => {
    vi.stubEnv('VITE_AI_WEB_LYRICS_FETCH', '');
    expect(isWebLyricsFetchEnabled()).toBe(false);
  });

  it('returns true when env is "true"', () => {
    vi.stubEnv('VITE_AI_WEB_LYRICS_FETCH', 'true');
    expect(isWebLyricsFetchEnabled()).toBe(true);
  });

  it('returns true when env is "1"', () => {
    vi.stubEnv('VITE_AI_WEB_LYRICS_FETCH', '1');
    expect(isWebLyricsFetchEnabled()).toBe(true);
  });

  it('returns false for unexpected value', () => {
    vi.stubEnv('VITE_AI_WEB_LYRICS_FETCH', 'maybe');
    expect(isWebLyricsFetchEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run services/lyricSources/featureFlag.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write implementation**

```typescript
// services/lyricSources/featureFlag.ts
export function isWebLyricsFetchEnabled(): boolean {
  const raw = String((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AI_WEB_LYRICS_FETCH || '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}
```

- [ ] **Step 4: Run test to verify passes**

Run: `npx vitest run services/lyricSources/featureFlag.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/lyricSources/featureFlag.ts services/lyricSources/featureFlag.test.ts
git commit -m "feat(ai-engine): add client feature flag helper"
```

---

### Task 6: Server lyrics router

**Files:**
- Create: `server/routes/lyrics.js`
- Test: `server/routes/lyrics.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// server/routes/lyrics.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { createLyricsRouter } from './lyrics.js';

const originalFetch = globalThis.fetch;

function makeApp(env) {
  const app = express();
  app.use(express.json());
  app.use('/api/lyrics', createLyricsRouter({ env }));
  return app;
}

async function callJson(app, path, body) {
  const { default: request } = await import('supertest');
  return request(app).post(path).send(body).set('Content-Type', 'application/json');
}

beforeEach(() => {
  globalThis.fetch = originalFetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('POST /api/lyrics/lrclib', () => {
  it('returns 503 when feature flag is off', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'false' });
    const res = await callJson(app, '/api/lyrics/lrclib', { query: 'Way Maker' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('FEATURE_DISABLED');
  });

  it('returns first hit when flag on and LRCLIB has match', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ([{ id: 1, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'Way maker...' }]),
    }));
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/lrclib', { query: 'Way Maker' });
    expect(res.status).toBe(200);
    expect(res.body.data.hit.trackName).toBe('Way Maker');
  });

  it('returns 400 when query missing', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/lrclib', {});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/lyrics/web-search', () => {
  it('returns 503 when Brave API key missing', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/web-search', { query: 'any' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('BRAVE_API_KEY_MISSING');
  });

  it('returns 503 when flag off', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'false', BRAVE_SEARCH_API_KEY: 'x' });
    const res = await callJson(app, '/api/lyrics/web-search', { query: 'any' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('FEATURE_DISABLED');
  });

  it('returns mapped results on success', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        web: {
          results: [
            { title: 'Song A', url: 'https://naijalyrics.example/a', meta_url: { hostname: 'naijalyrics.example' }, description: 'Lyrics snippet' },
          ],
        },
      }),
    }));
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true', BRAVE_SEARCH_API_KEY: 'test-key' });
    const res = await callJson(app, '/api/lyrics/web-search', { query: 'Olowogbogboro' });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].domain).toBe('naijalyrics.example');
  });
});
```

Note: if `supertest` is not already installed, install it as a devDependency: `npm install --save-dev supertest`.

- [ ] **Step 2: Run test to verify failure**

Run: `npm install --save-dev supertest && npx vitest run server/routes/lyrics.test.js`
Expected: FAIL — router module missing.

- [ ] **Step 3: Write implementation**

```javascript
// server/routes/lyrics.js
import express from 'express';

const LRCLIB_ENDPOINT = 'https://lrclib.net/api/search';
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_WORDS = 40;

function isFlagOn(env) {
  const raw = String(env?.AI_WEB_LYRICS_FETCH || '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

function clampSnippet(snippet) {
  const words = String(snippet || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_SNIPPET_WORDS) return words.join(' ');
  return words.slice(0, MAX_SNIPPET_WORDS).join(' ') + '…';
}

async function fetchWithTimeout(url, init = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function createLyricsRouter(options = {}) {
  const env = options.env || process.env;
  const router = express.Router();

  router.post('/lrclib', async (req, res) => {
    if (!isFlagOn(env)) return res.status(503).json({ ok: false, error: 'FEATURE_DISABLED' });
    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ ok: false, error: 'QUERY_REQUIRED' });

    try {
      const url = `${LRCLIB_ENDPOINT}?q=${encodeURIComponent(query)}`;
      const upstream = await fetchWithTimeout(url, { method: 'GET', headers: { 'User-Agent': 'LuminaPresenter/1.0' } });
      if (!upstream.ok) return res.status(502).json({ ok: false, error: 'LRCLIB_UPSTREAM_ERROR' });
      const arr = await upstream.json().catch(() => []);
      const first = Array.isArray(arr) ? arr.find((row) => row && typeof row.plainLyrics === 'string' && row.plainLyrics.trim().length > 0) : null;
      if (!first) return res.status(200).json({ ok: true, data: { hit: null } });
      return res.status(200).json({
        ok: true,
        data: {
          hit: {
            id: first.id,
            trackName: first.trackName,
            artistName: first.artistName,
            albumName: first.albumName || undefined,
            plainLyrics: first.plainLyrics,
            syncedLyrics: first.syncedLyrics || null,
            duration: first.duration || null,
          },
        },
      });
    } catch (err) {
      return res.status(502).json({ ok: false, error: 'LRCLIB_FETCH_FAILED', message: String(err?.message || err) });
    }
  });

  router.post('/web-search', async (req, res) => {
    if (!isFlagOn(env)) return res.status(503).json({ ok: false, error: 'FEATURE_DISABLED' });
    const apiKey = String(env?.BRAVE_SEARCH_API_KEY || '').trim();
    if (!apiKey) return res.status(503).json({ ok: false, error: 'BRAVE_API_KEY_MISSING' });

    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ ok: false, error: 'QUERY_REQUIRED' });

    try {
      const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(query + ' lyrics')}&count=10`;
      const upstream = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
      });
      if (!upstream.ok) return res.status(502).json({ ok: false, error: 'BRAVE_UPSTREAM_ERROR' });
      const body = await upstream.json().catch(() => null);
      const raw = body?.web?.results;
      const results = Array.isArray(raw)
        ? raw
            .slice(0, MAX_RESULTS)
            .map((r) => ({
              title: String(r.title || '').trim(),
              url: String(r.url || '').trim(),
              domain: String(r.meta_url?.hostname || r.profile?.long_name || new URL(r.url || 'https://x').hostname).trim(),
              snippet: clampSnippet(r.description || ''),
            }))
            .filter((r) => r.title && r.url)
        : [];
      return res.status(200).json({ ok: true, data: { results } });
    } catch (err) {
      return res.status(502).json({ ok: false, error: 'BRAVE_FETCH_FAILED', message: String(err?.message || err) });
    }
  });

  return router;
}
```

- [ ] **Step 4: Run tests to verify passing**

Run: `npx vitest run server/routes/lyrics.test.js`
Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/lyrics.js server/routes/lyrics.test.js package.json package-lock.json
git commit -m "feat(ai-engine): add /api/lyrics router (LRCLIB + Brave proxies)"
```

---

### Task 7: Mount lyrics router + `.env.example`

**Files:**
- Modify: `server/index.js`
- Create: `.env.example`

- [ ] **Step 1: Mount the router in server bootstrap**

Add this block in `server/index.js` immediately after the `app.use(express.json(...))` block (near line 478 — locate by searching for `app.use(cors())`).

```javascript
// After: app.use(express.json({ limit: JSON_LIMIT }));
import { createLyricsRouter } from './routes/lyrics.js';
app.use('/api/lyrics', createLyricsRouter());
```

Note: if `import` is not permitted mid-file due to top-level restrictions, add the `import` to the top imports block and leave only the `app.use(...)` mount line at the mid-file position.

- [ ] **Step 2: Smoke-test the server boot**

Run: `node -e "import('./server/index.js').then(()=>console.log('boot ok')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `boot ok` printed within 10s. If it hangs, server opened a port — that's fine, Ctrl+C.

- [ ] **Step 3: Create `.env.example`**

```bash
# .env.example — copy to .env.local and fill in secrets
VITE_API_BASE_URL=http://localhost:3001

# AI Engine web lyrics (Tier-2 + Tier-3) — default OFF
AI_WEB_LYRICS_FETCH=false
VITE_AI_WEB_LYRICS_FETCH=false

# Brave Search API (free tier: 2000 queries/month)
BRAVE_SEARCH_API_KEY=

# Google AI (Gemini)
GOOGLE_AI_API_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add server/index.js .env.example
git commit -m "feat(ai-engine): mount /api/lyrics router + document env vars"
```

---

### Task 8: Lyric search orchestrator hook

**Files:**
- Create: `hooks/useLyricSearchOrchestrator.ts`
- Test: `hooks/useLyricSearchOrchestrator.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// hooks/useLyricSearchOrchestrator.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const searchCatalogHymnsMock = vi.fn();
const searchLrclibMock = vi.fn();
const searchWebForLyricsMock = vi.fn();
const isFlagOnMock = vi.fn();

vi.mock('../services/hymnCatalog', () => ({ searchCatalogHymns: (...a: unknown[]) => searchCatalogHymnsMock(...a) }));
vi.mock('../services/lyricSources/lrclibAdapter', () => ({ searchLrclib: (...a: unknown[]) => searchLrclibMock(...a) }));
vi.mock('../services/lyricSources/braveAdapter', () => ({ searchWebForLyrics: (...a: unknown[]) => searchWebForLyricsMock(...a) }));
vi.mock('../services/lyricSources/featureFlag', () => ({ isWebLyricsFetchEnabled: () => isFlagOnMock() }));

import { useLyricSearchOrchestrator, type LyricSearchReturn } from './useLyricSearchOrchestrator';

let container: HTMLDivElement;
let root: Root;
let latest: LyricSearchReturn | null = null;

function Harness({ query }: { query: string }) {
  latest = useLyricSearchOrchestrator(query);
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
  searchCatalogHymnsMock.mockReset();
  searchLrclibMock.mockReset();
  searchWebForLyricsMock.mockReset();
  isFlagOnMock.mockReset().mockReturnValue(true);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function flush() { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); }

describe('useLyricSearchOrchestrator', () => {
  it('returns catalog hit when tier 1 succeeds', async () => {
    searchCatalogHymnsMock.mockReturnValue([{ hymn: { id: 'amazing-grace' } }]);
    act(() => root.render(<Harness query="amazing grace" />));
    await flush();
    expect(latest?.state.kind).toBe('catalog');
    expect(searchLrclibMock).not.toHaveBeenCalled();
  });

  it('falls through to LRCLIB when catalog misses', async () => {
    searchCatalogHymnsMock.mockReturnValue([]);
    searchLrclibMock.mockResolvedValue({ id: 1, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'Way maker...' });
    act(() => root.render(<Harness query="way maker" />));
    await flush();
    await flush();
    expect(latest?.state.kind).toBe('lrclib');
    expect(searchWebForLyricsMock).not.toHaveBeenCalled();
  });

  it('falls through to Brave when LRCLIB misses', async () => {
    searchCatalogHymnsMock.mockReturnValue([]);
    searchLrclibMock.mockResolvedValue(null);
    searchWebForLyricsMock.mockResolvedValue([{ title: 'a', url: 'https://x/y', domain: 'x', snippet: 's' }]);
    act(() => root.render(<Harness query="olowogbogboro" />));
    await flush(); await flush(); await flush();
    expect(latest?.state.kind).toBe('web');
  });

  it('skips Tier 2/3 when flag OFF', async () => {
    isFlagOnMock.mockReturnValue(false);
    searchCatalogHymnsMock.mockReturnValue([]);
    act(() => root.render(<Harness query="something" />));
    await flush();
    expect(latest?.state.kind).toBe('empty');
    if (latest?.state.kind === 'empty') expect(latest.state.reason).toBe('flag-off');
    expect(searchLrclibMock).not.toHaveBeenCalled();
  });

  it('returns empty when all three tiers miss', async () => {
    searchCatalogHymnsMock.mockReturnValue([]);
    searchLrclibMock.mockResolvedValue(null);
    searchWebForLyricsMock.mockResolvedValue([]);
    act(() => root.render(<Harness query="unknown" />));
    await flush(); await flush(); await flush();
    expect(latest?.state.kind).toBe('empty');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run hooks/useLyricSearchOrchestrator.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write implementation**

```typescript
// hooks/useLyricSearchOrchestrator.ts
import { useEffect, useState } from 'react';
import { searchCatalogHymns } from '../services/hymnCatalog';
import { searchLrclib } from '../services/lyricSources/lrclibAdapter';
import { searchWebForLyrics } from '../services/lyricSources/braveAdapter';
import { isWebLyricsFetchEnabled } from '../services/lyricSources/featureFlag';
import type { LyricsSearchState } from '../services/lyricSources/types';

export interface LyricSearchReturn {
  state: LyricsSearchState;
}

export function useLyricSearchOrchestrator(query: string): LyricSearchReturn {
  const [state, setState] = useState<LyricsSearchState>({ kind: 'idle' });

  useEffect(() => {
    const q = query.trim();
    if (!q) { setState({ kind: 'idle' }); return; }

    let cancelled = false;
    setState({ kind: 'searching', tier: 'catalog' });

    (async () => {
      const catalogHits = searchCatalogHymns(q);
      if (cancelled) return;
      if (catalogHits.length > 0) {
        setState({ kind: 'catalog', hymnId: catalogHits[0].hymn.id });
        return;
      }

      if (!isWebLyricsFetchEnabled()) {
        setState({ kind: 'empty', reason: 'flag-off' });
        return;
      }

      setState({ kind: 'searching', tier: 'lrclib' });
      const hit = await searchLrclib(q);
      if (cancelled) return;
      if (hit) { setState({ kind: 'lrclib', hit }); return; }

      setState({ kind: 'searching', tier: 'web' });
      const results = await searchWebForLyrics(q);
      if (cancelled) return;
      if (results.length > 0) { setState({ kind: 'web', results }); return; }

      setState({ kind: 'empty', reason: 'no-results' });
    })().catch((err) => {
      if (cancelled) return;
      setState({ kind: 'empty', reason: 'error', message: String(err?.message || err) });
    });

    return () => { cancelled = true; };
  }, [query]);

  return { state };
}
```

- [ ] **Step 4: Run test to verify passes**

Run: `npx vitest run hooks/useLyricSearchOrchestrator.test.tsx`
Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useLyricSearchOrchestrator.ts hooks/useLyricSearchOrchestrator.test.tsx
git commit -m "feat(ai-engine): add three-tier lyric search orchestrator hook"
```

---

### Task 9: Electron clipboard lyric watcher

**Files:**
- Create: `electron/clipboardLyricWatcher.js`
- Create: `electron/clipboardLyricWatcher.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// electron/clipboardLyricWatcher.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClipboardLyricWatcher } from './clipboardLyricWatcher.js';

function makeClipboard(initial = '') {
  let current = initial;
  return {
    readText: () => current,
    writeText: (t) => { current = t; },
    _set: (t) => { current = t; },
  };
}

const VALID_LYRICS = `Way maker, miracle worker
Promise keeper, light in the darkness
My God, that is who you are
My God, that is who you are
Even when I don't see it, you're working
Even when I don't feel it, you're working
You never stop, you never stop working`;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('clipboardLyricWatcher', () => {
  it('does not fire before arm()', () => {
    const cb = makeClipboard(VALID_LYRICS);
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 5000, onCaptured });
    vi.advanceTimersByTime(500);
    expect(onCaptured).not.toHaveBeenCalled();
    w.dispose();
  });

  it('captures lyrics after arm() when clipboard changes', () => {
    const cb = makeClipboard('baseline');
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 5000, onCaptured });
    w.arm('https://source.example/song');
    cb._set(VALID_LYRICS);
    vi.advanceTimersByTime(150);
    expect(onCaptured).toHaveBeenCalledTimes(1);
    expect(onCaptured.mock.calls[0][0]).toMatchObject({ text: VALID_LYRICS, sourceUrl: 'https://source.example/song' });
    w.dispose();
  });

  it('auto-disarms after TTL', () => {
    const cb = makeClipboard('baseline');
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 1000, onCaptured });
    w.arm('https://source.example/song');
    vi.advanceTimersByTime(1500);
    cb._set(VALID_LYRICS);
    vi.advanceTimersByTime(200);
    expect(onCaptured).not.toHaveBeenCalled();
    w.dispose();
  });

  it('ignores clipboard changes that fail the heuristic', () => {
    const cb = makeClipboard('baseline');
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 5000, onCaptured });
    w.arm('https://source.example/song');
    cb._set('short text');
    vi.advanceTimersByTime(200);
    expect(onCaptured).not.toHaveBeenCalled();
    w.dispose();
  });

  it('disarm() stops captures', () => {
    const cb = makeClipboard('baseline');
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 5000, onCaptured });
    w.arm('https://source.example/song');
    w.disarm();
    cb._set(VALID_LYRICS);
    vi.advanceTimersByTime(200);
    expect(onCaptured).not.toHaveBeenCalled();
    w.dispose();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run electron/clipboardLyricWatcher.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Write implementation**

```javascript
// electron/clipboardLyricWatcher.js
import { looksLikeLyrics } from '../services/lyricSources/lyricHeuristic.ts';

const DEFAULT_POLL_MS = 1000;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function createClipboardLyricWatcher(opts) {
  const clipboard = opts.clipboard;
  const pollIntervalMs = opts.pollIntervalMs || DEFAULT_POLL_MS;
  const ttlMs = opts.ttlMs || DEFAULT_TTL_MS;
  const onCaptured = opts.onCaptured;
  const isLyrics = opts.isLyrics || looksLikeLyrics;

  let state = 'IDLE';
  let sourceUrl = '';
  let baseline = '';
  let lastCaptured = '';
  let pollTimer = null;
  let ttlTimer = null;

  function clearTimers() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (ttlTimer) { clearTimeout(ttlTimer); ttlTimer = null; }
  }

  function disarm() {
    state = 'IDLE';
    sourceUrl = '';
    baseline = '';
    clearTimers();
  }

  function arm(url) {
    disarm();
    state = 'ARMED';
    sourceUrl = String(url || '');
    baseline = safeRead();
    pollTimer = setInterval(poll, pollIntervalMs);
    ttlTimer = setTimeout(disarm, ttlMs);
  }

  function safeRead() {
    try { return String(clipboard.readText() || ''); } catch { return ''; }
  }

  function poll() {
    if (state !== 'ARMED') return;
    const current = safeRead();
    if (!current || current === baseline || current === lastCaptured) return;
    if (!isLyrics(current)) return;
    lastCaptured = current;
    const payload = { text: current, sourceUrl };
    disarm();
    try { onCaptured && onCaptured(payload); } catch { /* swallow */ }
  }

  return { arm, disarm, dispose: disarm, getState: () => state };
}
```

Note: importing `.ts` from `.js` works because the project is ESM with TS transpilation in Electron context. If the runtime rejects it, change the import to re-implement the heuristic inline or compile the module first — add a follow-up task if this arises.

- [ ] **Step 4: Run test to verify passes**

Run: `npx vitest run electron/clipboardLyricWatcher.test.js`
Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/clipboardLyricWatcher.js electron/clipboardLyricWatcher.test.js
git commit -m "feat(ai-engine): add Electron clipboard lyric watcher"
```

---

### Task 10: IPC bridge (main ↔ preload) for clipboard capture

**Files:**
- Create: `electron/ipc/lyricClipboard.js`
- Modify: `electron/main.js`
- Modify: `electron/preload.js`

- [ ] **Step 1: Create the IPC module**

```javascript
// electron/ipc/lyricClipboard.js
import { ipcMain, clipboard, shell, BrowserWindow } from 'electron';
import { createClipboardLyricWatcher } from '../clipboardLyricWatcher.js';

const CHANNEL_ARM = 'lyric-clipboard:arm';
const CHANNEL_DISARM = 'lyric-clipboard:disarm';
const CHANNEL_CAPTURED = 'lyric-clipboard:captured';

let watcher = null;

function broadcastCaptured(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(CHANNEL_CAPTURED, payload);
  }
}

export function registerLyricClipboardIpc() {
  if (watcher) return; // idempotent
  watcher = createClipboardLyricWatcher({
    clipboard,
    onCaptured: broadcastCaptured,
  });

  ipcMain.handle(CHANNEL_ARM, async (_event, payload) => {
    const url = String(payload?.url || '');
    if (!url) return { ok: false, error: 'URL_REQUIRED' };
    watcher.arm(url);
    try { await shell.openExternal(url); } catch (err) {
      return { ok: false, error: 'OPEN_EXTERNAL_FAILED', message: String(err?.message || err) };
    }
    return { ok: true };
  });

  ipcMain.handle(CHANNEL_DISARM, async () => {
    watcher.disarm();
    return { ok: true };
  });
}

export function disposeLyricClipboardIpc() {
  if (!watcher) return;
  watcher.dispose();
  watcher = null;
  ipcMain.removeHandler(CHANNEL_ARM);
  ipcMain.removeHandler(CHANNEL_DISARM);
}
```

- [ ] **Step 2: Wire into `electron/main.js`**

Add import near the top of the imports block:

```javascript
import { registerLyricClipboardIpc } from './ipc/lyricClipboard.js';
```

Call `registerLyricClipboardIpc();` inside the existing `installClipboardHandlers()` function (line ~223), at the end of the function body.

- [ ] **Step 3: Expose in `electron/preload.js`**

Append a new namespace to the `contextBridge.exposeInMainWorld('electron', {...})` object:

```javascript
lyricClipboard: {
  arm: (url) => ipcRenderer.invoke('lyric-clipboard:arm', { url }),
  disarm: () => ipcRenderer.invoke('lyric-clipboard:disarm'),
  onCaptured: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('lyric-clipboard:captured', listener);
    return () => ipcRenderer.removeListener('lyric-clipboard:captured', listener);
  },
},
```

- [ ] **Step 4: Smoke-test Electron boot**

Run: `npm run electron:dev` (leave running ~15s, check devtools console for no new errors, then Ctrl+C).
Expected: window opens, no console errors referencing `lyric-clipboard`.

- [ ] **Step 5: Commit**

```bash
git add electron/ipc/lyricClipboard.js electron/main.js electron/preload.js
git commit -m "feat(ai-engine): wire lyric-clipboard IPC (main + preload)"
```

---

### Task 11: Renderer hook for clipboard capture

**Files:**
- Create: `hooks/useLyricClipboardCapture.ts`
- Create: `hooks/useLyricClipboardCapture.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// hooks/useLyricClipboardCapture.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useLyricClipboardCapture, type UseLyricClipboardReturn } from './useLyricClipboardCapture';

let container: HTMLDivElement;
let root: Root;
let latest: UseLyricClipboardReturn | null = null;
let capturedCb: ((p: { text: string; sourceUrl: string }) => void) | null = null;
const armMock = vi.fn(async () => ({ ok: true }));
const disarmMock = vi.fn(async () => ({ ok: true }));

function Harness() { latest = useLyricClipboardCapture(); return null; }

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  capturedCb = null;
  armMock.mockClear();
  disarmMock.mockClear();
  (globalThis as any).window.electron = {
    lyricClipboard: {
      arm: armMock,
      disarm: disarmMock,
      onCaptured: (cb: (p: { text: string; sourceUrl: string }) => void) => { capturedCb = cb; return () => { capturedCb = null; }; },
    },
  };
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (globalThis as any).window.electron;
});

describe('useLyricClipboardCapture', () => {
  it('arm() delegates to IPC bridge', async () => {
    act(() => root.render(<Harness />));
    await act(async () => { await latest!.arm('https://x.example/a'); });
    expect(armMock).toHaveBeenCalledWith('https://x.example/a');
  });

  it('surfaces captured text via state', async () => {
    act(() => root.render(<Harness />));
    act(() => { capturedCb?.({ text: 'LYRICS', sourceUrl: 'https://x/y' }); });
    expect(latest?.captured).toEqual({ text: 'LYRICS', sourceUrl: 'https://x/y' });
  });

  it('returns a no-op when electron bridge is absent', async () => {
    delete (globalThis as any).window.electron;
    act(() => root.render(<Harness />));
    await act(async () => { await latest!.arm('https://x'); });
    expect(latest?.isSupported).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run hooks/useLyricClipboardCapture.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write implementation**

```typescript
// hooks/useLyricClipboardCapture.ts
import { useCallback, useEffect, useState } from 'react';

interface LyricClipboardBridge {
  arm: (url: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  disarm: () => Promise<{ ok: boolean }>;
  onCaptured: (cb: (payload: { text: string; sourceUrl: string }) => void) => () => void;
}

export interface UseLyricClipboardReturn {
  isSupported: boolean;
  captured: { text: string; sourceUrl: string } | null;
  arm: (url: string) => Promise<boolean>;
  disarm: () => Promise<void>;
  clearCaptured: () => void;
}

function getBridge(): LyricClipboardBridge | null {
  const w = globalThis as unknown as { window?: { electron?: { lyricClipboard?: LyricClipboardBridge } } };
  return w.window?.electron?.lyricClipboard ?? null;
}

export function useLyricClipboardCapture(): UseLyricClipboardReturn {
  const [captured, setCaptured] = useState<{ text: string; sourceUrl: string } | null>(null);
  const bridge = getBridge();
  const isSupported = !!bridge;

  useEffect(() => {
    if (!bridge) return;
    const unsubscribe = bridge.onCaptured((payload) => setCaptured(payload));
    return unsubscribe;
  }, [bridge]);

  const arm = useCallback(async (url: string): Promise<boolean> => {
    if (!bridge) return false;
    const res = await bridge.arm(url);
    return !!res.ok;
  }, [bridge]);

  const disarm = useCallback(async (): Promise<void> => {
    if (!bridge) return;
    await bridge.disarm();
  }, [bridge]);

  const clearCaptured = useCallback(() => setCaptured(null), []);

  return { isSupported, captured, arm, disarm, clearCaptured };
}
```

- [ ] **Step 4: Run test to verify passes**

Run: `npx vitest run hooks/useLyricClipboardCapture.test.tsx`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useLyricClipboardCapture.ts hooks/useLyricClipboardCapture.test.tsx
git commit -m "feat(ai-engine): add renderer hook for lyric clipboard capture"
```

---

### Task 12: WebSearchResultCard component

**Files:**
- Create: `components/ai-modal/WebSearchResultCard.tsx`
- Create: `components/ai-modal/WebSearchResultCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// components/ai-modal/WebSearchResultCard.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WebSearchResultCard } from './WebSearchResultCard';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const results = [
  { title: 'Way Maker — Sinach', url: 'https://naijalyrics.example/way-maker', domain: 'naijalyrics.example', snippet: 'Way maker, miracle worker…' },
  { title: 'Way Maker Lyrics', url: 'https://otherlyrics.example/way-maker', domain: 'otherlyrics.example', snippet: 'Promise keeper, light in the darkness' },
];

describe('WebSearchResultCard', () => {
  it('renders each result with title, domain, snippet', () => {
    act(() => root.render(<WebSearchResultCard results={results} onOpenSource={() => {}} captureStatus="idle" onGenerate={() => {}} />));
    expect(container.textContent).toContain('Way Maker — Sinach');
    expect(container.textContent).toContain('naijalyrics.example');
    expect(container.textContent).toContain('Promise keeper');
  });

  it('invokes onOpenSource with the clicked result url', () => {
    const onOpenSource = vi.fn();
    act(() => root.render(<WebSearchResultCard results={results} onOpenSource={onOpenSource} captureStatus="idle" onGenerate={() => {}} />));
    const btn = container.querySelector('button[data-role="open-source"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    act(() => { btn.click(); });
    expect(onOpenSource).toHaveBeenCalledWith(results[0]);
  });

  it('disables Generate button until captureStatus === "captured"', () => {
    act(() => root.render(<WebSearchResultCard results={results} onOpenSource={() => {}} captureStatus="armed" onGenerate={() => {}} />));
    const generate = container.querySelector('button[data-role="generate"]') as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run components/ai-modal/WebSearchResultCard.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write implementation**

```tsx
// components/ai-modal/WebSearchResultCard.tsx
import React from 'react';
import type { WebSearchResult } from '../../services/lyricSources/types';

export type CaptureStatus = 'idle' | 'armed' | 'captured';

interface WebSearchResultCardProps {
  results: WebSearchResult[];
  captureStatus: CaptureStatus;
  onOpenSource: (result: WebSearchResult) => void;
  onGenerate: () => void;
}

export function WebSearchResultCard({ results, captureStatus, onOpenSource, onGenerate }: WebSearchResultCardProps) {
  if (!results.length) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">Web results — click Open Source, then copy the lyrics; Lumina will detect the paste.</p>
      <ul className="flex flex-col gap-2">
        {results.map((r, i) => (
          <li key={r.url + i} className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-slate-100">{r.title}</span>
              <span className="shrink-0 text-xs text-slate-500">{r.domain}</span>
            </div>
            <p className="text-sm text-slate-300">{r.snippet}</p>
            <div className="mt-1 flex items-center justify-end">
              <button
                type="button"
                data-role="open-source"
                className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500"
                onClick={() => onOpenSource(r)}
              >
                Open Source ↗
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-center justify-between border-t border-slate-800 pt-3">
        <span className="text-xs text-slate-400">
          {captureStatus === 'armed' ? 'Waiting for you to copy lyrics…' :
            captureStatus === 'captured' ? 'Lyrics detected — ready to generate.' :
            'No lyrics captured yet.'}
        </span>
        <button
          type="button"
          data-role="generate"
          disabled={captureStatus !== 'captured'}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onGenerate}
        >
          Generate slides
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify passes**

Run: `npx vitest run components/ai-modal/WebSearchResultCard.test.tsx`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ai-modal/WebSearchResultCard.tsx components/ai-modal/WebSearchResultCard.test.tsx
git commit -m "feat(ai-engine): add WebSearchResultCard for Tier-3 Brave results"
```

---

### Task 13: Wire orchestrator + clipboard capture into `AIModal.tsx`

**Files:**
- Modify: `components/AIModal.tsx`

This task is surgical — only the SEARCH-mode lyrics path changes. All other modes and the existing `handleAISearch()` for non-lyrics are untouched.

- [ ] **Step 1: Add imports at the top of `AIModal.tsx`**

Locate the imports block (line 1–25). Append these imports after existing imports from `./services/*`:

```typescript
import { useLyricSearchOrchestrator } from '../hooks/useLyricSearchOrchestrator';
import { useLyricClipboardCapture } from '../hooks/useLyricClipboardCapture';
import { WebSearchResultCard } from './ai-modal/WebSearchResultCard';
```

- [ ] **Step 2: Invoke orchestrator + clipboard capture inside the component body**

Inside the `AIModal` component body, immediately after the existing `const [aiSearchError, setAiSearchError] = useState(...)` block (near line 260–270), add:

```typescript
const isSearchLyrics = mode === 'SEARCH' && detectedIntent === 'SONG';
const orchestrator = useLyricSearchOrchestrator(isSearchLyrics ? searchQuery.trim() : '');
const clipboardCapture = useLyricClipboardCapture();
const [captureStatus, setCaptureStatus] = useState<'idle' | 'armed' | 'captured'>('idle');

useEffect(() => {
  if (clipboardCapture.captured) setCaptureStatus('captured');
}, [clipboardCapture.captured]);

const handleOpenSource = useCallback(async (result: { url: string }) => {
  const ok = await clipboardCapture.arm(result.url);
  if (ok) setCaptureStatus('armed');
}, [clipboardCapture]);

const handleGenerateFromCaptured = useCallback(async () => {
  if (!clipboardCapture.captured) return;
  setIsProcessing(true);
  setError(null);
  try {
    const slideData = await generateSlidesFromText(clipboardCapture.captured.text);
    if (!slideData) throw new Error('AI returned no slide content.');
    const themeKeyword = await suggestVisualTheme(clipboardCapture.captured.text);
    const bgUrl = `https://picsum.photos/seed/${encodeURIComponent(themeKeyword)}/1920/1080`;
    onGenerate(slideData.slides, bgUrl);
    clipboardCapture.clearCaptured();
    setCaptureStatus('idle');
    onClose();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Failed to generate slides.');
  } finally {
    setIsProcessing(false);
  }
}, [clipboardCapture, onGenerate, onClose]);
```

Note: the variable names `searchQuery`, `mode`, `detectedIntent`, `setIsProcessing`, `setError`, `onGenerate`, `onClose`, `suggestVisualTheme`, `generateSlidesFromText` already exist in the file — re-use them. Confirm with `grep -n "const \[searchQuery" components/AIModal.tsx` before editing.

- [ ] **Step 3: Render orchestrator state in the SEARCH-mode UI**

Locate the SEARCH render block (line 518–600). Find where `aiResult` is rendered and add, immediately above or below it, a conditional render for Tier-2 (LRCLIB) and Tier-3 (Web):

```tsx
{isSearchLyrics && orchestrator.state.kind === 'lrclib' && (
  <div className="rounded-xl border border-emerald-700 bg-emerald-900/30 p-4">
    <p className="text-xs uppercase text-emerald-300">Lyrics via LRCLIB</p>
    <p className="mt-1 text-sm font-medium text-white">{orchestrator.state.hit.trackName} — {orchestrator.state.hit.artistName}</p>
    <button
      type="button"
      disabled={isProcessing}
      className="mt-3 rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
      onClick={async () => {
        if (orchestrator.state.kind !== 'lrclib') return;
        setIsProcessing(true);
        try {
          const slideData = await generateSlidesFromText(orchestrator.state.hit.plainLyrics);
          if (slideData) {
            const bg = `https://picsum.photos/seed/${encodeURIComponent(orchestrator.state.hit.trackName)}/1920/1080`;
            onGenerate(slideData.slides, bg);
            onClose();
          }
        } catch (e: unknown) { setError(e instanceof Error ? e.message : 'AI failed.'); }
        finally { setIsProcessing(false); }
      }}
    >
      Generate slides from LRCLIB lyrics
    </button>
  </div>
)}

{isSearchLyrics && orchestrator.state.kind === 'web' && (
  <WebSearchResultCard
    results={orchestrator.state.results}
    captureStatus={captureStatus}
    onOpenSource={handleOpenSource}
    onGenerate={handleGenerateFromCaptured}
  />
)}
```

Leave the existing `aiResult` render in place — it remains the behaviour when `detectedIntent !== 'SONG'` (sermons, announcements, etc.) and when the orchestrator is `idle`/`catalog` (catalog hit continues to use the existing `searchCatalogHymns` → `handleSelectHymn` path).

- [ ] **Step 4: Compile + manual smoke test**

Run: `npx tsc --noEmit -p . 2>&1 | grep "AIModal" || echo "no AIModal errors"`
Expected: `no AIModal errors`.

Run `npm run dev` in one terminal and `npm run server` in another. Open the app, trigger AI Modal SEARCH mode, type "Way Maker" (a non-catalog song).

Expected visible behaviour with `VITE_AI_WEB_LYRICS_FETCH=false`: empty/"flag-off" state (same as current Gemini refusal).

Set `VITE_AI_WEB_LYRICS_FETCH=true` + `AI_WEB_LYRICS_FETCH=true` in `.env.local` + `BRAVE_SEARCH_API_KEY=<real>`, restart both processes, retry: LRCLIB card or Brave results appear.

- [ ] **Step 5: Commit**

```bash
git add components/AIModal.tsx
git commit -m "feat(ai-engine): wire lyric orchestrator + clipboard capture into AIModal SEARCH"
```

---

### Task 14: End-to-end test

**Files:**
- Create: `tests/e2e/ai-engine-web-search.spec.ts`

- [ ] **Step 1: Write the Playwright spec**

```typescript
// tests/e2e/ai-engine-web-search.spec.ts
import { test, expect } from '@playwright/test';

test.describe('AI Engine — web lyric search (Tier 2 + 3)', () => {
  test.skip(
    !process.env.AI_WEB_LYRICS_FETCH || process.env.AI_WEB_LYRICS_FETCH !== 'true',
    'AI_WEB_LYRICS_FETCH flag must be ON for this E2E',
  );

  test('LRCLIB hit renders the Tier-2 card @ai-engine', async ({ page }) => {
    await page.route('**/api/lyrics/lrclib', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { hit: { id: 1, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'Way maker...\nPromise keeper...\nMy God...\nThat is who you are' } },
        }),
      }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: /AI Engine/i }).click();
    await page.getByPlaceholder(/search/i).fill('Way Maker Sinach');
    await expect(page.getByText(/Lyrics via LRCLIB/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /Generate slides from LRCLIB lyrics/i })).toBeEnabled();
  });

  test('Brave miss surfaces manual-paste hint @ai-engine', async ({ page }) => {
    await page.route('**/api/lyrics/lrclib', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { hit: null } }) }),
    );
    await page.route('**/api/lyrics/web-search', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { results: [] } }) }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: /AI Engine/i }).click();
    await page.getByPlaceholder(/search/i).fill('totally-unknown-song-xyz');
    await expect(page.getByText(/paste/i)).toBeVisible({ timeout: 8000 });
  });
});
```

- [ ] **Step 2: Run the spec (flag ON locally)**

Run: `AI_WEB_LYRICS_FETCH=true npm run test:e2e -- tests/e2e/ai-engine-web-search.spec.ts`
Expected: both tests PASS (or both SKIP if the flag is off).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/ai-engine-web-search.spec.ts
git commit -m "test(ai-engine): add Tier-2/3 E2E spec for web lyric search"
```

---

### Task 15: Security + code review gate

**Files:**
- None changed here unless reviewers flag issues.

- [ ] **Step 1: Run security-reviewer agent**

Prompt the `security-reviewer` agent with: "Review the new `server/routes/lyrics.js`, `electron/clipboardLyricWatcher.js`, `electron/ipc/lyricClipboard.js`, and `services/lyricSources/*` on branch `feature/ai-engine-web-search` for SSRF, secret leakage, clipboard privacy regressions, and input validation gaps. Focus on Brave API-key handling, LRCLIB URL construction, and IPC trust boundaries."

- [ ] **Step 2: Run code-reviewer agent**

Prompt the `code-reviewer` agent with: "Review the same files for readability, TypeScript style (no `any`, no `React.FC`), file-size limits (<800 LOC), and test coverage ≥ 80%."

- [ ] **Step 3: Address CRITICAL and HIGH findings**

For each CRITICAL/HIGH issue, create a fix commit. Use this commit style:

```bash
git add <files>
git commit -m "fix(ai-engine): <short description of security/quality fix>"
```

- [ ] **Step 4: Verify full test suite still green**

Run: `npx vitest run`
Expected: 0 failures. If any pre-existing test broke, fix it or document why in the PR.

Run: `npx tsc --noEmit -p .`
Expected: no type errors.

---

### Task 16: PR preparation

**Files:**
- None changed.

- [ ] **Step 1: Push the branch**

Run: `git push -u origin feature/ai-engine-web-search`
Expected: branch published with all task commits.

- [ ] **Step 2: Open the PR**

Run:
```bash
gh pr create --base dev --title "feat(ai-engine): three-tier lyric web search (LRCLIB + Brave + clipboard)" --body "$(cat <<'EOF'
## Summary
- Closes the Nigerian/African gospel lyrics gap in AI Engine SEARCH tab with a three-tier waterfall (local catalog → LRCLIB → Brave Search + Electron clipboard capture).
- Behind `AI_WEB_LYRICS_FETCH` feature flag, default OFF — safe to merge dark.
- No change to SERMON / ANNOUNCE / SCRIPTURE / LYRICS tab flows.

## Architecture
- New `services/lyricSources/` module (adapters + heuristic + flag)
- New `hooks/useLyricSearchOrchestrator`, `hooks/useLyricClipboardCapture`
- New `server/routes/lyrics.js` (LRCLIB + Brave proxies)
- New `electron/clipboardLyricWatcher.js` + IPC bridge
- `components/AIModal.tsx` wiring scoped to SEARCH + lyrics intent only

## Test plan
- [ ] Unit tests all green: `npx vitest run`
- [ ] Type check clean: `npx tsc --noEmit -p .`
- [ ] E2E green with flag ON: `AI_WEB_LYRICS_FETCH=true npm run test:e2e -- tests/e2e/ai-engine-web-search.spec.ts`
- [ ] Flag-OFF regression check: SEARCH mode for catalog hymn still works; non-catalog query shows existing "paste manually" CTA unchanged
- [ ] Flag-ON soak (dev): 10 popular Nigerian gospel titles, catalog-miss flow reaches LRCLIB/Brave
- [ ] Security review passed (server routes, clipboard watcher, env vars)
- [ ] Code review passed

## Rollout
1. Merge with flag OFF
2. Enable in dev, soak-test
3. Enable in staging, collect hit-rate metrics
4. Enable in prod via env flag

Spec: `docs/superpowers/specs/2026-04-18-ai-engine-web-search-design.md`
EOF
)"
```

- [ ] **Step 3: Verify CI green**

Run: `gh pr checks`
Expected: all required checks passing (or queued). Fix any failures via follow-up commits on the same branch.

---

## Self-Review Notes

The plan covers every numbered subsystem from the spec: Tier 1 catalog (reused), Tier 2 LRCLIB (Tasks 3 + 6), Tier 3 Brave (Tasks 4 + 6), clipboard capture (Tasks 9 + 10 + 11), heuristic (Task 2), feature flag (Tasks 5 + 6 + 7), AIModal wiring (Task 13), E2E (Task 14), security gate (Task 15), rollout (Task 16 PR body). All module names match the spec's Files section with one deviation: `electron/*.ts` → `electron/*.js` (project is ESM and Electron files are `.js`). The `featureFlag.ts` module listed in the spec under "Modified" is implemented new under `services/lyricSources/featureFlag.ts` — same behaviour, co-located with the rest of the lyric-source code.
