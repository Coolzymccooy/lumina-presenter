# Bible Hub Space & Visibility Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Engine "Disabled" reactive-state bug and restructure Bible Hub controls so generated scriptures are always visible, without breaking Visionary listening or the Stage-tab sermon recorder.

**Architecture:** Extract engine-selection logic into a pure function (enables a real TDD unit test and removes the ref-vs-deps reactive bug). Flatten the single "Auto Listening" collapsible into a compact toggle row plus three sibling collapsibles (Audio Source, Capture Mode, Speech Dialect), collapsed by default. Inline Engine status (hidden when Auto Visionary is off). Remove the `max-h-[60%]` cap on the controls wrapper so scriptures own remaining vertical space. Flip Slide Style panel to `defaultCollapsed=false` with tighter compact paddings.

**Tech Stack:** React 18 + TypeScript, Vitest + jsdom, existing `CollapsiblePanel` component, `react-dom/client` + `act` for hook/unit tests (no `@testing-library/react` in the repo — use raw render harness like [hooks/useCloudListener.test.tsx](../../../hooks/useCloudListener.test.tsx)).

**Spec:** [docs/superpowers/specs/2026-04-20-bible-hub-space-visibility-design.md](../specs/2026-04-20-bible-hub-space-visibility-design.md)

---

## File Structure

- **Create:** `utils/transcriptionEngine.ts` — pure resolver for which engine should be active.
- **Create:** `utils/transcriptionEngine.test.ts` — unit tests for the resolver.
- **Modify:** `components/BibleBrowser.tsx` — replace inline engine logic, restructure Auto Listening JSX, flip Slide Style default, remove `max-h-[60%]`.

No other files touched. No changes to `AudioLibrary.tsx`, `App.tsx`, Stage components, or Electron IPC.

---

## Task 1: Pure engine resolver (with unit tests)

**Files:**
- Create: `utils/transcriptionEngine.ts`
- Test: `utils/transcriptionEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `utils/transcriptionEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveTranscriptionEngine } from './transcriptionEngine';

describe('resolveTranscriptionEngine', () => {
  it('returns "disabled" when auto visionary is off', () => {
    expect(resolveTranscriptionEngine({ autoEnabled: false, isOnline: true })).toBe('disabled');
    expect(resolveTranscriptionEngine({ autoEnabled: false, isOnline: false })).toBe('disabled');
  });

  it('returns "cloud" when enabled and online', () => {
    expect(resolveTranscriptionEngine({ autoEnabled: true, isOnline: true })).toBe('cloud');
  });

  it('returns "browser_stt" when enabled and offline', () => {
    expect(resolveTranscriptionEngine({ autoEnabled: true, isOnline: false })).toBe('browser_stt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run utils/transcriptionEngine.test.ts`
Expected: FAIL — `Cannot find module './transcriptionEngine'`.

- [ ] **Step 3: Write the minimal implementation**

Create `utils/transcriptionEngine.ts`:

```typescript
export type TranscriptionEngineMode = 'browser_stt' | 'cloud' | 'cloud_fallback' | 'disabled';

export interface ResolveTranscriptionEngineInput {
  autoEnabled: boolean;
  isOnline: boolean;
}

export function resolveTranscriptionEngine({
  autoEnabled,
  isOnline,
}: ResolveTranscriptionEngineInput): TranscriptionEngineMode {
  if (!autoEnabled) return 'disabled';
  return isOnline ? 'cloud' : 'browser_stt';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run utils/transcriptionEngine.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add utils/transcriptionEngine.ts utils/transcriptionEngine.test.ts
git commit -m "feat(bible-hub): extract pure transcription engine resolver"
```

---

## Task 2: Wire resolver into BibleBrowser and fix the reactive deps bug

**Files:**
- Modify: `components/BibleBrowser.tsx:1586-1611` (both engine-related effects)

- [ ] **Step 1: Find the existing `TranscriptionEngineMode` import or type declaration in `components/BibleBrowser.tsx`**

Run: `grep -n "TranscriptionEngineMode" components/BibleBrowser.tsx`

If a local type alias exists, replace it with an import from `utils/transcriptionEngine`. If it's imported from elsewhere, leave the existing import and add the resolver import.

- [ ] **Step 2: Add the import**

At the top of `components/BibleBrowser.tsx`, alongside other `utils/` imports, add:

```typescript
import { resolveTranscriptionEngine } from '../utils/transcriptionEngine';
```

If the existing `TranscriptionEngineMode` type was declared locally, replace its declaration with:

```typescript
import { resolveTranscriptionEngine, type TranscriptionEngineMode } from '../utils/transcriptionEngine';
```

- [ ] **Step 3: Rewrite the two engine-resolution effects**

Locate [components/BibleBrowser.tsx:1586-1611](../../../components/BibleBrowser.tsx#L1586-L1611). The current code is:

```typescript
useEffect(() => {
  const enabled = autoVisionaryEnabled && isVisionaryMode;
  autoEnabledRef.current = enabled;
  if (!enabled) {
    setTranscriptionEngine('disabled');
    setCloudCooldownUntil(0);
    setAutoError(null);
    stopAllVisionaryCapture();
    return;
  }
  setAutoSupportError(null);
}, [autoVisionaryEnabled, isVisionaryMode, stopAllVisionaryCapture]);

useEffect(() => {
  if (!autoEnabledRef.current) return;
  const nextEngine: TranscriptionEngineMode = isOnline ? 'cloud' : 'browser_stt';
  if (transcriptionEngine === nextEngine) return;
  stopAllVisionaryCapture();
  setCloudCooldownUntil(0);
  setAutoError(null);
  setTranscriptionEngine(nextEngine);
  setActiveSpeechLanguage(listenerLocale);
  showEngineToast(nextEngine === 'cloud'
    ? 'Listening with cloud transcription.'
    : 'Offline mode: using browser speech recognition.');
}, [isOnline, listenerLocale, showEngineToast, stopAllVisionaryCapture, transcriptionEngine]);
```

Replace the entire block above with:

```typescript
useEffect(() => {
  const enabled = autoVisionaryEnabled && isVisionaryMode;
  autoEnabledRef.current = enabled;
  if (!enabled) {
    setTranscriptionEngine('disabled');
    setCloudCooldownUntil(0);
    setAutoError(null);
    stopAllVisionaryCapture();
    return;
  }
  setAutoSupportError(null);
}, [autoVisionaryEnabled, isVisionaryMode, stopAllVisionaryCapture]);

useEffect(() => {
  const enabled = autoVisionaryEnabled && isVisionaryMode;
  if (!enabled) return;
  const nextEngine = resolveTranscriptionEngine({ autoEnabled: enabled, isOnline });
  if (transcriptionEngine === nextEngine) return;
  stopAllVisionaryCapture();
  setCloudCooldownUntil(0);
  setAutoError(null);
  setTranscriptionEngine(nextEngine);
  setActiveSpeechLanguage(listenerLocale);
  showEngineToast(nextEngine === 'cloud'
    ? 'Listening with cloud transcription.'
    : 'Offline mode: using browser speech recognition.');
}, [
  autoVisionaryEnabled,
  isVisionaryMode,
  isOnline,
  listenerLocale,
  showEngineToast,
  stopAllVisionaryCapture,
  transcriptionEngine,
]);
```

Key changes:
- Added `autoVisionaryEnabled` and `isVisionaryMode` to the second effect's dep array. This is the bug fix — previously the effect never re-ran on toggle ON because only a ref tracked the enabled state.
- Replaced the inline ternary with `resolveTranscriptionEngine(...)` for symmetry with the unit test.
- Read `autoVisionaryEnabled && isVisionaryMode` directly from state instead of the ref, since both are now in deps.

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced. If `TranscriptionEngineMode` import clashes with a local declaration, remove the local one.

- [ ] **Step 5: Run the existing Bible-related tests and the new resolver test**

Run: `npx vitest run utils/transcriptionEngine.test.ts hooks/useCloudListener.test.tsx`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/BibleBrowser.tsx
git commit -m "fix(bible-hub): engine stays 'Disabled' when Auto Visionary is toggled on"
```

---

## Task 3: Hide Engine row when Auto Visionary is off

**Files:**
- Modify: `components/BibleBrowser.tsx:2005-2010` (Engine row JSX)

- [ ] **Step 1: Locate the Engine row**

Current JSX at [components/BibleBrowser.tsx:2005-2010](../../../components/BibleBrowser.tsx#L2005-L2010):

```tsx
<div className="flex items-center gap-2 text-[9px] font-mono">
  <span className="text-zinc-400">Engine:</span>
  <span className={`font-bold ${transcriptionEngine === 'browser_stt' ? 'text-amber-300' : 'text-emerald-300'}`}>
    {engineLabel}
  </span>
</div>
```

- [ ] **Step 2: Wrap in a guard**

Replace with:

```tsx
{autoVisionaryEnabled && isVisionaryMode && (
  <div className="flex items-center gap-2 text-[9px] font-mono">
    <span className="text-zinc-400">Engine:</span>
    <span className={`font-bold ${transcriptionEngine === 'browser_stt' ? 'text-amber-300' : 'text-emerald-300'}`}>
      {engineLabel}
    </span>
  </div>
)}
```

Net effect: when Auto Visionary is off, no "Disabled" text ever renders.

- [ ] **Step 3: Commit**

```bash
git add components/BibleBrowser.tsx
git commit -m "refactor(bible-hub): hide engine row when auto visionary is off"
```

---

## Task 4: Flatten Auto Listening into sibling collapsibles

**Files:**
- Modify: `components/BibleBrowser.tsx:1931-2063` (the entire `<CollapsiblePanel id="bible-auto-visionary">` block)

- [ ] **Step 1: Replace the Auto Listening wrapper**

Locate the block `<CollapsiblePanel id="bible-auto-visionary" ...> ... </CollapsiblePanel>` at [components/BibleBrowser.tsx:1931-2063](../../../components/BibleBrowser.tsx#L1931-L2063).

Replace the entire `<CollapsiblePanel>...</CollapsiblePanel>` block (keep the surrounding `<div className="space-y-2">` parent that contains the AI search input and button — do not remove that) with:

```tsx
<div className="space-y-2 rounded-sm border border-purple-900/60 bg-purple-950/20 p-2">
  {/* Compact toggle row — always visible */}
  <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-bold tracking-wider text-purple-300 uppercase">Auto Visionary</span>
      <button
        onClick={() => setAutoVisionaryEnabled((prev) => !prev)}
        className={`px-2 py-0.5 rounded-sm text-[9px] font-bold border ${autoVisionaryEnabled ? 'bg-emerald-700/40 text-emerald-300 border-emerald-700' : 'bg-zinc-900 text-zinc-300 border-zinc-700'}`}
      >
        {autoVisionaryEnabled ? 'ON' : 'OFF'}
      </button>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-zinc-400 uppercase tracking-wider">Auto Project</span>
      <button
        onClick={() => setAutoProjectEnabled((prev) => !prev)}
        className={`px-2 py-0.5 rounded-sm text-[9px] font-bold border ${autoProjectEnabled ? 'bg-cyan-700/40 text-cyan-300 border-cyan-700' : 'bg-zinc-900 text-zinc-300 border-zinc-700'}`}
      >
        {autoProjectEnabled ? 'ON' : 'OFF'}
      </button>
    </div>
  </div>

  <BibleAutoCurrentSetup
    selectedSourceLabel={selectedSourceLabel}
    resolvedDefaultSourceLabel={resolvedDefaultSourceLabel}
    captureModeLabel={captureModeLabel}
  />

  <CollapsiblePanel
    id="bible-audio-source"
    title="Audio Source"
    defaultCollapsed={true}
    className="rounded-sm border border-zinc-800 bg-zinc-950/60 p-2"
    data-testid="bible-audio-source-panel"
  >
    <SourcePicker
      devices={audioDevices}
      selectedId={audioDeviceId}
      resolvedDefaultLabel={resolvedDefaultSourceLabel}
      onSelect={handleSelectAudioSource}
    />
  </CollapsiblePanel>

  <CollapsiblePanel
    id="bible-capture-mode"
    title="Capture Mode"
    defaultCollapsed={true}
    className="rounded-sm border border-zinc-800 bg-zinc-950/60 p-2"
    data-testid="bible-capture-mode-panel"
  >
    <CaptureModePicker
      selected={captureMode}
      suggested={suggestedCaptureMode}
      onSelect={handleSelectCaptureMode}
    />
  </CollapsiblePanel>

  <CollapsiblePanel
    id="bible-speech-dialect"
    title="Speech Dialect"
    defaultCollapsed={true}
    className="rounded-sm border border-zinc-800 bg-zinc-950/60 p-2"
    data-testid="bible-speech-dialect-panel"
    badge={
      <span className="px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-wider border bg-cyan-950/40 text-cyan-200 border-cyan-800/60">
        {localeStatusLanguage}
      </span>
    }
  >
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-zinc-400 uppercase tracking-wider">Dialect</span>
        <select
          value={speechLocaleMode}
          onChange={(e) => onSpeechLocaleModeChange(e.target.value as VisionarySpeechLocaleMode)}
          className={`bg-zinc-900 border border-zinc-700 rounded-sm px-2 py-1 text-zinc-200 ${compact ? 'text-[8px]' : 'text-[9px]'}`}
        >
          <option value="auto">Auto (System Locale)</option>
          <option value="en-GB">English (UK) - en-GB</option>
          <option value="en-US">English (US) - en-US</option>
        </select>
      </div>
      <div className="text-[9px] text-cyan-300 font-mono">
        {localeStatusLanguage} ({localeModeLabel})
      </div>
    </div>
  </CollapsiblePanel>

  {autoVisionaryEnabled && isVisionaryMode && (
    <div className="flex items-center gap-2 text-[9px] font-mono">
      <span className="text-zinc-400">Engine:</span>
      <span className={`font-bold ${transcriptionEngine === 'browser_stt' ? 'text-amber-300' : 'text-emerald-300'}`}>
        {engineLabel}
      </span>
    </div>
  )}
  {engineToast && (
    <div className="text-[9px] text-amber-200 font-mono border border-amber-700/60 rounded-sm p-1.5 bg-amber-950/25">
      {engineToast}
    </div>
  )}
  <div className="text-[9px] text-zinc-300 font-mono">{autoStatusText}</div>
  {cloudCooldownUntil > Date.now() && (
    <div className="text-[9px] text-amber-300 font-mono">
      Cooldown: {Math.max(1, Math.ceil((cloudCooldownUntil - Date.now()) / 1000))}s
    </div>
  )}
  {inputDiagnostic && (autoVisionaryEnabled || transcriptionEngine === 'cloud') && (
    <BibleAutoInputDebug
      diagnostic={inputDiagnostic}
      selectedSourceLabel={selectedSourceLabel}
      resolvedDefaultSourceLabel={resolvedDefaultSourceLabel}
    />
  )}
  {autoReferences.length > 0 && (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Matches</div>
      <div className="flex flex-wrap gap-1">
        {autoReferences.map((ref) => (
          <button
            key={ref}
            onClick={() => void handleAutoReferenceClick(ref)}
            className="text-[9px] text-cyan-300 font-mono bg-cyan-950/40 border border-cyan-800/50 rounded px-1.5 py-0.5 hover:bg-cyan-900/60 active:bg-cyan-900/80 transition-colors truncate max-w-[140px]"
            title={`Load ${ref}`}
          >
            {ref}
          </button>
        ))}
      </div>
    </div>
  )}
  {autoTranscript && (
    <div className="text-[9px] text-zinc-400 font-mono border border-zinc-800 rounded-sm p-1.5 max-h-16 overflow-y-auto">
      Heard: {autoTranscript}
    </div>
  )}
  {autoError && autoVisionaryEnabled && (
    <div className="flex items-start gap-1.5 bg-rose-950/40 border border-rose-800/50 rounded px-2 py-1">
      <span className="text-rose-400 text-[10px] leading-tight shrink-0 mt-px">⚠</span>
      <span className="text-[9px] text-rose-300 font-mono leading-tight line-clamp-2">{autoError}</span>
      <button
        onClick={() => setAutoError(null)}
        className="ml-auto text-rose-500 hover:text-rose-300 text-[10px] shrink-0 leading-tight"
        title="Dismiss"
      >✕</button>
    </div>
  )}
</div>
```

Key structural notes:
- The old outer `CollapsiblePanel id="bible-auto-visionary"` is gone (replaced by a plain `div` with the same border/bg). Its `lumina.panel.bible-auto-visionary` localStorage key becomes orphaned — harmless.
- Three new `CollapsiblePanel` sub-sections with IDs `bible-audio-source`, `bible-capture-mode`, `bible-speech-dialect`, all `defaultCollapsed={true}`.
- The two toggles (Auto Visionary / Auto Project) now share a single compact row instead of stacking.
- Every other status element (`autoStatusText`, `cooldown`, `inputDiagnostic`, `autoReferences`, `autoTranscript`, `autoError`, `engineToast`) is preserved verbatim.
- The Engine-row guard from Task 3 is already baked in; if Task 3 has not been done yet, apply Task 3's change first — these two tasks must be committed in order.
- `BibleAutoCurrentSetup` (the one-liner context summary) stays visible inline — it was already there.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Run the full test suite to confirm no regressions in hook tests**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 4: Manual smoke in Electron dev**

Run: `npm run electron:dev` (or the project's normal dev command).
Open Bible Hub → expand/collapse each of Audio Source, Capture Mode, Speech Dialect → reload app → confirm collapse state persists per panel. Toggle Auto Visionary → confirm Engine row appears (Cloud or Offline) and disappears correctly. Toggle off → confirm Engine row hides.

- [ ] **Step 5: Commit**

```bash
git add components/BibleBrowser.tsx
git commit -m "refactor(bible-hub): flatten auto listening into sibling collapsibles"
```

---

## Task 5: Remove max-h-[60%] cap and give scriptures remaining space

**Files:**
- Modify: `components/BibleBrowser.tsx:1876-1881`

- [ ] **Step 1: Locate the controls className**

Current code at [components/BibleBrowser.tsx:1876-1881](../../../components/BibleBrowser.tsx#L1876-L1881):

```typescript
const controlsClassName = compact
  ? 'shrink-0 px-2.5 py-2 space-y-2 border-b border-zinc-900/80 bg-zinc-950/95 overflow-y-auto custom-scrollbar max-h-[60%]'
  : 'p-3 space-y-2';
const resultsClassName = compact
  ? 'min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar'
  : 'flex-1 overflow-y-auto p-2 scrollbar-thin';
```

- [ ] **Step 2: Remove the cap**

Replace with:

```typescript
const controlsClassName = compact
  ? 'shrink-0 px-2.5 py-2 space-y-2 border-b border-zinc-900/80 bg-zinc-950/95 overflow-y-auto custom-scrollbar'
  : 'p-3 space-y-2';
const resultsClassName = compact
  ? 'min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar'
  : 'flex-1 overflow-y-auto p-2 scrollbar-thin';
```

The only change is dropping ` max-h-[60%]` from the compact `controlsClassName`. `resultsClassName` is unchanged (it already has `flex-1 min-h-0`, which gives it remaining vertical space automatically now that the top is uncapped).

- [ ] **Step 3: Manual smoke**

Rebuild/rerun the app. In compact mode:
- With all three sub-panels collapsed, the controls region should be tiny and scriptures should fill most of the panel.
- Expanding a sub-panel should expand the controls region but the scripture list should remain scrollable and not get pushed offscreen.
- In non-compact mode the layout should be unchanged.

- [ ] **Step 4: Commit**

```bash
git add components/BibleBrowser.tsx
git commit -m "fix(bible-hub): remove 60% cap so scriptures own remaining vertical space"
```

---

## Task 6: Flip Slide Style panel to expanded-by-default and tighten compact paddings

**Files:**
- Modify: `components/BibleBrowser.tsx:2339-2424`

- [ ] **Step 1: Flip `defaultCollapsed`**

Locate the Slide Style panel at [components/BibleBrowser.tsx:2343-2346](../../../components/BibleBrowser.tsx#L2343-L2346). Current:

```tsx
<CollapsiblePanel
  id="bible-slide-style"
  title="Slide Style & Preview"
  defaultCollapsed={true}
```

Change `defaultCollapsed={true}` → `defaultCollapsed={false}`. Result:

```tsx
<CollapsiblePanel
  id="bible-slide-style"
  title="Slide Style & Preview"
  defaultCollapsed={false}
```

Users who previously collapsed it keep their preference (localStorage wins over `defaultCollapsed`). New users / reset users see it open.

- [ ] **Step 2: Tighten the slide-style footer padding in compact mode**

Locate [components/BibleBrowser.tsx:2342](../../../components/BibleBrowser.tsx#L2342). Current:

```tsx
<div className={`${compact ? 'px-2.5 pt-2 pb-1' : 'px-3 pt-2.5 pb-1'}`}>
```

Change the compact branch to use tighter paddings:

```tsx
<div className={`${compact ? 'px-2 pt-1 pb-0.5' : 'px-3 pt-2.5 pb-1'}`}>
```

Net effect: in compact mode, the slide-style footer loses ~6-8px of vertical padding (≈25% reduction). Non-compact mode is untouched.

- [ ] **Step 3: Manual smoke**

Rebuild. Open Bible Hub in compact mode, run an AI search so `results.length > 0` and the Slide Style footer renders. Confirm:
- Panel is expanded by default on first render (for anyone without a stored preference).
- Collapsing it hides the Layout / Size / Style pickers and the Draft Preview.
- Re-expanding restores them.
- Scripture results remain visible above whether panel is expanded or collapsed.
- In Visionary mode, none of the existing Visionary controls are hidden or cropped.

- [ ] **Step 4: Commit**

```bash
git add components/BibleBrowser.tsx
git commit -m "feat(bible-hub): make slide style panel visible by default, tighten compact padding"
```

---

## Task 7: Final regression pass

**Files:** none modified — verification only.

- [ ] **Step 1: Full test run**

Run: `npx vitest run`
Expected: all tests pass (including the new `utils/transcriptionEngine.test.ts`).

- [ ] **Step 2: TypeScript + lint**

Run: `npx tsc --noEmit`
Expected: zero errors.

If the project has a lint script, run it too:
Run: `npm run lint` (only if present in `package.json`).

- [ ] **Step 3: Manual regression — Bible Hub listening pipeline**

In Electron dev, in compact mode:
- Enable AI Mode → Visionary.
- Toggle Auto Visionary ON → Engine row must show `Cloud` (if online) or `Offline (Browser STT)` (if offline), NOT `Disabled`.
- Say a known reference like "John three sixteen" → scripture should appear in the results list and (if Auto Project is on) be projected.
- Toggle Auto Visionary OFF → Engine row disappears; capture stops.
- Toggle back ON → Engine row reappears with correct label immediately (the bug fix).

- [ ] **Step 4: Manual regression — Stage-tab sermon recorder**

Switch to the Stage tab. Start a sermon recording. Stop it. Confirm transcription completes normally (no change expected; we only touched Bible Hub).

- [ ] **Step 5: Manual regression — scriptures visibility under slide style**

Search a reference to populate results. With Slide Style expanded, confirm scripture list is still scrollable and visible. Collapse Slide Style, confirm more scripture rows fit. Toggle layout presets (Standard / Scripture+Ref / Ticker) — scriptures remain visible, draft preview updates.

- [ ] **Step 6: Check panel persistence**

Expand Audio Source, close the app, reopen. State should persist (`lumina.panel.bible-audio-source` in localStorage).

- [ ] **Step 7: No commit required**

This task is verification only. If any regression is found, open a new task to fix it before marking the plan complete.
