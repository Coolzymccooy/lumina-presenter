# Lumina Session Log (2026-02-28)

## Focus
- Refresh landing page messaging to match recently shipped product capabilities.
- Align pricing/feature copy with Audience Studio, stage workflows, and desktop reliability updates.
- Update release download links and version labels to the latest desktop release.

## Completed

### 1) Landing page messaging refresh
- `components/LandingPage.tsx`
  - Updated feature cards to reflect current product direction:
    - Audience Studio
    - Pastor Alerts (admin-to-stage communication)
    - Smart Ticker
    - Multi-Screen Output
    - Desktop Offline Ready
    - Bible + AI Workflow
  - Updated feature section supporting copy for live-service reliability positioning.

### 2) Pricing section update
- `components/LandingPage.tsx`
  - Revised Starter / Pro / Enterprise bullets to better match current workflows and operator needs.
  - Updated pricing section subtitle for clearer growth path messaging.

### 3) Release/version copy alignment
- `components/LandingPage.tsx`
  - Bumped desktop download links from `v2.2.3` to `v2.2.8`:
    - installer `.exe`
    - `.msi`
    - portable `.exe`
  - Updated visible version labels in hero and CTA:
    - badge text
    - hero build label
    - footer CTA “Latest Version”

## Validation
- `npm run build`: PASS

## Git / Release Notes
- Pushed to `master`:
  - `339d8c8` - `Update landing page features/pricing and bump release links to v2.2.8`

---

## Update (2026-03-02)

### Focus
- Harden stage/output safety and remove recurring black/blank presentation risk.
- Ship Stage Timer V2 extensions and persistence improvements across presenter, stage, audience, and server state.
- Add QA release guardrails (checklist + test catalog + CI + smoke regression automation).
- Improve Bible Hub visionary semantic fallback quality (avoid constant John 3:16 fallback).

### Completed (Code + Product)

1. Stage/output reliability and state flow
- Strengthened output/stage fallback behavior and synchronization pathways.
- Continued integration for stage message center, stage layout controls, and run sheet archive workflows.

2. Stage timer web drag/resize behavior
- Updated stage timer interactions in web route to pointer-driven drag/resize for better browser consistency.
- Added test hooks for stable automation selectors on stage timer widget controls.

3. Visionary semantic Bible search quality
- Reworked semantic fallback behavior in client and server AI paths to use context-aware references instead of always returning John 3:16.

4. QA and release automation
- Added release acceptance checklist:
  - `QA_ACCEPTANCE_CHECKLIST.md`
- Added full end-to-end test catalog:
  - `test-cases.csv` (TC-001 to TC-100)
- Added automated smoke tests for critical regressions:
  - `tests/e2e/smoke-critical.spec.ts`
- Added GitHub CI workflow:
  - `.github/workflows/ci.yml`
  - PR -> build + smoke
  - master push -> build + smoke + full e2e
- Added GitHub tag release workflow:
  - `.github/workflows/release.yml`
  - tag `v*` -> verify + build Windows artifacts + publish non-draft release
- Added scripts:
  - `test:e2e:smoke`
  - `dist:win:ci`

### Validation
- `npm run build`: PASS
- `npm run test:e2e:smoke`: PASS
- `npm run test:e2e`: PASS

### Notes
- Morning workset includes desktop/web runtime and QA artifacts, stage/output/timer enhancements, run sheet file/archive work, audience/stage messaging, and media asset additions for background library.
