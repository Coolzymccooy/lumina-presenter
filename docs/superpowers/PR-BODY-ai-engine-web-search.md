## Summary

Implements **Lumina AI Engine V3.0 web-search** — a free-tier three-tier waterfall for fetching lyrics inside the AI modal:

1. **Tier 1 — Local catalog** (sync): existing in-app match.
2. **Tier 2 — LRCLIB** (async): public, key-less lyric DB via server proxy.
3. **Tier 3 — Brave Web Search + Electron clipboard capture**: surfaces top web results; user copies lyrics from a result and a clipboard watcher captures them with a lyric-shape heuristic.

All web-search behaviour is gated behind the `AI_WEB_LYRICS_FETCH` feature flag (server) and `VITE_AI_WEB_LYRICS_FETCH` (client) — **default OFF**, so this PR is shippable dark.

Spec: `docs/superpowers/specs/2026-04-18-ai-engine-web-search-design.md`
Plan: `docs/superpowers/plans/2026-04-18-ai-engine-web-search.md`

## Architecture

- **Server** (`server/routes/lyrics.js`): `POST /api/lyrics/lrclib` and `POST /api/lyrics/web-search`. Brave key stays server-side. Both routes 503 when flag off, validate query length (≤500), and sanitize upstream errors (no raw upstream text leaks to client).
- **Electron main** (`electron/clipboardLyricWatcher.js`, `electron/ipc/lyricClipboard.js`): polling clipboard watcher armed/disarmed via IPC, gated on trusted origin.
- **Renderer hooks**:
  - `useLyricClipboardCapture` — bridges to electron IPC with stable callback refs.
  - `useLyricSearchOrchestrator` — runs the three-tier waterfall with state machine.
- **UI**: `AIModal` SEARCH path now invokes the orchestrator; `WebSearchResultCard` renders Tier-3 hits; clipboard watcher auto-disarms on modal close.
- **Shared types**: `services/lyricSources/types.ts`, plus per-tier adapters and a lyric-shape heuristic.

## Security

- Server-only Brave API key (never shipped to renderer).
- Hardcoded upstream base URLs (no SSRF surface).
- Query length cap (500 chars) on both routes.
- Upstream errors logged via `console.error` server-side; client receives generic error code only.
- Clipboard watcher disarms on timeout AND modal close (privacy guardrail per spec).
- IPC handlers gate on trusted origin.

## Test Plan

- [x] Vitest unit/integration: 46 passing across adapters, hooks, server routes, electron watcher.
- [x] Server route security tests: query-length cap + error-message sanitization on both `/lrclib` and `/web-search`.
- [x] Playwright E2E spec: `tests/e2e/ai-engine-web-search.spec.ts` (Tier-2/3 flow, runs only when flag on).
- [ ] Manual smoke: enable `AI_WEB_LYRICS_FETCH=true` + set `BRAVE_SEARCH_API_KEY`, exercise SEARCH from AI modal, verify clipboard capture flow.
- [ ] Manual smoke (flag OFF): confirm SEARCH falls back to existing catalog-only behaviour.

## Out of Scope / Follow-ups

- **Rate limiting** on `/api/lyrics/*`: no in-process limiter wired (would require new `express-rate-limit` dep + design pass on Brave quota strategy). Tracking as follow-up.
- 9 pre-existing "No test suite found" vitest failures on `dev` (unchanged, not introduced by this PR).
- 1 pre-existing `tsc --noEmit` error in `components/guide-engine/components/GuideSpotlight.tsx` (SVG `transformOrigin` typing — unchanged, not introduced by this PR).

## Env vars added (see `.env.example`)

- `AI_WEB_LYRICS_FETCH` — server flag, default off.
- `VITE_AI_WEB_LYRICS_FETCH` — client mirror, default off.
- `BRAVE_SEARCH_API_KEY` — required only when flag on.
