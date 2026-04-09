# Sermon Recorder — End-to-End Technical Reference

> Feature branch: `feature/sermon-recorder-persistence`
> Last updated: 2026-04-09

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [File Map](#3-file-map)
4. [Data Flow](#4-data-flow)
5. [Hook: `useSermonRecorder`](#5-hook-usesermonrecorder)
6. [UI Component: `SermonRecorderPanel`](#6-ui-component-sermonrecorderpanel)
7. [Service: `geminiService` — Transcription APIs](#7-service-geminiservice--transcription-apis)
8. [Service: `sermonSummaryService`](#8-service-sermonsummaryservice)
9. [Integration: `App.tsx`](#9-integration-apptsx)
10. [Integration: `StageWorkspace`](#10-integration-stageworkspace)
11. [Flash to Screen — End-to-End](#11-flash-to-screen--end-to-end)
12. [Known Limitations & Browser Caveats](#12-known-limitations--browser-caveats)
13. [Troubleshooting](#13-troubleshooting)
14. [Extension Points](#14-extension-points)

---

## 1. Overview

The Sermon Recorder is a recording and transcription panel embedded in Lumina Presenter's Stage view. It captures live audio from a microphone, transcribes it progressively via two parallel pipelines (Web Speech API + Gemini cloud), allows the operator to edit and AI-summarize the transcript, then push the result directly to the live output display as presentation slides.

**User journey:**
```
Open Stage view
  → Click "Sermon" toggle in top-right status bar
    → Panel opens (persists across tab switches — fixed overlay)
      → Select accent, pick mic → "Start Recording"
        → Audio captured + waveform visualiser active
          → Live transcript grows every 12s via Gemini chunks
            → Click "Stop & Transcribe" → full Gemini pass
              → "Summarize with AI" → structured key points
                → "Flash to Screen" → slides appear in run sheet + live
```

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  App.tsx (root)                                          │
│  ├── [showSermonRecorder state]                          │
│  ├── handleSermonFlashToScreen()  ← builds slides        │
│  │     ↓ addItem(sermonItem)  → run sheet                │
│  │     ↓ goLive(sermonItem)   → live output              │
│  │     ↓ submitAudienceMessage → audience ticker         │
│  │                                                       │
│  ├── <StageWorkspace>                                    │
│  │     showSermonRecorder={...}                          │
│  │     onToggleSermonRecorder={...}                      │
│  │     (toggle button lives here; no recorder mount)     │
│  │                                                       │
│  └── {showSermonRecorder && <SermonRecorderPanel>}       │
│        fixed overlay z-200, top-right                    │
│        onFlashToScreen={handleSermonFlashToScreen}       │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│  SermonRecorderPanel (UI only — no recording logic)      │
│  ├── useSermonRecorder()  ← all state + actions          │
│  ├── <WaveformBars>       ← canvas visualiser            │
│  ├── summarizeSermon()    ← Gemini summary               │
│  └── onFlashToScreen()    ← prop callback                │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│  useSermonRecorder (hook)                                │
│  ├── MediaRecorder (audio/webm;codecs=opus preferred)    │
│  ├── AudioContext chain:                                 │
│  │     mic → highpass(80Hz) → compressor → analyser     │
│  │     └→ MediaStreamDestination → MediaRecorder        │
│  ├── Web Speech API (live captions, HTTPS only)          │
│  ├── Chunk upload interval: every 12s → Gemini           │
│  │     result APPENDS to cloudTranscript                 │
│  └── Stop → full audio blob → Gemini final pass         │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│  Backend API endpoints (cloud-api or local server)       │
│  ├── POST /api/ai/transcribe-sermon-chunk                │
│  │     → Gemini: 12s interim transcription              │
│  ├── POST /api/ai/transcribe-sermon-audio                │
│  │     → Gemini: full recording transcription on stop   │
│  └── POST /api/ai/summarize-sermon                       │
│        → Gemini: structured sermon summary               │
└──────────────────────────────────────────────────────────┘
```

---

## 3. File Map

| File | Role |
|------|------|
| `hooks/useSermonRecorder.ts` | All recording state and actions |
| `components/SermonRecorderPanel.tsx` | Recording UI, waveform, transcript editor |
| `services/geminiService.ts` | `transcribeSermonChunk`, `transcribeSermonAudio`, types |
| `services/sermonSummaryService.ts` | `summarizeSermon`, `SermonSummary` type |
| `components/builder/StageWorkspace.tsx` | Toggle button; passes controlled props up |
| `App.tsx` | Persistent overlay, `handleSermonFlashToScreen`, `showSermonRecorder` state |

---

## 4. Data Flow

### 4.1 Recording Phase

```
getUserMedia({ audio })
  → AudioContext
      → BiquadFilter (highpass 80Hz)          // removes PA rumble
      → DynamicsCompressor (−24dB, 4:1 ratio) // handles preaching dynamics
      → AnalyserNode                           // feeds visualiser micLevel (0–1)
      → MediaStreamDestination
          → MediaRecorder(1s timeslice)
              → audioChunksRef[]              // in-memory crash resilience
```

```
setInterval(12s) → transcribeSermonChunk(accumulated audio)
  → result.transcript APPENDED to cloudTranscript
  → error → chunkError (shown in transcript box)
```

```
SpeechRecognition (Web Speech API)
  → liveTranscript (HTTPS only — shows amber warning otherwise)
  → interimText (unconfirmed words, greyed out)
  → auto-restarts on end (browser kills after ~60s silence)
```

### 4.2 Stop Phase

```
MediaRecorder.stop()
  → all chunks collected
  → cleanup() (clears all timers, AudioContext, stream tracks)
  → phase = 'transcribing'
  → transcribeSermonAudio(fullBlob) → cloudTranscript (replaces chunks)
  → phase = 'done'
  → editableTranscript seeded from transcript (cloud preferred)
```

### 4.3 Transcript Priority

```
transcript = cloudTranscript || liveTranscript
```

During recording, the live panel shows:
1. Web Speech results if available (`liveTranscript` + `interimText`)
2. Otherwise Gemini chunk results (`cloudTranscript`) — grows cumulatively
3. Otherwise Gemini chunk error (`chunkError`)
4. Otherwise placeholder: "Recording — transcript will appear in ~12 seconds..."

### 4.4 Flash to Screen

```
handleFlash() in panel
  → onFlashToScreen({ transcript, summary? })      // prop callback

handleSermonFlashToScreen() in App.tsx
  → if summary: build slides from keyPoints
  → else: split transcript into 30-word chunks per slide
  → finalizeGeneratedItemBackground(sermonItem)    // inherits prevailing bg
  → addItem(sermonItem)                            // → run sheet
  → goLive(sermonItem, 0)                          // → live output display
  → submitAudienceMessage(...)                     // → audience SSE ticker
```

---

## 5. Hook: `useSermonRecorder`

**File:** `hooks/useSermonRecorder.ts`

### Options

```typescript
interface SermonRecorderOptions {
  locale?: 'en-GB' | 'en-US';           // default: 'en-GB'
  accentHint?: SermonAccentHint;         // default: 'standard'
  audioDeviceId?: string;               // from enumerateDevices(); uses default if omitted
}

type SermonAccentHint =
  | 'standard' | 'uk' | 'nigerian' | 'ghanaian' | 'southafrican' | 'kenyan';
```

### State (`SermonRecorderState`)

| Field | Type | Description |
|-------|------|-------------|
| `phase` | `SermonRecorderPhase` | Current recorder phase (see below) |
| `liveTranscript` | `string` | Confirmed text from Web Speech API |
| `interimText` | `string` | Unconfirmed text currently being spoken |
| `cloudTranscript` | `string` | Cumulative text from Gemini chunk uploads (appends every 12s). Replaced by full-audio result on stop. |
| `transcript` | `string` | Best transcript: `cloudTranscript \|\| liveTranscript` |
| `elapsedSeconds` | `number` | Recording timer (pauses when paused) |
| `micLevel` | `number` | 0–1 RMS amplitude — drives the waveform visualiser |
| `error` | `string \| null` | Set if `phase === 'error'` |
| `sttStatus` | `string` | `'idle' \| 'active' \| 'unavailable' \| errorCode` |
| `chunkError` | `string \| null` | Last Gemini chunk upload error; null when ok |

### Phases

```
'idle'        → ready to record
'recording'   → MediaRecorder active
'paused'      → MediaRecorder paused, timer stopped
'transcribing'→ stopped, waiting for Gemini full-audio result
'done'        → transcript available
'error'       → microphone access denied or fatal error
```

### Actions (`SermonRecorderActions`)

| Action | Effect |
|--------|--------|
| `start()` | Acquires mic, builds AudioContext chain, starts MediaRecorder + STT + chunk upload timer |
| `pause()` | Pauses MediaRecorder, stops STT and visualiser, freezes timer |
| `resume()` | Resumes all of the above |
| `stop()` | Stops recorder, runs full Gemini transcription, sets phase `done` |
| `clearTranscript()` | Resets all transcript state |
| `setTranscript(text)` | Manually sets live transcript (for paste/edit round-trips) |

### Audio Processing Chain

```
mic (getUserMedia)
  → highpass filter (80 Hz, Q=0.7)    // removes PA/ventilation rumble
  → dynamics compressor                // threshold: −24dB, knee: 10, ratio: 4:1
      attack: 3ms, release: 250ms      // fast response for preaching dynamics
  → analyser (fftSize=256)            // micLevel → visualiser
  → MediaStreamDestination             // captures processed audio
      → MediaRecorder(1s timeslices)  // builds audioChunksRef[]
```

**MIME type selection** (in priority order):
1. `audio/webm;codecs=opus`
2. `audio/webm`
3. `audio/mp4`

### Chunk Upload Interval

`CHUNK_UPLOAD_INTERVAL_MS = 12_000` (12 seconds)

- Runs on `setInterval` while `phase === 'recording'`
- Skips if accumulated audio blob `< 8192 bytes`
- Sends the **full accumulated audio so far** (not just the last 12s chunk) — this gives Gemini more context
- On success: **appends** to `cloudTranscript` (not replaces)
- On failure: sets `chunkError` and shows error in UI

### Cleanup

`cleanup()` is called on `stop()` and as an `useEffect` teardown. It:
- Clears both `setInterval` timers (elapsed + chunk upload)
- Cancels the `requestAnimationFrame` visualiser loop
- Stops the `SpeechRecognition` instance
- Disconnects the `AnalyserNode` and closes the `AudioContext`
- Stops all mic stream tracks via `getTracks().forEach(t.stop())`
- Stops the `MediaRecorder` if still active

---

## 6. UI Component: `SermonRecorderPanel`

**File:** `components/SermonRecorderPanel.tsx`

### Props

```typescript
interface SermonRecorderPanelProps {
  onClose: () => void;
  onFlashToScreen: (content: { transcript: string; summary?: SermonSummary }) => void;
  onAddToSchedule?: (text: string) => void;  // optional text-only schedule add
  locale?: SermonRecorderLocale;              // default: 'en-GB'
  compact?: boolean;                          // reduces padding (unused by default)
}
```

### Panel Lifecycle States

| Phase | Header dot | Controls visible |
|-------|-----------|-----------------|
| `idle` | grey | Mic picker, accent selector, Start button |
| `recording` | red pulsing | Waveform, Pause, Stop & Transcribe |
| `paused` | amber | Waveform (inactive), Resume, Stop & Transcribe |
| `transcribing` | blue pulsing | Bouncing dot loader |
| `done` | green | Editable transcript, Summarize, Flash to Screen |
| `error` | — | Error message, Try Again |

### Waveform Visualiser (`WaveformBars`)

- **32 bars** rendered on a `<canvas width=384 height=72>`
- Each bar tracks an **independent** smoothed value (simulates frequency bands)
- `freqBias`: inner bars react more to voice frequencies than outer bars
- `randomNoise`: ±0.175 random jitter (active only) — prevents static look
- **Smoothing**: attack speed `0.55`, decay speed `0.25` (fast rise, slow fall)
- **Inactive**: bars settle to floor height `0.04`, rendered in zinc
- **Active**: centre-origin bidirectional bars with red gradient
  - `rgba(220,38,38)` edges → `rgba(252,100,100)` centre highlight

### Transcript Display Logic (During Recording)

Priority order for what shows in the transcript box:
1. **Web Speech results** — if `liveTranscript` or `interimText` is non-empty
2. **Gemini chunk results** — if `cloudTranscript` is non-empty (shown with "VIA GEMINI · UPDATES EVERY 12 S" label)
3. **Gemini error** — if `chunkError` is set (amber, explains audio still capturing)
4. **Placeholder** — "Recording — transcript will appear in ~12 seconds..."

### STT Warning Banner

Shown only while `isActive` (`recording` or `paused`) when `sttStatus` is not `idle`/`active`:

| `sttStatus` | Message |
|-------------|---------|
| `unavailable` | Live captions not supported in this browser |
| `network` | Live captions need HTTPS — common in local dev |
| `not-allowed` / `service-not-allowed` | Speech recognition was blocked |
| Other | "Live captions unavailable (${code})" |

All banners note that **audio is still recording** and Gemini will transcribe on Stop.

### Done State — Editable Transcript

- `editableTranscript` is seeded from `transcript` when phase transitions to `done`
- Click "Edit" → `<textarea>` (auto-focused)
- Click "Done" / blur → commits via `recActions.setTranscript(editableTranscript)`
- Word count is live-computed and shown

### Summarize

- Minimum **80 words** required (enforced by `canSummarize()`)
- Calls `summarizeSermon(text, accentHint)` → `POST /api/ai/summarize-sermon`
- Result stored in local `summary` state, rendered via `<InlineSummary>`
- `<InlineSummary>` displays: Theme, Key Points (numbered), Scriptures (pill badges), Call to Action
- "Re-summarize" available after first summary

### Flash to Screen

- Enabled only when `phase === 'done'` and `wordCount > 0`
- Sends `{ transcript, summary? }` to `onFlashToScreen` prop
- Shows "Flashed ✓" for 2.5s after action

---

## 7. Service: `geminiService` — Transcription APIs

**File:** `services/geminiService.ts`

### `transcribeSermonChunk`

```typescript
const transcribeSermonChunk = async (
  payload: TranscribeSermonChunkRequest
): Promise<TranscribeSermonChunkResult>
```

**Request:**
```typescript
{
  audioBase64: string;  // base64-encoded audio blob (no data URI prefix)
  mimeType: 'audio/webm' | 'audio/webm;codecs=opus' | 'audio/mp4';
  locale: 'en-GB' | 'en-US';
  accentHint?: string;
}
```

**Result union:**
```typescript
// Success
{ ok: true; mode: 'success'; transcript: string; locale: 'en-GB' | 'en-US'; retryAfterMs?: 0 }

// Rate-limited / quota
{ ok: false; mode: 'cooldown'; retryAfterMs: number; error: string; message: string }

// Transient / terminal error
{ ok: false; mode: 'transient_error' | 'terminal_error'; retryAfterMs: 0; error: string; message: string }
```

**Error codes that trigger cooldown:** `TRANSCRIBE_COOLDOWN`, `QUOTA_EXCEEDED`, `HTTP_429`

**Endpoint:** `POST /api/ai/transcribe-sermon-chunk`

### `transcribeSermonAudio`

Called on Stop with the full accumulated audio blob.

```typescript
const transcribeSermonAudio = async (
  blob: Blob,
  mimeType: string,
  locale: SermonRecorderLocale,
  accentHint?: string
): Promise<{ ok: boolean; transcript?: string; error?: string }>
```

**Endpoint:** `POST /api/ai/transcribe-sermon-audio`

---

## 8. Service: `sermonSummaryService`

**File:** `services/sermonSummaryService.ts`

### `SermonSummary` type

```typescript
interface SermonSummary {
  title: string;
  mainTheme: string;
  keyPoints: string[];
  scripturesReferenced: string[];
  callToAction: string;
  quotableLines: string[];
}
```

### `summarizeSermon`

```typescript
const summarizeSermon = async (
  transcript: string,
  accentHint?: string
): Promise<{ ok: boolean; summary?: SermonSummary; error?: string; durationMs?: number }>
```

- Minimum 80 words — returns error immediately if below threshold
- Timeout: 90 seconds (large transcript can be slow)
- **Endpoint:** `POST /api/ai/summarize-sermon`

### `canSummarize(transcript: string): boolean`

Returns `true` if the transcript has ≥ 80 words. Used to enable/disable the Summarize button.

### `formatTranscriptDuration(wordCount: number): string`

Estimates recording duration: assumes ~130 words/minute average spoken English.

---

## 9. Integration: `App.tsx`

### State

```typescript
const [showSermonRecorder, setShowSermonRecorder] = useState(false);
```

Defined alongside `viewMode`. Survives tab switches because it lives at App root.

### `handleSermonFlashToScreen`

```typescript
const handleSermonFlashToScreen = useCallback(async (
  content: { transcript: string; summary?: SermonSummary }
) => { ... }, [workspaceId, finalizeGeneratedItemBackground, addItem, goLive]);
```

**Slide building logic:**
- **With summary:** `[mainTheme, ...keyPoints, callToAction?]` — one slide per field
- **Without summary:** transcript split into 30-word chunks, one slide each; minimum 1 slide

**ServiceItem construction:**
```typescript
{
  id: `${stamp}-sermon`,
  title: 'Sermon Recap' | summary.title,
  type: ItemType.ANNOUNCEMENT,
  slides: [...],
  theme: {
    backgroundUrl: DEFAULT_BACKGROUNDS[2],
    fontFamily: 'sans-serif',
    textColor: '#ffffff',
    shadow: true,
    fontSize: 'large',
  },
  metadata: { source: 'manual', createdAt: Date.now() },
}
```

Then:
1. `finalizeGeneratedItemBackground(item, 'system')` — inherits prevailing generated background
2. `addItem(sermonItem)` — pushes to run sheet
3. `goLive(sermonItem, 0)` — immediately goes live on output display
4. `submitAudienceMessage(...)` — non-fatal audience ticker update

### Persistent Overlay

The panel is rendered at the bottom of App's root JSX as a `fixed` element, not inside the `viewMode` conditional:

```tsx
{showSermonRecorder && (
  <div className="fixed top-16 right-4 z-[200] w-96 max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl">
    <SermonRecorderPanel
      onClose={() => setShowSermonRecorder(false)}
      onFlashToScreen={handleSermonFlashToScreen}
    />
  </div>
)}
```

`z-[200]` places it above all other UI layers including modals (`z-50`) and context menus.

---

## 10. Integration: `StageWorkspace`

**File:** `components/builder/StageWorkspace.tsx`

The recorder is no longer rendered or mounted here. StageWorkspace is responsible only for:

1. **Toggle button** — in the top-right status bar of Stage view
2. **Controlled props** — `showSermonRecorder` and `onToggleSermonRecorder` passed down from App

```typescript
interface StageWorkspaceProps {
  // ...
  showSermonRecorder: boolean;
  onToggleSermonRecorder: () => void;
}
```

Toggle button appearance:
- **Active:** `border-red-600 text-red-300 bg-red-950/40` — shows "● Rec"
- **Inactive:** `border-zinc-700 text-zinc-400` — shows "Sermon"

The button is always visible when in Stage view (`viewMode === 'STAGE'`).

---

## 11. Flash to Screen — End-to-End

```
User clicks "Flash to Screen" in SermonRecorderPanel
  ↓
handleFlash() in SermonRecorderPanel
  → reads: transcript (or editableTranscript if in edit mode)
  → reads: summary (if user ran AI summarise)
  → calls: onFlashToScreen({ transcript, summary? })
  → shows "Flashed ✓" for 2.5s

  ↓
handleSermonFlashToScreen() in App.tsx
  → if summary:
      title = summary.title || 'Sermon'
      slides = [mainTheme, ...keyPoints, callToAction]
  → else:
      title = 'Sermon Recap'
      slides = transcript.split(every 30 words)

  → sermonItem = finalizeGeneratedItemBackground({
        id, title, type: ANNOUNCEMENT, slides, theme, metadata
    }, 'system')

  → addItem(sermonItem)          // appended to schedule state
  → goLive(sermonItem, 0)        // output display goes live slide 0
  → submitAudienceMessage(...)   // audience SSE ticker (non-fatal)

  ↓
Run sheet: new item appears at bottom of list
Stage output: slide 0 immediately shown
Audience display: sermon summary text scrolled in ticker
```

---

## 12. Known Limitations & Browser Caveats

### HTTPS Requirement for Web Speech API

`SpeechRecognition` requires a secure context (HTTPS or `localhost`). On HTTP origins:
- `sttStatus` becomes `'network'`
- Amber warning shown: "Live captions need HTTPS"
- **Audio capture (MediaRecorder) still works** — Gemini provides transcription via chunk uploads

This is the expected behaviour in local dev (`http://localhost:...`). In production (HTTPS), Web Speech API should work alongside Gemini.

### Chunk Upload Sends Full Audio, Not Just Last 12s

Each chunk upload sends the **entire accumulated audio** since recording started. This gives Gemini more context for accuracy but means payload size grows over time. For very long sermons (>30 min), chunk uploads may time out or be rejected due to payload size limits. The fallback is `Stop & Transcribe` which also sends the full blob.

### Transcript Appends Cumulatively During Recording

Each successful chunk result is **appended** to `cloudTranscript`. This means:
- Short recordings may show repeated content if Gemini re-transcribes overlapping audio
- On `Stop`, the full-audio transcription **replaces** the accumulated chunk results entirely

### Audio Stops on Tab Sleep (Mobile / Battery Saver)

On mobile browsers and aggressive battery-saver modes, the `AudioContext` may be suspended when the tab loses focus. The recording will stall silently. Lumina Presenter is primarily a desktop web app — this limitation is acceptable.

### Visualiser Requires Canvas API

`<WaveformBars>` uses `canvas.roundRect()` which requires Chrome 99+ / Firefox 112+. Older browsers will show a blank waveform (non-fatal).

---

## 13. Troubleshooting

### "Transcript will appear in ~12 seconds" — nothing ever shows

**Likely cause:** The `/api/ai/transcribe-sermon-chunk` endpoint is returning errors.

Check:
1. Is the backend running and accessible?
2. Is `ANTHROPIC_API_KEY` / Gemini API key set in the server's environment?
3. Open DevTools → Network → filter by `transcribe-sermon-chunk` — what is the response?
4. `chunkError` state will surface the error in the transcript box after the first failed upload

### "Live captions need HTTPS" — amber banner

Expected when testing on `http://`. Gemini chunk transcription is the sole live source in this case. Ensure `/api/ai/transcribe-sermon-chunk` is reachable.

### Microphone access denied

The browser blocked `getUserMedia`. Check:
1. Site permissions in browser settings
2. `OverconstrainedError` — specific `audioDeviceId` not found; hook automatically retries with default mic

### Panel disappears when switching tabs

This was a known bug (recorder was mounted inside `StageWorkspace` which only renders in STAGE view). Fixed in `feature/sermon-recorder-persistence` — panel now lives as a persistent fixed overlay in App root.

### Transcript shows "No transcript captured" after Stop

MediaRecorder collected 0 chunks (`audioChunksRef.current` is empty). This happens if:
- Recording was stopped immediately after start (< 1s timeslice)
- MediaRecorder `ondataavailable` was never fired (browser bug)

Workaround: record for at least 2–3 seconds.

### Flash to Screen — slides don't appear in run sheet

Check that `handleSermonFlashToScreen` is wired as `onFlashToScreen` prop on `<SermonRecorderPanel>`. If `onFlashToSchedule` is undefined, the old code path (audience ticker only) would be used — this is fixed in the current implementation.

---

## 14. Extension Points

### Add more accent hints

In `useSermonRecorder.ts`:
```typescript
export type SermonAccentHint = 'standard' | 'uk' | 'nigerian' | 'ghanaian' | 'southafrican' | 'kenyan' | 'indian';
```

In `SermonRecorderPanel.tsx`, add the `<option>` to the accent selector.

Backend (`/api/ai/transcribe-sermon-chunk`) uses the `accentHint` field in its Gemini prompt.

### Change slide-building logic

In `App.tsx` → `handleSermonFlashToScreen`:
- Adjust `PER_SLIDE = 30` for different words-per-slide
- Modify `theme.backgroundUrl` to use a different background for sermon slides
- Change `type: ItemType.ANNOUNCEMENT` to a different `ItemType` if needed

### Save recordings

`sermonArchive.ts` exists as a stub (`import type { SermonSummary } from './sermonSummaryService'`). Implement:
```typescript
export const archiveSermon = async (transcript: string, summary: SermonSummary) => { ... }
```
and call it in `handleSermonFlashToScreen` or on Stop.

### Adjust chunk interval

In `hooks/useSermonRecorder.ts`:
```typescript
const CHUNK_UPLOAD_INTERVAL_MS = 12_000; // change to e.g. 20_000 for less frequent uploads
```

Lower values give more frequent live transcript updates but increase API call frequency and payload growth.

### Support multiple locales

`locale` prop flows through: `SermonRecorderPanel` → `useSermonRecorder` → `SpeechRecognition.lang` + `transcribeSermonChunk.locale`. Adding a locale picker to the panel idle state would expose this to users.
