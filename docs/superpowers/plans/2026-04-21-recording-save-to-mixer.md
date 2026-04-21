# Save Sermon Recording to Audio Mixer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recorded sermon audio is auto-saved locally, optionally synced to cloud, and appears as a playable track in the Audio Mixer across both Electron and web when signed in.

**Architecture:** IndexedDB for local blob persistence, new Express `/api/recordings/*` endpoints for cloud sync (multer + SQLite + disk storage under `RECORDINGS_DIR/<firebase_uid>/`), a `useRecordingLibrary` hook instantiated once in `App.tsx` that merges local + cloud lists and is passed via props to `SermonRecorderPanel` (which is already reused by the stage overlay) and `AudioLibrary`. Firebase ID token auth via existing `requireActor`.

**Tech Stack:** React 18 + TypeScript, Vitest, Express 5, better-sqlite3, multer, Firebase Admin (auth verification), Playwright.

---

## Task 1: Recording types + IndexedDB local store

**Files:**
- Create: `services/recordings/types.ts`
- Create: `services/recordings/localStore.ts`
- Create: `services/recordings/localStore.test.ts`

- [ ] **Step 1: Write types**

```ts
// services/recordings/types.ts
export type SyncState =
  | 'local_only'
  | 'uploading'
  | 'synced'
  | 'cloud_only'
  | 'upload_failed';

export interface RecordedTrack {
  id: string;
  kind: 'recording';
  title: string;
  durationSec: number;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  syncState: SyncState;
  cloudUrl?: string;
  lastError?: string;
}

export interface LocalRecordingRow extends RecordedTrack {
  blob: Blob;
}
```

- [ ] **Step 2: Write failing localStore tests**

```ts
// services/recordings/localStore.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { localStore } from './localStore';
import type { RecordedTrack } from './types';

const sampleMeta = (overrides: Partial<RecordedTrack> = {}): RecordedTrack => ({
  id: 'rec-1',
  kind: 'recording',
  title: 'Test',
  durationSec: 12.5,
  mime: 'audio/webm;codecs=opus',
  sizeBytes: 1024,
  createdAt: '2026-04-21T12:00:00.000Z',
  syncState: 'local_only',
  ...overrides,
});

describe('localStore', () => {
  beforeEach(async () => { await localStore.reset(); });

  it('put + get round-trips track and blob', async () => {
    const blob = new Blob([new Uint8Array([1,2,3])], { type: 'audio/webm' });
    await localStore.put(sampleMeta(), blob);
    const row = await localStore.get('rec-1');
    expect(row?.title).toBe('Test');
    expect(row?.blob.size).toBe(3);
  });

  it('list returns newest first', async () => {
    await localStore.put(sampleMeta({ id: 'a', createdAt: '2026-01-01T00:00:00Z' }), new Blob([]));
    await localStore.put(sampleMeta({ id: 'b', createdAt: '2026-03-01T00:00:00Z' }), new Blob([]));
    const rows = await localStore.list();
    expect(rows.map(r => r.id)).toEqual(['b', 'a']);
  });

  it('updateMeta patches without touching blob', async () => {
    const blob = new Blob([new Uint8Array([9])], { type: 'audio/webm' });
    await localStore.put(sampleMeta(), blob);
    await localStore.updateMeta('rec-1', { title: 'Renamed', syncState: 'synced' });
    const row = await localStore.get('rec-1');
    expect(row?.title).toBe('Renamed');
    expect(row?.syncState).toBe('synced');
    expect(row?.blob.size).toBe(1);
  });

  it('delete removes row', async () => {
    await localStore.put(sampleMeta(), new Blob([]));
    await localStore.delete('rec-1');
    expect(await localStore.get('rec-1')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run services/recordings/localStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Install fake-indexeddb dev dep if missing**

Run: `npm ls fake-indexeddb || npm i -D fake-indexeddb`

- [ ] **Step 5: Implement localStore**

```ts
// services/recordings/localStore.ts
import type { LocalRecordingRow, RecordedTrack } from './types';

const DB_NAME = 'lumina-recordings';
const DB_VERSION = 1;
const STORE = 'recordings';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const result = fn(store);
    if (result instanceof Promise) {
      result.then(resolve, reject);
    } else {
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    }
  });
}

export const localStore = {
  async put(track: RecordedTrack, blob: Blob): Promise<void> {
    const row: LocalRecordingRow = { ...track, blob };
    await tx('readwrite', (s) => s.put(row));
  },

  async get(id: string): Promise<LocalRecordingRow | undefined> {
    const row = await tx<LocalRecordingRow | undefined>('readonly', (s) => s.get(id));
    return row ?? undefined;
  },

  async delete(id: string): Promise<void> {
    await tx('readwrite', (s) => s.delete(id));
  },

  async list(): Promise<LocalRecordingRow[]> {
    const all = await tx<LocalRecordingRow[]>('readonly', (s) => s.getAll());
    return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async updateMeta(id: string, patch: Partial<RecordedTrack>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;
    const next: LocalRecordingRow = { ...existing, ...patch };
    await tx('readwrite', (s) => s.put(next));
  },

  async reset(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  },
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run services/recordings/localStore.test.ts`
Expected: PASS (4/4).

- [ ] **Step 7: Commit**

```bash
git add services/recordings/types.ts services/recordings/localStore.ts services/recordings/localStore.test.ts package.json package-lock.json
git commit -m "feat(recordings): IndexedDB local store for recorded audio"
```

---

## Task 2: Cloud sync HTTP client

**Files:**
- Create: `services/recordings/cloudSync.ts`
- Create: `services/recordings/cloudSync.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// services/recordings/cloudSync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloudSync } from './cloudSync';

const getIdToken = vi.fn().mockResolvedValue('test-token');

beforeEach(() => {
  vi.restoreAllMocks();
  getIdToken.mockClear();
});

describe('cloudSync.upload', () => {
  it('POSTs multipart with bearer token and meta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true, id: 'rec-1', cloudUrl: '/api/recordings/rec-1/audio', sizeBytes: 123 }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const blob = new Blob([new Uint8Array([1,2,3])], { type: 'audio/webm' });
    const res = await cloudSync.upload(
      { id: 'rec-1', kind: 'recording', title: 'T', durationSec: 1, mime: 'audio/webm', sizeBytes: 3, createdAt: 'x', syncState: 'uploading' },
      blob,
      { getIdToken }
    );
    expect(res.cloudUrl).toBe('/api/recordings/rec-1/audio');
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('/api/recordings');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers.Authorization).toBe('Bearer test-token');
    expect(call[1].body).toBeInstanceOf(FormData);
  });

  it('throws with server message on 4xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: false, error: 'too large' }),
      { status: 413, headers: { 'content-type': 'application/json' } }
    )));
    await expect(cloudSync.upload(
      { id: 'x', kind: 'recording', title: 't', durationSec: 0, mime: 'audio/webm', sizeBytes: 0, createdAt: 'x', syncState: 'uploading' },
      new Blob([]),
      { getIdToken }
    )).rejects.toThrow(/too large/);
  });
});

describe('cloudSync.list', () => {
  it('returns parsed recordings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true, recordings: [{ id: 'a', kind: 'recording', title: 'A', durationSec: 1, mime: 'audio/webm', sizeBytes: 1, createdAt: 'x', syncState: 'synced', cloudUrl: '/api/recordings/a/audio' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )));
    const out = await cloudSync.list({ getIdToken });
    expect(out).toHaveLength(1);
    expect(out[0].syncState).toBe('synced');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run services/recordings/cloudSync.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement cloudSync**

```ts
// services/recordings/cloudSync.ts
import type { RecordedTrack } from './types';

export interface AuthBridge { getIdToken(): Promise<string | null>; }

async function authHeader(auth: AuthBridge): Promise<Record<string, string>> {
  const token = await auth.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseOrThrow(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body;
}

export const cloudSync = {
  async upload(track: RecordedTrack, blob: Blob, auth: AuthBridge) {
    const form = new FormData();
    form.append('audio', blob, `${track.id}.webm`);
    form.append('meta', JSON.stringify({
      id: track.id,
      title: track.title,
      durationSec: track.durationSec,
      mime: track.mime,
      createdAt: track.createdAt,
    }));
    const res = await fetch('/api/recordings', {
      method: 'POST',
      headers: await authHeader(auth),
      body: form,
    });
    const body = await parseOrThrow(res);
    return { id: body.id as string, cloudUrl: body.cloudUrl as string, sizeBytes: body.sizeBytes as number };
  },

  async list(auth: AuthBridge): Promise<RecordedTrack[]> {
    const res = await fetch('/api/recordings', { headers: await authHeader(auth) });
    const body = await parseOrThrow(res);
    return body.recordings as RecordedTrack[];
  },

  async rename(id: string, title: string, auth: AuthBridge): Promise<void> {
    const res = await fetch(`/api/recordings/${id}`, {
      method: 'PATCH',
      headers: { ...(await authHeader(auth)), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    await parseOrThrow(res);
  },

  async remove(id: string, auth: AuthBridge): Promise<void> {
    const res = await fetch(`/api/recordings/${id}`, {
      method: 'DELETE',
      headers: await authHeader(auth),
    });
    await parseOrThrow(res);
  },

  async download(id: string, auth: AuthBridge): Promise<Blob> {
    const res = await fetch(`/api/recordings/${id}/audio`, { headers: await authHeader(auth) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  },
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run services/recordings/cloudSync.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add services/recordings/cloudSync.ts services/recordings/cloudSync.test.ts
git commit -m "feat(recordings): cloud sync HTTP client"
```

---

## Task 3: Server — SQLite schema + storage dir

**Files:**
- Modify: `server/src/db.js` (or equivalent schema file — locate at implementation time)
- Modify: `server/src/index.js` (constants section)

- [ ] **Step 1: Add recordings table migration**

Locate the existing `CREATE TABLE` block (where `sermons` is defined). Append:

```sql
CREATE TABLE IF NOT EXISTS recordings (
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
CREATE INDEX IF NOT EXISTS recordings_uid_idx ON recordings(firebase_uid, created_at DESC);
```

- [ ] **Step 2: Add RECORDINGS_DIR constant**

Near the existing `WORKSPACE_MEDIA_DIR` definition in `server/index.js`:

```js
const RECORDINGS_DIR = process.env.RECORDINGS_DIR
  || path.join(process.env.LUMINA_DATA_DIR || path.resolve(__dirname, '..'), 'recordings');
fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
```

- [ ] **Step 3: Boot server, confirm no schema errors**

Run: `npm run server` (or equivalent — check package.json)
Expected: server starts, `recordings` table exists (`.schema recordings` in sqlite CLI).

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "feat(server): add recordings table + storage dir"
```

---

## Task 4: Server — `/api/recordings` CRUD

**Files:**
- Modify: `server/index.js` (or matching routes file) — add endpoints near `/api/sermons`
- Create: `server/__tests__/recordings.test.js` if a server test harness exists; otherwise skip auto-tests and verify via curl.

- [ ] **Step 1: Add multer config for recordings**

Near the existing `sermonAudioUpload` multer config:

```js
const recordingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'];
    cb(null, allowed.some(t => file.mimetype.startsWith(t.split(';')[0])));
  },
});
```

- [ ] **Step 2: Implement POST /api/recordings**

```js
app.post('/api/recordings', requireActor, recordingUpload.single('audio'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'audio file required' });
    const meta = JSON.parse(req.body.meta || '{}');
    const { id, title, durationSec, mime, createdAt } = meta;
    if (!id || !title) return res.status(400).json({ ok: false, error: 'id + title required' });

    const uid = req.actor.uid;
    const ext = (mime || '').includes('mp4') ? 'm4a' : 'webm';
    const userDir = path.join(RECORDINGS_DIR, uid);
    fs.mkdirSync(userDir, { recursive: true });
    const filePath = path.join(userDir, `${id}.${ext}`);
    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    fs.writeFileSync(filePath, req.file.buffer);

    db.prepare(`INSERT OR REPLACE INTO recordings
      (id, firebase_uid, title, duration_sec, mime, size_bytes, sha256, file_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, uid, title, Number(durationSec) || 0, mime || 'audio/webm',
      req.file.size, sha256, filePath, createdAt || new Date().toISOString()
    );

    res.json({
      ok: true,
      id,
      cloudUrl: `/api/recordings/${id}/audio`,
      sizeBytes: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'upload failed' });
  }
});
```

- [ ] **Step 3: Implement GET /api/recordings (list)**

```js
app.get('/api/recordings', requireActor, (req, res) => {
  const rows = db.prepare(
    `SELECT id, title, duration_sec, mime, size_bytes, created_at
     FROM recordings WHERE firebase_uid = ? ORDER BY created_at DESC`
  ).all(req.actor.uid);
  res.json({
    ok: true,
    recordings: rows.map(r => ({
      id: r.id,
      kind: 'recording',
      title: r.title,
      durationSec: r.duration_sec,
      mime: r.mime,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
      syncState: 'synced',
      cloudUrl: `/api/recordings/${r.id}/audio`,
    })),
  });
});
```

- [ ] **Step 4: Implement GET /api/recordings/:id/audio (stream)**

```js
app.get('/api/recordings/:id/audio', requireActor, (req, res) => {
  const row = db.prepare(
    `SELECT file_path, mime, size_bytes FROM recordings WHERE id = ? AND firebase_uid = ?`
  ).get(req.params.id, req.actor.uid);
  if (!row) return res.status(404).json({ ok: false, error: 'not found' });
  res.setHeader('Content-Type', row.mime);
  res.setHeader('Content-Length', row.size_bytes);
  fs.createReadStream(row.file_path).pipe(res);
});
```

- [ ] **Step 5: Implement PATCH and DELETE**

```js
app.patch('/api/recordings/:id', requireActor, express.json(), (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ ok: false, error: 'title required' });
  const info = db.prepare(
    `UPDATE recordings SET title = ? WHERE id = ? AND firebase_uid = ?`
  ).run(title, req.params.id, req.actor.uid);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true });
});

app.delete('/api/recordings/:id', requireActor, (req, res) => {
  const row = db.prepare(
    `SELECT file_path FROM recordings WHERE id = ? AND firebase_uid = ?`
  ).get(req.params.id, req.actor.uid);
  if (!row) return res.status(404).json({ ok: false, error: 'not found' });
  db.prepare(`DELETE FROM recordings WHERE id = ?`).run(req.params.id);
  try { fs.unlinkSync(row.file_path); } catch { /* already gone */ }
  res.json({ ok: true });
});
```

- [ ] **Step 6: Smoke test with curl**

```bash
# Assuming dev token from firebase emulator or a seeded user:
TOKEN=$(./scripts/dev-token.sh)   # use existing tooling if present
curl -X POST http://localhost:8787/api/recordings \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@tests/fixtures/sample.webm;type=audio/webm" \
  -F 'meta={"id":"test-1","title":"Smoke","durationSec":3,"mime":"audio/webm","createdAt":"2026-04-21T00:00:00Z"}'

curl http://localhost:8787/api/recordings -H "Authorization: Bearer $TOKEN"
curl -o /tmp/out.webm http://localhost:8787/api/recordings/test-1/audio -H "Authorization: Bearer $TOKEN"
curl -X DELETE http://localhost:8787/api/recordings/test-1 -H "Authorization: Bearer $TOKEN"
```
Expected: POST returns `{ ok: true, id, cloudUrl, sizeBytes }`; list includes it; GET audio returns 200 + bytes; DELETE returns `{ ok: true }` and the file is gone from disk.

- [ ] **Step 7: Commit**

```bash
git add server/
git commit -m "feat(api): /api/recordings CRUD with multer + ownership checks"
```

---

## Task 5: `useRecordingLibrary` hook

**Files:**
- Create: `hooks/useRecordingLibrary.ts`
- Create: `hooks/useRecordingLibrary.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// hooks/useRecordingLibrary.test.tsx
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecordingLibrary } from './useRecordingLibrary';
import { localStore } from '../services/recordings/localStore';
import { cloudSync } from '../services/recordings/cloudSync';

vi.mock('../services/recordings/cloudSync', () => ({
  cloudSync: {
    upload: vi.fn(),
    list: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    download: vi.fn(),
  },
}));

const auth = { getIdToken: vi.fn().mockResolvedValue('tok') };

beforeEach(async () => {
  vi.clearAllMocks();
  await localStore.reset();
  (cloudSync.list as any).mockResolvedValue([]);
});

describe('useRecordingLibrary', () => {
  it('addLocal inserts a local_only track', async () => {
    const { result } = renderHook(() => useRecordingLibrary({ auth, signedIn: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const blob = new Blob([new Uint8Array([1,2,3])], { type: 'audio/webm' });

    await act(async () => {
      await result.current.addLocal(blob, { title: 'First', durationSec: 2, mime: 'audio/webm' });
    });

    expect(result.current.tracks).toHaveLength(1);
    expect(result.current.tracks[0].syncState).toBe('local_only');
  });

  it('syncToCloud uploads and flips state to synced', async () => {
    (cloudSync.upload as any).mockResolvedValue({ id: 'will-be-set', cloudUrl: '/api/recordings/X/audio', sizeBytes: 3 });
    const { result } = renderHook(() => useRecordingLibrary({ auth, signedIn: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const blob = new Blob([new Uint8Array([1,2,3])], { type: 'audio/webm' });
    let id = '';
    await act(async () => {
      id = await result.current.addLocal(blob, { title: 'X', durationSec: 1, mime: 'audio/webm' });
    });
    await act(async () => { await result.current.syncToCloud(id); });
    const track = result.current.tracks.find(t => t.id === id)!;
    expect(track.syncState).toBe('synced');
    expect(track.cloudUrl).toBe('/api/recordings/X/audio');
  });

  it('syncToCloud marks upload_failed on server error', async () => {
    (cloudSync.upload as any).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useRecordingLibrary({ auth, signedIn: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    let id = '';
    await act(async () => {
      id = await result.current.addLocal(new Blob([]), { title: 'X', durationSec: 1, mime: 'audio/webm' });
    });
    await act(async () => { await result.current.syncToCloud(id); });
    const track = result.current.tracks.find(t => t.id === id)!;
    expect(track.syncState).toBe('upload_failed');
    expect(track.lastError).toMatch(/boom/);
  });

  it('deleteRecording removes local and cloud', async () => {
    (cloudSync.upload as any).mockResolvedValue({ id: 'x', cloudUrl: '/api/recordings/x/audio', sizeBytes: 1 });
    (cloudSync.remove as any).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRecordingLibrary({ auth, signedIn: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    let id = '';
    await act(async () => {
      id = await result.current.addLocal(new Blob([]), { title: 'X', durationSec: 1, mime: 'audio/webm' });
      await result.current.syncToCloud(id);
    });
    await act(async () => { await result.current.deleteRecording(id); });
    expect(result.current.tracks).toHaveLength(0);
    expect(cloudSync.remove).toHaveBeenCalledWith(id, auth);
  });

  it('merges cloud list on mount for cross-device visibility', async () => {
    (cloudSync.list as any).mockResolvedValue([
      { id: 'cloud-1', kind: 'recording', title: 'Remote', durationSec: 5, mime: 'audio/webm', sizeBytes: 10, createdAt: '2026-04-01T00:00:00Z', syncState: 'synced', cloudUrl: '/api/recordings/cloud-1/audio' },
    ]);
    const { result } = renderHook(() => useRecordingLibrary({ auth, signedIn: true }));
    await waitFor(() => expect(result.current.tracks.length).toBe(1));
    expect(result.current.tracks[0].syncState).toBe('cloud_only');
  });
});
```

- [ ] **Step 2: Run tests (expect fail)**

Run: `npx vitest run hooks/useRecordingLibrary.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement hook**

```ts
// hooks/useRecordingLibrary.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { localStore } from '../services/recordings/localStore';
import { cloudSync, type AuthBridge } from '../services/recordings/cloudSync';
import type { RecordedTrack } from '../services/recordings/types';

export interface UseRecordingLibraryOptions {
  auth: AuthBridge;
  signedIn: boolean;
}

export interface RecordingLibrary {
  ready: boolean;
  tracks: RecordedTrack[];
  addLocal(blob: Blob, meta: { title: string; durationSec: number; mime: string }): Promise<string>;
  syncToCloud(id: string): Promise<void>;
  deleteRecording(id: string): Promise<void>;
  renameRecording(id: string, title: string): Promise<void>;
  getPlaybackUrl(id: string): Promise<string | null>;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useRecordingLibrary(opts: UseRecordingLibraryOptions): RecordingLibrary {
  const { auth, signedIn } = opts;
  const [tracks, setTracks] = useState<RecordedTrack[]>([]);
  const [ready, setReady] = useState(false);
  const objectUrls = useRef<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    const localRows = await localStore.list();
    const localById = new Map(localRows.map(r => [r.id, r]));
    let cloudList: RecordedTrack[] = [];
    if (signedIn) {
      try {
        cloudList = await cloudSync.list(auth);
      } catch { /* offline — keep local only */ }
    }
    const merged: RecordedTrack[] = [];
    const seen = new Set<string>();
    for (const row of localRows) {
      const cloudMatch = cloudList.find(c => c.id === row.id);
      merged.push(cloudMatch ? { ...row, syncState: 'synced', cloudUrl: cloudMatch.cloudUrl } : row);
      seen.add(row.id);
    }
    for (const c of cloudList) {
      if (!seen.has(c.id)) merged.push({ ...c, syncState: 'cloud_only' });
    }
    merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setTracks(merged);
    setReady(true);
  }, [auth, signedIn]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => () => {
    for (const url of objectUrls.current.values()) URL.revokeObjectURL(url);
    objectUrls.current.clear();
  }, []);

  const addLocal = useCallback(async (blob: Blob, meta: { title: string; durationSec: number; mime: string }) => {
    const track: RecordedTrack = {
      id: newId(),
      kind: 'recording',
      title: meta.title,
      durationSec: meta.durationSec,
      mime: meta.mime,
      sizeBytes: blob.size,
      createdAt: new Date().toISOString(),
      syncState: 'local_only',
    };
    await localStore.put(track, blob);
    await refresh();
    return track.id;
  }, [refresh]);

  const syncToCloud = useCallback(async (id: string) => {
    const row = await localStore.get(id);
    if (!row) throw new Error('recording not found locally');
    await localStore.updateMeta(id, { syncState: 'uploading', lastError: undefined });
    await refresh();
    try {
      const { cloudUrl } = await cloudSync.upload(row, row.blob, auth);
      await localStore.updateMeta(id, { syncState: 'synced', cloudUrl });
    } catch (err) {
      await localStore.updateMeta(id, { syncState: 'upload_failed', lastError: (err as Error).message });
    } finally {
      await refresh();
    }
  }, [auth, refresh]);

  const deleteRecording = useCallback(async (id: string) => {
    const row = await localStore.get(id);
    const wasSynced = row?.syncState === 'synced' || !row; // no row = cloud-only
    if (row) await localStore.delete(id);
    if (wasSynced && signedIn) {
      try { await cloudSync.remove(id, auth); } catch { /* ignore; user can retry */ }
    }
    const url = objectUrls.current.get(id);
    if (url) { URL.revokeObjectURL(url); objectUrls.current.delete(id); }
    await refresh();
  }, [auth, signedIn, refresh]);

  const renameRecording = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const row = await localStore.get(id);
    if (row) await localStore.updateMeta(id, { title: trimmed });
    if (signedIn && row?.syncState === 'synced') {
      try { await cloudSync.rename(id, trimmed, auth); } catch { /* ignore */ }
    }
    await refresh();
  }, [auth, signedIn, refresh]);

  const getPlaybackUrl = useCallback(async (id: string): Promise<string | null> => {
    const cached = objectUrls.current.get(id);
    if (cached) return cached;
    const row = await localStore.get(id);
    if (row) {
      const url = URL.createObjectURL(row.blob);
      objectUrls.current.set(id, url);
      return url;
    }
    if (signedIn) {
      try {
        const blob = await cloudSync.download(id, auth);
        const url = URL.createObjectURL(blob);
        objectUrls.current.set(id, url);
        return url;
      } catch { return null; }
    }
    return null;
  }, [auth, signedIn]);

  return { ready, tracks, addLocal, syncToCloud, deleteRecording, renameRecording, getPlaybackUrl };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run hooks/useRecordingLibrary.test.tsx`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add hooks/useRecordingLibrary.ts hooks/useRecordingLibrary.test.tsx
git commit -m "feat(recordings): useRecordingLibrary hook merging local + cloud"
```

---

## Task 6: Wire hook into App.tsx + thread props

**Files:**
- Modify: `App.tsx` — instantiate hook, pass to panels
- Modify: `components/SermonRecorderPanel.tsx` — accept new prop `onRecordingReady(blob, durationSec)` OR direct hook props
- Modify: `components/AudioLibrary.tsx` — accept new prop

- [ ] **Step 1: Find where Firebase auth state lives in App.tsx**

Run: `grep -n "firebase\|getIdToken\|currentUser" App.tsx | head -20`
Locate the existing `User` / `signedIn` state. Note the exact variable names.

- [ ] **Step 2: Add hook instantiation in App.tsx**

Below the auth state:

```tsx
import { useRecordingLibrary } from './hooks/useRecordingLibrary';

// Inside App component, near existing audio state:
const recordingAuth = useMemo(() => ({
  getIdToken: async () => {
    const user = getAuth().currentUser;
    return user ? await user.getIdToken() : null;
  },
}), []);
const recordingLibrary = useRecordingLibrary({
  auth: recordingAuth,
  signedIn: Boolean(currentUser), // adjust to actual variable name
});
```

- [ ] **Step 3: Pass library to SermonRecorderPanel and AudioLibrary**

At both render sites, pass `recordingLibrary={recordingLibrary}` as a prop.

- [ ] **Step 4: Add prop types to both components**

```tsx
// At top of SermonRecorderPanel.tsx and AudioLibrary.tsx
import type { RecordingLibrary } from '../hooks/useRecordingLibrary';

interface /* existing */ Props {
  // ...existing props
  recordingLibrary: RecordingLibrary;
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in the three modified files.

- [ ] **Step 6: Commit**

```bash
git add App.tsx components/SermonRecorderPanel.tsx components/AudioLibrary.tsx
git commit -m "feat(recordings): thread useRecordingLibrary through App"
```

---

## Task 7: Post-stop "Recording Saved" pill in SermonRecorderPanel

**Files:**
- Modify: `hooks/useSermonRecorder.ts` — expose the final Blob + duration on stop (if not already)
- Modify: `components/SermonRecorderPanel.tsx` — render pill, wire buttons
- Create: `components/SermonRecorderPanel.pill.test.tsx`

- [ ] **Step 1: Audit useSermonRecorder for final blob exposure**

Run: `grep -n "new Blob\|audioChunksRef\|onSave" hooks/useSermonRecorder.ts`
Confirm there's a path that yields `{ blob, durationSec }` after stop. If currently only transcribed, add an emitted callback or expose `lastRecording: { blob, durationSec, mime } | null` state.

- [ ] **Step 2: Add `lastRecording` state to useSermonRecorder**

In the stop handler where the final blob is assembled:

```ts
const finalBlob = new Blob(chunks, { type: mimeType });
const durationSec = (Date.now() - recordingStartedAtRef.current) / 1000;
setLastRecording({ blob: finalBlob, durationSec, mime: mimeType });
```

Export `lastRecording` and a `clearLastRecording()` from the hook's return value.

- [ ] **Step 3: Write pill component test**

```tsx
// components/SermonRecorderPanel.pill.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordingSavedPill } from './RecordingSavedPill';

describe('RecordingSavedPill', () => {
  const baseTrack = { id: 'r1', kind: 'recording' as const, title: 'Sermon — 2026-04-21', durationSec: 754, mime: 'audio/webm', sizeBytes: 4_200_000, createdAt: '2026-04-21T14:03:00Z', syncState: 'local_only' as const };

  it('shows duration, size, and Sync/Delete buttons', () => {
    render(<RecordingSavedPill track={baseTrack} signedIn canSync onSync={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()} onOpenInMixer={vi.fn()} />);
    expect(screen.getByText(/12:34/)).toBeInTheDocument();
    expect(screen.getByText(/4\.2 MB|4\.0 MB|4\.2 ?MB/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync to cloud/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('hides Sync button when signed out', () => {
    render(<RecordingSavedPill track={baseTrack} signedIn={false} canSync={false} onSync={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()} onOpenInMixer={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /sync to cloud/i })).not.toBeInTheDocument();
  });

  it('Delete requires two clicks (confirm)', async () => {
    const onDelete = vi.fn();
    render(<RecordingSavedPill track={baseTrack} signedIn canSync onSync={vi.fn()} onDelete={onDelete} onRename={vi.fn()} onOpenInMixer={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });

  it('Shows uploading spinner when state is uploading', () => {
    render(<RecordingSavedPill track={{ ...baseTrack, syncState: 'uploading' }} signedIn canSync onSync={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()} onOpenInMixer={vi.fn()} />);
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
  });

  it('Shows retry when upload_failed', () => {
    const onSync = vi.fn();
    render(<RecordingSavedPill track={{ ...baseTrack, syncState: 'upload_failed', lastError: 'network' }} signedIn canSync onSync={onSync} onDelete={vi.fn()} onRename={vi.fn()} onOpenInMixer={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onSync).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 4: Run tests (fail)**

Run: `npx vitest run components/SermonRecorderPanel.pill.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 5: Implement RecordingSavedPill**

```tsx
// components/RecordingSavedPill.tsx
import React, { useState } from 'react';
import type { RecordedTrack } from '../services/recordings/types';

interface Props {
  track: RecordedTrack;
  signedIn: boolean;
  canSync: boolean;
  onSync: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onOpenInMixer: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function RecordingSavedPill({ track, signedIn, canSync, onSync, onDelete, onRename, onOpenInMixer }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(track.title);

  const stateLabel = (() => {
    switch (track.syncState) {
      case 'local_only': return 'Saved locally';
      case 'uploading': return 'Uploading…';
      case 'synced': return 'Synced to cloud';
      case 'upload_failed': return `Upload failed${track.lastError ? `: ${track.lastError}` : ''}`;
      case 'cloud_only': return 'In cloud';
    }
  })();

  return (
    <div data-testid="recording-saved-pill" className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-900/50 bg-emerald-950/20 text-[10px] font-mono">
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { onRename(draft); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onRename(draft); setEditing(false); } }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-white font-semibold truncate hover:underline">
            {track.title}
          </button>
        )}
        <div className="text-[9px] text-zinc-400 truncate">
          {formatDuration(track.durationSec)} · {formatSize(track.sizeBytes)} · {stateLabel}
        </div>
      </div>
      {track.syncState === 'local_only' && signedIn && canSync && (
        <button onClick={onSync} className="px-2 py-1 rounded border border-emerald-700/60 text-emerald-300 hover:text-white hover:border-emerald-500 text-[9px] font-bold uppercase">Sync to Cloud</button>
      )}
      {track.syncState === 'upload_failed' && (
        <button onClick={onSync} className="px-2 py-1 rounded border border-amber-700/60 text-amber-300 hover:text-white hover:border-amber-500 text-[9px] font-bold uppercase">Retry</button>
      )}
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:text-red-300 hover:border-red-700 text-[9px] font-bold uppercase">Delete</button>
      ) : (
        <>
          <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:text-white text-[9px]">Cancel</button>
          <button onClick={onDelete} className="px-2 py-1 rounded border border-red-700 text-red-300 hover:text-white hover:bg-red-900/40 text-[9px] font-bold uppercase" aria-label="confirm delete">Confirm</button>
        </>
      )}
      <button onClick={onOpenInMixer} className="px-2 py-1 rounded border border-purple-900/60 bg-purple-950/20 text-purple-300 hover:text-white hover:border-purple-500 text-[9px] font-bold uppercase">Open in Mixer</button>
    </div>
  );
}
```

- [ ] **Step 6: Wire pill into SermonRecorderPanel**

Find where transcript is rendered. Above or below it, add:

```tsx
{lastRecording && latestSavedTrack && (
  <RecordingSavedPill
    track={latestSavedTrack}
    signedIn={recordingLibrary.signedIn ?? true}
    canSync
    onSync={() => recordingLibrary.syncToCloud(latestSavedTrack.id)}
    onDelete={() => recordingLibrary.deleteRecording(latestSavedTrack.id)}
    onRename={(title) => recordingLibrary.renameRecording(latestSavedTrack.id, title)}
    onOpenInMixer={onOpenAudioMixer /* lift a prop or use a callback */}
  />
)}
```

Ensure that when `lastRecording` is produced, the panel calls `recordingLibrary.addLocal(blob, meta)` exactly once and tracks the returned id so `latestSavedTrack` resolves.

- [ ] **Step 7: Run tests**

Run: `npx vitest run components/SermonRecorderPanel.pill.test.tsx`
Expected: PASS (5/5).

- [ ] **Step 8: Commit**

```bash
git add components/RecordingSavedPill.tsx components/SermonRecorderPanel.tsx hooks/useSermonRecorder.ts components/SermonRecorderPanel.pill.test.tsx
git commit -m "feat(sermon-recorder): post-stop Recording Saved pill with sync/delete"
```

---

## Task 8: AudioLibrary "My Recordings" section

**Files:**
- Modify: `components/AudioLibrary.tsx`
- Create: `components/AudioLibrary.recordings.test.tsx`

- [ ] **Step 1: Write failing test for recordings section**

```tsx
// components/AudioLibrary.recordings.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioLibrary } from './AudioLibrary';

const libraryFixture = {
  ready: true,
  tracks: [
    { id: 'r1', kind: 'recording' as const, title: 'Sunday', durationSec: 754, mime: 'audio/webm', sizeBytes: 4_200_000, createdAt: '2026-04-21T14:03:00Z', syncState: 'synced' as const, cloudUrl: '/api/recordings/r1/audio' },
    { id: 'r2', kind: 'recording' as const, title: 'Wed Bible Study', durationSec: 900, mime: 'audio/webm', sizeBytes: 5_000_000, createdAt: '2026-04-17T19:00:00Z', syncState: 'local_only' as const },
  ],
  addLocal: vi.fn(),
  syncToCloud: vi.fn(),
  deleteRecording: vi.fn(),
  renameRecording: vi.fn(),
  getPlaybackUrl: vi.fn().mockResolvedValue('blob:abc'),
};

describe('AudioLibrary — My Recordings section', () => {
  it('renders recordings alongside gospel tracks', () => {
    render(<AudioLibrary recordingLibrary={libraryFixture as any} {...({} as any)} />);
    expect(screen.getByText(/my recordings/i)).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Wed Bible Study')).toBeInTheDocument();
  });

  it('shows sync icon state for each recording', () => {
    render(<AudioLibrary recordingLibrary={libraryFixture as any} {...({} as any)} />);
    expect(screen.getByTestId('sync-icon-r1')).toHaveAttribute('data-state', 'synced');
    expect(screen.getByTestId('sync-icon-r2')).toHaveAttribute('data-state', 'local_only');
  });

  it('Delete on recording calls deleteRecording', async () => {
    render(<AudioLibrary recordingLibrary={libraryFixture as any} {...({} as any)} />);
    fireEvent.click(screen.getByTestId('recording-menu-r1'));
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(libraryFixture.deleteRecording).toHaveBeenCalledWith('r1'));
  });

  it('empty state shows helpful hint', () => {
    render(<AudioLibrary recordingLibrary={{ ...libraryFixture, tracks: [] } as any} {...({} as any)} />);
    expect(screen.getByText(/Recordings from the Sermon Recorder appear here/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests (fail)**

- [ ] **Step 3: Implement recordings section in AudioLibrary**

Render a new section above the existing gospel tracks list:

```tsx
<section data-testid="my-recordings">
  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">My Recordings</h3>
  {recordingLibrary.tracks.length === 0 ? (
    <div className="text-[11px] text-zinc-500 italic">Recordings from the Sermon Recorder appear here. Click "Open in Mixer" after stopping a recording.</div>
  ) : (
    <ul className="space-y-1">
      {recordingLibrary.tracks.map(t => (
        <RecordingRow
          key={t.id}
          track={t}
          onPlay={async () => {
            const url = await recordingLibrary.getPlaybackUrl(t.id);
            if (url) playRecording(url, t); /* hook into existing <audio> */
          }}
          onSync={() => recordingLibrary.syncToCloud(t.id)}
          onRename={(title) => recordingLibrary.renameRecording(t.id, title)}
          onDelete={() => recordingLibrary.deleteRecording(t.id)}
        />
      ))}
    </ul>
  )}
</section>
```

`RecordingRow` renders play button, title (dbl-click to rename), duration, sync icon (via `<SyncIcon state={track.syncState} data-testid={`sync-icon-${track.id}`} />`), and kebab menu.

- [ ] **Step 4: Run tests**

Expected: PASS (4/4).

- [ ] **Step 5: Manual smoke in browser**

```bash
npm run dev
```

1. Sign in.
2. Open Sermon Recorder, record 10 seconds, stop.
3. Pill appears. Click Open in Mixer.
4. Recording is in "My Recordings" with local_only icon.
5. Click Sync. Icon flips to synced.
6. Hard reload. Recording is still there.
7. Click Delete + Confirm. Gone from list; not on disk (`ls server/recordings/*`).

- [ ] **Step 6: Commit**

```bash
git add components/AudioLibrary.tsx components/AudioLibrary.recordings.test.tsx
git commit -m "feat(mixer): My Recordings section with sync + manage actions"
```

---

## Task 9: E2E coverage

**Files:**
- Create: `tests/e2e/recording-save-to-mixer.spec.ts`

- [ ] **Step 1: Write Playwright test**

```ts
// tests/e2e/recording-save-to-mixer.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sermon recording → Audio Mixer', () => {
  test('record, save locally, sync, reload, delete', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    // ...sign-in flow (use existing test helpers)

    await page.getByRole('tab', { name: /sermon recorder/i }).click();
    await page.getByRole('button', { name: /start/i }).click();
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: /stop/i }).click();

    const pill = page.getByTestId('recording-saved-pill');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText(/saved locally/i);

    await pill.getByRole('button', { name: /sync to cloud/i }).click();
    await expect(pill).toContainText(/synced to cloud/i, { timeout: 10_000 });

    await page.getByRole('tab', { name: /audio mixer/i }).click();
    await expect(page.getByTestId('my-recordings')).toContainText(/sermon/i);

    await page.reload();
    await page.getByRole('tab', { name: /audio mixer/i }).click();
    await expect(page.getByTestId('my-recordings')).toContainText(/sermon/i);

    const row = page.locator('[data-testid^="recording-row-"]').first();
    await row.getByTestId(/recording-menu-/).click();
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByTestId('my-recordings')).toContainText(/recordings from the sermon recorder/i);
  });
});
```

- [ ] **Step 2: Run E2E**

Run: `npx playwright test tests/e2e/recording-save-to-mixer.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/recording-save-to-mixer.spec.ts
git commit -m "test(recordings): e2e for record → save → sync → reload → delete"
```

---

## Task 10: Manual cross-device verification + docs

- [ ] **Step 1: Manual verification — web ↔ Electron parity**

1. Launch dev server; open Electron (`npm run electron:dev`) signed in as user A.
2. Record + Sync one sermon.
3. Close Electron. Open web build signed in as the same user A.
4. Mixer → My Recordings: the cloud-synced recording from Electron appears with `cloud_only` icon.
5. Click play — it streams from the server.
6. Click kebab → Download → icon flips to `synced`.
7. Sign out, sign in as user B on web. User A's recording is NOT in the list.

Record findings in the PR description (pass/fail per step).

- [ ] **Step 2: Add a one-paragraph blurb to `README.md` describing the new feature**

Add under an existing "Features" heading or equivalent:

```markdown
### Sermon recordings in the Audio Mixer
Stopping a sermon recording auto-saves it to your local Audio Mixer. When signed in, click **Sync to Cloud** to make it available across Electron and web for the same account. Rename, delete, and re-download from the mixer's **My Recordings** section.
```

- [ ] **Step 3: Commit + open PR**

```bash
git add README.md
git commit -m "docs: document sermon recordings in audio mixer"
git push -u origin dev
```

Open PR or merge as appropriate to project convention.
