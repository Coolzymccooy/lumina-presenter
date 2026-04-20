# Bible Hub — Space & Visibility Fixes (Design)

**Date:** 2026-04-20
**Scope:** Bible Hub panel layout + Engine status bug
**Out of scope (deferred to separate spec):** Sermon-recording → Audio Mixer tab integration

---

## 1. Problem Statement

The Bible Hub panel has become visually crowded. In particular:

1. **Engine status displays "Disabled" even when Auto Visionary is ON.** This is a reactive-state bug, not a UX choice.
2. **Audio Source, Capture Mode, and Speech Dialect** consume a large portion of the controls region, leaving little vertical room for generated scriptures.
3. **Slide Style & Preview** gets cropped when Visionary is ON, and expanding it hides the scripture list.
4. Users need scriptures to be reliably visible *before* sending them to the slide renderer — the draft preview exists deliberately to reduce slide-render surprises, so it must remain visible/obvious but not dominate.

**Non-goal:** no changes to transcription pipelines, cloud listener behaviour, Stage-tab sermon recorder, or any existing feature logic. This is layout-only plus a targeted reactive-deps fix.

---

## 2. Goals

- Free vertical space so generated scriptures are visible whenever the user is using Bible Hub.
- Fix the Engine status to accurately reflect the active transcription engine when Auto Visionary is ON.
- Preserve all existing features: listening, auto-project, draft preview, slide style presets, Stage-tab sermon recorder.
- Keep the draft-preview feature discoverable (visible by default) while allowing users to collapse it.

---

## 3. Design

### 3.1 Controls restructure

Replace the single outer `CollapsiblePanel` titled "Auto Listening" (currently [BibleBrowser.tsx:1931-2063](../../../components/BibleBrowser.tsx#L1931-L2063)) with:

**Compact header row (always visible):**
```
[ Auto Visionary (Mic) ] [ Auto Project ]
```
Toggles stay inline, single row, small.

**Four sibling regions in the top controls area:**

| Region              | Panel ID              | Default   | Notes                                |
|---------------------|-----------------------|-----------|--------------------------------------|
| Audio Source        | `bible-audio-source`  | Collapsed | Houses `<SourcePicker />`            |
| Capture Mode        | `bible-capture-mode`  | Collapsed | Houses `<CaptureModePicker />`       |
| Speech Dialect      | `bible-speech-dialect`| Collapsed | Houses dialect selector + status     |
| Engine status       | *(not a panel)*       | Inline    | One-line readout, hidden when off    |

All three collapsibles use the existing `CollapsiblePanel` component. Persistence keys are namespaced (`lumina.panel.bible-audio-source`, etc.) so user preferences survive upgrades.

The `<BibleAutoCurrentSetup />` component stays visible inline above the three collapsibles — it's a compact one-liner and functions as at-a-glance context.

### 3.2 Engine status fix

Two issues in [BibleBrowser.tsx:1586-1611](../../../components/BibleBrowser.tsx#L1586-L1611):

**Bug:** The second `useEffect` selects the engine based on `isOnline`, but reads `autoEnabledRef.current` (a ref). Its dependency array is `[isOnline, listenerLocale, showEngineToast, stopAllVisionaryCapture, transcriptionEngine]`. When the user toggles Auto Visionary ON, none of those deps change, so the effect never fires — `transcriptionEngine` stays at `'disabled'`.

**Fix A (state deps):** Add `autoVisionaryEnabled` and `isVisionaryMode` to the second effect's deps so it re-runs on toggle. When the effect sees `!autoEnabledRef.current`, it returns early; when it sees enabled + a stale `'disabled'` state, it sets `cloud` or `browser_stt` accordingly.

**Fix B (display rule):** Render the Engine row conditionally:
- `autoVisionaryEnabled && isVisionaryMode === false` → Engine row **not rendered**.
- `autoVisionaryEnabled && isVisionaryMode === true` → Engine row shows `Cloud` / `Offline (Browser STT)` / `Cloud Fallback`. The `'disabled'` branch of the `engineLabel` ternary becomes unreachable in rendered UI.

### 3.3 Scripture ↔ Slide Style coexistence

Current behaviour ([BibleBrowser.tsx:1876-1878](../../../components/BibleBrowser.tsx#L1876-L1878)):
```ts
const controlsClassName = compact
  ? 'shrink-0 px-2.5 py-2 space-y-2 border-b border-zinc-900/80 bg-zinc-950/95 overflow-y-auto custom-scrollbar max-h-[60%]'
  : 'p-3 space-y-2';
```

The `max-h-[60%]` cap squeezes both the scripture results and the Slide Style footer when the Auto Listening panel is expanded.

**Changes:**

1. **Remove `max-h-[60%]`** from the compact controls wrapper. Because the four sub-sections are now collapsed by default, the natural height is small — a hard cap is no longer necessary.
2. **Scripture results list** receives `flex-1 min-h-0 overflow-y-auto`. It owns the remaining vertical space.
3. **Slide Style & Preview footer** ([BibleBrowser.tsx:2339-2445](../../../components/BibleBrowser.tsx#L2339-L2445)):
   - Change `defaultCollapsed={true}` → `defaultCollapsed={false}` so users see the feature exists.
   - Tighten internal compact-mode paddings and row heights (~25% reduction) to minimise vertical footprint without hiding functionality.
   - Keep the rendering guard `results.length > 0` unchanged.

Net effect: when the user opens Bible Hub, they see:
- Tiny toggle row (Auto Visionary / Auto Project)
- Current setup one-liner
- Three collapsed sub-panels (one line each)
- Engine status (one line, only if Visionary is on)
- **Large scripture results area**
- Slide Style & Preview (expanded but compact)

### 3.4 Regression guardrails

| Risk                                      | Mitigation                                                                              |
|-------------------------------------------|------------------------------------------------------------------------------------------|
| Breaks Bible Hub listening pipeline       | No changes to `startCloudListener`, `stopCloudListener`, `startBrowserStt`, MediaRecorder refs, refs, or capture effects. Layout-only. |
| Breaks Stage-tab sermon recorder          | Stage recorder lives in a separate component tree. Not touched.                          |
| Breaks auto-project on scripture detect   | `autoProjectRef` and `onProjectRequest` paths untouched.                                 |
| Loses user panel-collapse preferences     | New panel IDs introduced (`bible-audio-source`, `bible-capture-mode`, `bible-speech-dialect`). The retired `bible-auto-visionary` key is orphaned in localStorage with no runtime impact; no migration required. |
| Engine toast duplicates                   | `showEngineToast` guard on `transcriptionEngine === nextEngine` stays in place.          |
| Slide Style preview too visible           | `compact` mode tightens paddings; user can still collapse the panel.                     |

---

## 4. File Changes Summary

Expected changes are confined to:

- [components/BibleBrowser.tsx](../../../components/BibleBrowser.tsx) — JSX restructure (controls region), effect dep update (~2 lines), conditional Engine row rendering, `defaultCollapsed` flip on slide style panel, remove `max-h-[60%]`.

No new files. No changes to `AudioLibrary.tsx`, `App.tsx`, Stage components, or electron IPC.

---

## 5. Testing

- **Manual regression pass** on Bible Hub:
  - Toggle Auto Visionary on/off → Engine row appears/disappears and shows correct label (Cloud when online, Offline when offline).
  - Expand each of the three new collapsibles → contents render, persistence survives reload.
  - Speak into the mic with Auto Visionary on → scriptures appear in the results area; auto-project fires as before.
  - Expand Slide Style footer → scriptures remain visible (scroll if needed).
  - Collapse Slide Style footer → more vertical space for scriptures.
- **Manual regression pass** on Stage tab:
  - Start sermon recording → stop → transcription completes normally. No interference.
- **No unit test changes required** (layout-only + reactive deps fix).
- Spec 2 (sermon recording → Audio Mixer tab) will own its own test plan.

---

## 6. Deferred to Spec 2

- Save finished sermon recordings (both from Bible Hub and Stage tab) to a new "Sermon Recordings" tab under the Audio Mixer.
- Requires: tab system in [AudioLibrary.tsx](../../../components/AudioLibrary.tsx), persistence layer for recorded blobs, playback UI for recorded audio, metadata (date, title, duration).
