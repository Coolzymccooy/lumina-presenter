# Tools Menu — E2E Test Plan & Impact Matrix

**Branch:** `dev` (commit `f12abe6` onward)
**Scope:** Verifies PR1 (overlays + test patterns + menu scaffold) and prepares the regression surface for PR2 (freeze frame + perf HUD) and the NDI-in-Tools refactor.

This document is the manual and automated test plan the church operator / QA should execute before shipping a Lumina Presenter build that includes the Tools menu. Each scenario lists **steps**, **expected result**, and **impact** (what could regress if this breaks).

---

## 0. Pre-flight

Run before every test session.

| # | Step | Expected |
|---|------|----------|
| 0.1 | Launch packaged app `Lumina Presenter.exe` (not `electron:dev`) | Splash, then Studio view loads within 10s |
| 0.2 | `%APPDATA%/Lumina Presenter/tools-settings.json` does not exist on first run | File is absent — defaults apply |
| 0.3 | DevTools closed in production build | No F12 / Ctrl+Shift+I response |
| 0.4 | Log in with valid Firebase credentials | Session + Live Queue render |
| 0.5 | Open Presenter tab, load a rundown with ≥ 1 renderable slide | Program output shows slide in Preview |

---

## 1. Menu scaffold

### 1.1 Tools menu visibility
- **Steps:** Menu bar → click `Tools`
- **Expected:** Four items: `Overlays ▸`, `Aspect Markers ▸`, `Test Patterns ▸`, separator, `Diagnostics ▸`. No stray items.
- **Impact if broken:** Native menu install (`installApplicationMenu`) race with `installToolsIpcHandlers`. Likely cause: `toolsStore` is null when the menu is first built.

### 1.2 Menu does not appear on web build
- **Steps:** Open `https://<coolify-url>/` in a browser (Chrome). Look for Tools menu.
- **Expected:** No Tools menu exists. Page renders normally. `window.electron.tools` is `undefined` in the browser console.
- **Impact if broken:** Preload bridge leaked into web build; likely a Vite / build-target regression.

### 1.3 First launch applies defaults
- **Steps:** Delete `tools-settings.json`, launch app, open Tools.
- **Expected:** All overlays unchecked. Aspect Markers → `Off` selected. Test Patterns → `Off` selected.
- **Impact if broken:** `sanitizeToolsSettings` regression — could silently corrupt state across restarts.

---

## 2. Overlays submenu

### 2.1 Safe Areas toggle
- **Steps:** Open Audience output on a secondary display → Tools → Overlays → click `Safe Areas`
- **Expected:** Audience output shows amber 95% (action-safe) + white dashed 90% (title-safe) rectangles. Clicking again clears them.
- **Impact if broken:** SVG overlay layer broken; may also indicate CSS z-index conflict with `SlideRenderer`.

### 2.2 Center Cross toggle
- **Steps:** Tools → Overlays → click `Center Cross`
- **Expected:** Crosshair with small circle at geometric center of Audience output.
- **Impact if broken:** Operators cannot align camera feeds pre-service.

### 2.3 Combined overlays
- **Steps:** Enable both Safe Areas and Center Cross
- **Expected:** Both render simultaneously, no visual clash.
- **Impact if broken:** `ToolsOverlay` composer regression — one overlay may be clobbering the other's SVG namespace.

### 2.4 NDI mirror
- **Steps:** Start NDI output → enable Safe Areas → inspect NDI feed in NDI Studio Monitor or vMix
- **Expected:** Overlay appears on NDI Lumina-Program feed (same source as Audience output).
- **Impact if broken:** If overlays show in Audience but not NDI, there is an output-window divergence that would also affect test patterns.

### 2.5 Preview pane behavior
- **Steps:** Look at the Presenter's preview pane after enabling overlays
- **Expected:** Preview does NOT show overlays (by design — overlays are for the audience-facing output). Confirm with the user this is the intended split.
- **Impact if broken:** If preview shows overlays, the operator can't see what the audience actually sees. *(Known: this is the current behavior per PR1 scope.)*

---

## 3. Aspect Markers submenu

### 3.1 4:3 pillarbox on 16:9 Audience
- **Steps:** Tools → Aspect Markers → `4:3`
- **Expected:** Dark 75%-opacity bars on left and right, each 12.5% of screen width. Thin white boundary line between bar and visible area.
- **Impact if broken:** Broadcast framing for SD / 4:3 streams invisible; operators may crop graphics incorrectly.

### 3.2 16:9 on 16:9 — no bars
- **Steps:** Select `16:9`
- **Expected:** No visible darkening. The marker is a no-op because container and target match.
- **Impact if broken:** Arithmetic regression in `aspectToRatio`. Test covers this: see `components/overlays/AspectMarkers.test.tsx:36`.

### 3.3 1:1 square
- **Steps:** Select `1:1 (Square)`
- **Expected:** Larger pillarbox than 4:3 (each bar ~21.875% on 16:9).
- **Impact if broken:** Social-media cropping guide unusable.

### 3.4 Off
- **Steps:** Select `Off`
- **Expected:** All aspect masking cleared.

### 3.5 Radio behavior
- **Steps:** Click each option in sequence
- **Expected:** Only one radio is checked at a time; selection persists until changed.
- **Impact if broken:** Electron native radio group regression — check `type: 'radio'` in `toolsMenu.cjs`.

---

## 4. Test Patterns submenu

### 4.1 SMPTE Color Bars
- **Steps:** Tools → Test Patterns → `SMPTE Color Bars`
- **Expected:** 7 vertical bars (white, yellow, cyan, green, magenta, red, blue) top 2/3. Reversed blue-channel mid band. PLUGE row at bottom. Program content is hidden.
- **Impact if broken:** Operators cannot confirm signal integrity to projectors / streaming encoders.

### 4.2 PLUGE
- **Steps:** Select `PLUGE`
- **Expected:** Black + sub-black (–4%) + super-black (+4%) patches. Used to set display black level.
- **Impact if broken:** Cannot calibrate projector black level pre-service.

### 4.3 Solid Black / White
- **Steps:** Select `Solid Black`, then `Solid White`
- **Expected:** Full-frame black, then full-frame white. No leakage of program content.
- **Impact if broken:** Screen burn-in testing impossible.

### 4.4 Grayscale Gradient
- **Steps:** Select `Grayscale Gradient`
- **Expected:** Smooth horizontal black-to-white gradient.
- **Impact if broken:** Projector gamma calibration blocked.

### 4.5 Checkerboard
- **Steps:** Select `Checkerboard`
- **Expected:** 16×9 (144 cell) checker. Each cell square on a 16:9 display.
- **Impact if broken:** Sharpness / alignment calibration blocked.

### 4.6 Off
- **Steps:** Select `Off`
- **Expected:** Test pattern clears. Program content re-appears within 1 frame (no black flash).
- **Impact if broken:** Cannot return to live content mid-service → service interruption.

### 4.7 Layering with overlays
- **Steps:** Enable SMPTE Color Bars AND Safe Areas simultaneously
- **Expected:** Safe-area rectangles render ON TOP of SMPTE bars (alignment overlays stay visible for calibration).
- **Impact if broken:** z-index regression (`TestPatterns` z-60 vs `ToolsOverlay` z-80). Covered by unit test but manually verify.

### 4.8 Audio during test pattern
- **Steps:** With a video slide playing (audio flowing), select `Solid Black`
- **Expected:** Audio continues uninterrupted (test patterns are video-only overlays). NDI audio embedding (if active) continues streaming.
- **Impact if broken:** `TestPatterns` regression accidentally unmounted the `<video>` element — major interruption during live service.

### 4.9 NDI mirror during test patterns
- **Steps:** Start NDI → activate test pattern → inspect NDI feed
- **Expected:** Pattern appears on NDI output.
- **Impact if broken:** Streaming encoder or downstream vMix doesn't see the alignment signal.

---

## 5. Persistence

### 5.1 State survives app restart
- **Steps:** Enable Safe Areas + Aspect `4:3` → quit app → relaunch
- **Expected:** On relaunch the menu reflects Safe Areas ✓, Aspect Markers → 4:3 ●. Overlays visible on Audience output.
- **Impact if broken:** Operator settings lost between services — `toolsSettingsStore` read/write regression.

### 5.2 State is machine-local, not workspace-synced
- **Steps:** Configure Safe Areas on Machine A. Log into same workspace on Machine B.
- **Expected:** Machine B does NOT have Safe Areas enabled. Tools settings are per-machine by design.
- **Impact if broken:** Operator settings cross-contaminate between machines (e.g., overlay shows on Sunday service because developer left it on Monday).

### 5.3 Corrupt settings file does not crash
- **Steps:** Quit app → manually corrupt `tools-settings.json` (`{not json` will do) → relaunch.
- **Expected:** App starts normally with defaults. `tools-settings.json` is NOT overwritten until a setting changes.
- **Impact if broken:** One bad write can soft-brick the Tools menu. Covered by unit test.

---

## 6. IPC / bridge hygiene

### 6.1 `window.electron.tools` shape
- **Steps:** DevTools (`LUMINA_OPEN_DEVTOOLS=1`) → console: `Object.keys(window.electron.tools)`
- **Expected:** `['getSettings', 'setSettings', 'onState']`
- **Impact if broken:** Renderer hook silent failure.

### 6.2 Commands round-trip
- **Steps:** Console: `await window.electron.tools.setSettings({ aspect: '4:3' })`
- **Expected:** Returns `{ overlays: {...}, aspect: '4:3', testPattern: 'off' }`. Menu updates. Overlay visible.
- **Impact if broken:** Menu → store → renderer feedback loop broken.

### 6.3 No leaked handlers on window close
- **Steps:** Open Audience window → close it → reopen → toggle overlays
- **Expected:** Overlays work in the new window. No duplicate event listeners (`ipcRenderer._events.tools:state` count ≤ 1 per mount).
- **Impact if broken:** Memory leak over a long service day.

---

## 7. Regressions to watch (NON-Tools areas)

Touching the Tools menu should NOT affect these. If they break, the Tools menu commit has a bad hunk.

| # | Area | Quick check |
|---|------|-------------|
| 7.1 | NDI Start / Stop | Click NDI button → sources go `LIVE`. Click again → `OFF`. |
| 7.2 | Audience mute / unmute | Mute button (🔇) cuts audio on Audience + NDI. |
| 7.3 | Slide advance | `NEXT` advances. `←` goes back. Keyboard arrows still work. |
| 7.4 | Blackout | `BLACKOUT` covers Audience in solid black. Tools overlays hidden during blackout (or layered on top — verify design intent). |
| 7.5 | Hold screens | Clear / Logo hold screens render without overlays showing through. |
| 7.6 | Lower thirds | Lower-thirds Fill+Key feed unaffected. |
| 7.7 | Firebase auth / session sync | Logout / re-login works. Session state syncs across devices. |
| 7.8 | Lyric clipboard capture | URL capture arm / disarm works. |
| 7.9 | App updater | Help → Lumina Releases opens browser. |
| 7.10 | Keyboard shortcuts | F11 fullscreen, Ctrl+R reload (dev), etc. |

---

## 8. Automated coverage (vitest)

Current footprint:

| File | Tests | What it covers |
|------|-------|----------------|
| `electron/toolsSettingsStore.test.js` | 12 | Sanitizer coercion, read/write round-trip, corrupt-file recovery |
| `electron/toolsMenu.test.js` | 9 | Menu template shape, checkbox state, radio exclusivity, click dispatch |
| `hooks/useToolsMenu.test.tsx` | 6 | Hydration, setter round-trip, state sync, web-build fallback |
| `components/overlays/ToolsOverlay.test.tsx` | 5 | Composer layering + no-op when disabled |
| `components/overlays/AspectMarkers.test.tsx` | 5 | Letterbox / pillarbox arithmetic |
| `components/overlays/TestPatterns.test.tsx` | 10 | Each pattern renders with correct structure, pointer-events, checker grid |

**Run:** `npx vitest run electron/toolsMenu.test.js electron/toolsSettingsStore.test.js hooks/useToolsMenu.test.tsx components/overlays/`

**Target:** All 47 must pass. Any failure blocks ship.

---

## 9. Missing (to add)

These scenarios are NOT yet covered by automation and should be added to the Playwright suite in `tests/e2e/`:

- `toolsMenu.spec.ts` — E2E driving a real Electron window: open app, click menu, verify DOM.
- `toolsMenu.persistence.spec.ts` — Launch → toggle → close → relaunch → verify.
- `toolsMenu.ndiMirror.spec.ts` — Start NDI, verify overlay appears in NDI frame (requires NDI Receive Monitor or a headless NDI client; may be infeasible in CI).

---

## 10. Release sign-off checklist

Before shipping a build that includes the Tools menu, all of the following must be true:

- [ ] §0 pre-flight passes on a packaged build (not `electron:dev`)
- [ ] §1 menu appears with exact 4 submenus
- [ ] §2 every overlay toggles on/off cleanly on Audience output
- [ ] §3 every aspect marker renders correct letterbox / pillarbox
- [ ] §4 every test pattern renders and clears without black flash
- [ ] §4.7 z-layering correct — overlays above test patterns
- [ ] §4.8 audio uninterrupted during test pattern activation
- [ ] §5.1 persistence across restart verified
- [ ] §5.2 machine-local scope verified (2-machine test)
- [ ] §7 all regression rows green
- [ ] §8 47/47 vitest cases green
- [ ] No new TypeScript errors in `npx tsc --noEmit` (only the 3 pre-existing in `App.tsx:9462`, `GuideSpotlight.tsx:104`, `tavilyAdapter.ts:34` permitted)
