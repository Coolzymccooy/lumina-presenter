# Save Sermon Recording to Audio Mixer — Design Spec

**Date:** 2026-04-21
**Status:** Approved
**Surfaces:** `SermonRecorderPanel` (main + stage overlay), `AudioLibrary` (mixer tab)

## Goal

When a sermon recording finishes, let the user save it as a playable track in the Audio Mixer. Recordings must be usable offline (local persistence) and, when the user opts in, synced to cloud so the same recording appears across Electron and web when signed into the same account.

## Non-Goals

- Waveform trimming / editing (mixer stays playback-only for v1)
- Multi-device edit conflict resolution (last-write-wins on rename is fine)
- Auto-transcoding to mp3 (keep native webm/opus — Chromium/Electron play it natively)
- Background upload retry across app restarts (v1 retries within-session only)

## UX

### Post-stop flow (SermonRecorderPanel)
Recording auto-saves to **local storage** the moment `stop()` produces the final Blob. Losing work to a missed click is unacceptable.

Immediately below the transcript, an inline **"Recording Saved" pill** appears with:
- Duration + file size (e.g. *"12:34 · 4.2 MB · Local only"*)
- Editable title (defaults to `Sermon — 2026-04-21 14:03`)
- **[Sync to Cloud]** button — visible when signed in; uploads + flips state icon
- **[Delete]** button — two-click confirm; removes local (and cloud if synced)
- **[Open in Mixer]** link — sets mixer tab active

If the user doesn't want to save at all, one click on **Delete** discards it. No confirmation prompt blocks the normal flow.

### Mixer UI (AudioLibrary)
New section above the Gospel Tracks list: **"My Recordings"**. Each row shows:
- Play button (same transport as existing tracks)
- Title (inline-editable on click)
- Duration + created-at
- **Sync state icon:** cloud-off (local only) / cloud-uploading (spinner) / cloud-check (synced) / cloud-download (cloud-only, not cached locally) / cloud-alert (upload failed, retry button)
- Kebab menu: Rename, Sync/Unsync, Download (if cloud-only), Delete

Empty state: *"Recordings from the Sermon Recorder appear here. Click 'Save to Mixer' after a recording."*

## Data Model

```ts
type SyncState =
  | 'local_only'     // in IndexedDB, never uploaded
  | 'uploading'      // upload in flight
  | 'synced'         // present locally AND in cloud
  | 'cloud_only'     // in cloud, not cached locally
  | 'upload_failed'; // local, retry needed

interface RecordedTrack {
  id: string;            // uuid, shared between local + cloud once synced
  kind: 'recording';
  title: string;
  durationSec: number;
  mime: string;          // 'audio/webm;codecs=opus'
  sizeBytes: number;
  createdAt: string;     // ISO
  syncState: SyncState;
  cloudUrl?: string;     // server-relative URL, e.g. /api/recordings/:id/audio
  lastError?: string;    // for upload_failed
}
```

IndexedDB schema (database `lumina-recordings`, version 1):
- Object store `recordings` — key `id`, value `{ ...RecordedTrack, blob: Blob }`
- Object store `meta` — single row `{ id: 'user', firebaseUid }` so we can discard stale local entries if user signs out / changes account

## Architecture

### Layers

1. **`services/recordings/localStore.ts`** — thin IndexedDB wrapper, no React. Methods: `put(track, blob)`, `get(id)`, `delete(id)`, `list()`, `updateMeta(id, patch)`.
2. **`services/recordings/cloudSync.ts`** — HTTP client for `/api/recordings/*`. Attaches Firebase ID token. Methods: `upload(track, blob)`, `list()`, `download(id)`, `remove(id)`, `rename(id, title)`. No React.
3. **`hooks/useRecordingLibrary.ts`** — single-instance hook. Reads local store on mount, merges with cloud list when authed, exposes `tracks`, `addLocal(blob, meta)`, `syncToCloud(id)`, `deleteRecording(id)`, `renameRecording(id, title)`, `getPlaybackUrl(id)`. Instantiated **once** in `App.tsx` to match existing state-lifting pattern. State + methods passed via props to `SermonRecorderPanel` and `AudioLibrary`.
4. **Server `/api/recordings/*`** — CRUD endpoints. Follow the multer multipart pattern from `/api/ai/transcribe-sermon-audio`; follow the `requireActor` Firebase-auth pattern from workspace endpoints. SQLite table `recordings`; blobs on disk under `RECORDINGS_DIR` with sha256 filename.

### Playback URL resolution
- `syncState === 'local_only' | 'synced'` → `URL.createObjectURL(blob)` from IndexedDB (cached in a `Map<id, objectUrl>` inside the hook; revoked on unmount)
- `syncState === 'cloud_only'` → server URL with bearer token; browser `<audio>` element can hit it directly if we sign it with a short-lived query-param token, or proxy through the existing auth header pattern

### Cross-surface reuse
`SermonRecorderPanel` is already rendered inside `StageDisplay.tsx:L1491`. Adding the save-pill to the panel itself makes the feature appear on both main + stage surfaces with zero duplication. `StageSttPanel` (the lightweight stage transcription UI) is Web Speech API only and doesn't produce a Blob — out of scope.

## Server Endpoints

All endpoints under `/api/recordings/*`, all wrapped in `requireActor`:

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| POST | `/api/recordings` | multipart: `audio` file + JSON `meta` field (`id`, `title`, `durationSec`, `mime`, `createdAt`) | `{ ok, id, cloudUrl, sizeBytes }` |
| GET | `/api/recordings` | — | `{ ok, recordings: RecordedTrack[] }` |
| GET | `/api/recordings/:id/audio` | — | audio stream (`Content-Type` from db row) |
| PATCH | `/api/recordings/:id` | `{ title }` | `{ ok }` |
| DELETE | `/api/recordings/:id` | — | `{ ok }` |

SQLite schema:
```sql
CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  duration_sec REAL NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX recordings_uid_idx ON recordings(firebase_uid, created_at DESC);
```

Files written to `RECORDINGS_DIR/<firebase_uid>/<id>.<ext>` so deleting a user's data is a single `rm -rf`.

## Error Handling

- **Upload failure** (network / 5xx) → mark `upload_failed`, show retry button on the pill + in mixer. No auto-retry loop — explicit user retry.
- **Quota full** (IndexedDB `QuotaExceededError`) → refuse to save, show pill with *"Browser storage full — free some space or save to cloud"* and disabled local-save buttons.
- **Playback failure** for cloud-only → surface *"Recording not available offline"* and offer Download.
- **Sign-out while a recording is local_only** → keep local; next sign-in with same UID re-merges. Different UID → recordings stay in old account's IndexedDB, hidden from new user.

## Security

- All server endpoints require Firebase ID token; file paths are scoped by `firebase_uid`.
- `GET /:id/audio` must verify the caller owns the recording before streaming.
- Upload size cap: **100 MB** per recording (rejects at multer layer). Enough for ~2h of opus @ 128 kbps.
- MIME whitelist on upload: `audio/webm`, `audio/webm;codecs=opus`, `audio/mp4`.
- No signed-URL / CDN for v1 — server streams with auth. Fine for church-scale traffic.

## Testing Strategy

- **Unit:** `localStore` CRUD, `cloudSync` with fetch mock, sync-state transitions in `useRecordingLibrary`.
- **Component:** SermonRecorderPanel post-stop pill rendering + button handlers; AudioLibrary recording row renders and delete confirms.
- **Server:** supertest-style tests over `/api/recordings` happy path + auth rejection + ownership checks.
- **E2E (Playwright):** record → stop → see pill → click Sync → see synced icon → reload → recording still in mixer → delete → gone from both stores.

## Rollout

Single branch, single PR. No feature flag — this is purely additive (new UI section, new endpoints). If upload service unavailable, the local-only flow still works.
