# Lumina Presenter QA Acceptance Checklist

Use this checklist as the release gate for web + desktop builds.

## Release Gate Rules

1. P0 tests: 100% must pass.
2. P1 tests: 100% must pass (or explicit, documented waiver).
3. P2 tests: at least 95% pass; remaining failures require backlog tickets.
4. No known black/blank screen defect in `Launch Output` or `Stage`.
5. Installer and download links must be publicly accessible before release announcement.

## Priority Definitions

- P0: Service-breaking, data-loss, security, install/launch blockers.
- P1: Core workflow correctness and persistence.
- P2: UX polish and non-blocking edge cases.

## Environment Matrix (Minimum)

1. Web (Chromium): latest stable.
2. Desktop (Windows): current target version.
3. Dual monitor setup: at least one run.
4. Online + degraded/offline simulation.

## Acceptance Criteria

### A. Install, Startup, Release Distribution

- [ ] Installer downloads from website/release page without 404.
- [ ] Installer completes and app launches.
- [ ] App startup shows usable UI (not blank).
- [ ] Auto-update check is functional for desktop channel.
- [ ] Release notes and assets match published version.

### B. Authentication and Settings Durability

- [ ] Sign-in works and session is stable.
- [ ] Remote admin allowlist persists after refresh/relogin/restart.
- [ ] Studio preferences persist after refresh/relogin/restart.
- [ ] Snapshot saves do not overwrite newer settings.
- [ ] Unauthorized users are blocked from admin-only actions.

### C. Build and Present Workflow

- [ ] Build and Present mode toggle does not hide/break core panes.
- [ ] Run sheet item creation/edit/reorder remains stable.
- [ ] Slide next/prev and projection actions are deterministic.
- [ ] Bottom control bar remains reachable (scroll cue present when overflowed).
- [ ] OBS URL and Stage URL controls are discoverable.

### D. Output and Stage Safety

- [ ] `Launch Output` never opens to unexplained black/blank state.
- [ ] `Stage` route never opens to unexplained black/blank state.
- [ ] No-active-slide path renders explicit waiting state.
- [ ] Blackout behavior is explicit and reversible.
- [ ] Rollback works and does not desync state.

### E. Timer Engine and Stage Widget

- [ ] Countdown and elapsed modes both work.
- [ ] Overtime (negative countdown) continues when expected.
- [ ] Timer drag works in web and desktop.
- [ ] Timer drag works on second monitor.
- [ ] Timer resize works manually.
- [ ] Timer text auto-fits and does not overflow container.
- [ ] Stage timer overlay does not obstruct key stage content by default.

### F. Speaker Presets and Cues

- [ ] Preset create/edit/delete/apply works.
- [ ] Per-item timer cue values update correctly from preset.
- [ ] Auto-next cue transitions respect item settings.
- [ ] Present-mode cue controls remain visible and functional.

### G. Audience and Stage Messaging

- [ ] Allowlisted admin status indicator is visible and accurate.
- [ ] Pastor/Stage alerts remain stage-only.
- [ ] Audience ticker/pinned behavior works as configured.
- [ ] Queue, promote, clear, remove actions work without stale UI.

### H. Bible Hub and Visionary Search

- [ ] Structured scripture search returns correct references.
- [ ] Visionary search does not always return John 3:16.
- [ ] Visionary fallback is context-aware on AI/API failure.
- [ ] Version selector applies correctly to returned verses.

### I. Run Sheet Files Archive

- [ ] Archive current works with API online.
- [ ] Archive + New works and preserves archived copy.
- [ ] Reuse/duplicate/rename/delete are stable.
- [ ] Offline fallback message is explicit and accurate.
- [ ] Archived files persist across relogin.

### J. Sync and Presence

- [ ] Live connections numerator/denominator are accurate.
- [ ] Heartbeat TTL expiry updates counts correctly.
- [ ] Multi-client slide/timer/alert updates remain in sync.

### K. Security and Key Handling

- [ ] No private server secrets exposed in frontend bundle.
- [ ] Client-side keys are restricted/scoped as required.
- [ ] API endpoints enforce auth and role checks.

## Smoke Test (10-Minute Pre-Release)

1. Install/launch app.
2. Sign in and confirm session id appears.
3. Launch Output and Stage from presenter.
4. Project 3 slides, advance next/prev.
5. Start timer, run to overtime, pause/reset.
6. Drag + resize timer on stage view.
7. Send stage-only alert and verify it is not on projector.
8. Visionary search with `peace and comfort` and confirm non-constant result.
9. Archive a run sheet and immediately reuse it.
10. Confirm release download links open correctly.

## Full Regression Execution

1. Execute all tests in `test-cases.csv`.
2. Record each as `PASS`, `FAIL`, or `BLOCKED`.
3. Attach evidence for all failed P0/P1 tests.
4. Release decision:
   - `GO` only if all P0 and P1 pass.
   - otherwise `NO-GO`.

## Automation Commands

1. Install browser dependency once: `npm run test:e2e:install`
2. Smoke gate: `npm run test:e2e:smoke`
3. Full regression gate: `npm run test:e2e`
4. Production build check: `npm run build`

CI mappings:

1. Pull requests to `master`: build + smoke.
2. Push to `master`: build + smoke + full E2E.
3. Tag `v*`: verify job then Windows desktop release publish (non-draft).
