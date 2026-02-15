# Lumina Session Log (2026-02-15)

## Project
- App: `https://lumina-presenter.vercel.app/`
- Stack: Vite + React + TypeScript + Firebase Auth/Firestore
- Focus: Presenter stability, remote control auth guard, output/stage resilience, motion backgrounds

## What Was Completed This Session

### 1) Merge/Error cleanup and hardening in `App.tsx`
- Resolved merge-conflict fallout and runtime/type issues.
- Added safer sync behavior:
  - queued live-state writes when offline
  - retry flush when connection returns
  - sync warning banner on failures
  - telemetry logging for sync failures
- Added defensive remote command parsing (ignore malformed commands).
- Added development smoke-test hook:
  - `window.luminaSmokeTest()`
  - checks templates, cue bounds, and remote command guard behavior.

### 2) Remote control and auth
- Remote route guard strengthened to require signed-in user and allowlist/owner checks.
- Remote command errors now log telemetry.
- Multi-admin allowlist path supported (via workspace settings email list).

### 3) Output/Stage stabilization
- Output window lifecycle stabilized (reduced blip/reopen behavior).
- Stage display guarded for null/empty values and more stable rendering.
- Timer display now supports overtime:
  - countdown continues below zero
  - negative time shown (e.g. `-00:12`)
  - overtime turns red and pulses in presenter strip + stage display.

### 4) Documentation Hub expansion
- Help modal upgraded to a full docs hub:
  - setup, build, present
  - remote workflow
  - multi-campus session linking
  - output/stage
  - guard rails and troubleshooting

### 5) Login improvements
- Google sign-in button visually improved with Google mark and clearer labels.

### 6) Motion/media reliability
- Replaced fragile default background URLs with built-in gradient defaults (safe and always available).
- Renderer fallback improved:
  - missing media no longer blocks with harsh "asset missing" state
  - soft fallback visual background is shown instead.
- Motion library rebuilt with:
  - `Default Loops`
  - `Safe Stills`
  - `Pexels` integration (`VITE_PEXELS_API_KEY`)
  - `Pixabay` integration (`VITE_PIXABAY_API_KEY`)
- Motion selection now sets both URL and media type.

### 7) Firestore rules hardening
- Session access tightened:
  - owner bootstrap required on create
  - owner can fully update session
  - allowlisted admins restricted to remote command fields only
- Telemetry collection rules added for `user_activity_logs`.

## Production URLs
- Base app: `https://lumina-presenter.vercel.app/`
- Remote (default session): `https://lumina-presenter.vercel.app/remote?session=live`
- Output route (default session): `https://lumina-presenter.vercel.app/output?session=live`

## How Session Linking Works
- `session` query param and presenter `Session ID` point to the same Firestore session document.
- Same session ID across devices = shared live control.
- Different session IDs = isolated campuses/services.

## Machine Mode (Current behavior)
- Machine mode currently hides the right-side live queue panel in presenter view.
- Goal: cleaner operator surface and fewer accidental clicks during service.

## Current Known Limits / Risks
- No formal distributed load test has been executed yet.
- Single-session heavy concurrency can hotspot one Firestore session doc.
- Very large media libraries and many live videos can increase browser memory pressure.
- Bundle size warning remains large; app still builds and runs.

## Verification Results (This Session)
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS

## Immediate Next Phase (Recommended)
1. Deploy Firestore rules.
2. Run production smoke checks on:
   - remote control authorization
   - output + stage toggles
   - overtime timer behavior
3. Add incremental feature batches (not all-at-once) to reduce regression risk.

## Feature Backlog Batches (Safe Rollout Plan)

### Batch 1 (Core Ops)
- Scene Packs
- Confidence monitor notes mode
- Output health preflight checks

### Batch 2 (Collab + Workflow)
- Collaboration locks
- Rehearsal mode with timing analytics
- Multi-language lyric tracks

### Batch 3 (Platform/Scale)
- Stream profile manager
- Usage analytics dashboard
- Song/License import pipeline
- Redundant sync/failover channel

## Resume Notes
- Continue from Batch 1 next session.
- Keep each batch behind feature flags and run:
  - `npx tsc --noEmit`
  - `npm run build`
  - targeted manual smoke tests before merge.
