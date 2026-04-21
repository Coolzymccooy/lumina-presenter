import type { LocalRecordingRow, RecordedTrack } from './types';

const DB_NAME = 'lumina-recordings';
const DB_VERSION = 1;
const STORE = 'recordings';

// Helper to convert Blob to a serializable form for storage
async function serializeBlob(blob: Blob): Promise<{ buffer: ArrayBuffer; type: string }> {
  const buffer = await blob.arrayBuffer();
  return { buffer, type: blob.type };
}

// Helper to reconstruct Blob from serialized form
function deserializeBlob(serialized: { buffer: ArrayBuffer; type: string }): Blob {
  return new Blob([serialized.buffer], { type: serialized.type });
}

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

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface StoredRow extends Omit<LocalRecordingRow, 'blob'> {
  blob: { buffer: ArrayBuffer; type: string };
}

export const localStore = {
  async put(track: RecordedTrack, blob: Blob): Promise<void> {
    const serialized = await serializeBlob(blob);
    const row: StoredRow = { ...track, blob: serialized };
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    await reqToPromise(store.put(row));
  },

  async get(id: string): Promise<LocalRecordingRow | undefined> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const result = await reqToPromise<StoredRow | undefined>(store.get(id));
    if (!result) return undefined;
    const blob = deserializeBlob(result.blob);
    return { ...result, blob };
  },

  async delete(id: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    await reqToPromise(store.delete(id));
  },

  async list(): Promise<LocalRecordingRow[]> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const all = await reqToPromise<StoredRow[]>(store.getAll());
    return [...all]
      .map((row) => ({ ...row, blob: deserializeBlob(row.blob) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async updateMeta(id: string, patch: Partial<RecordedTrack>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;
    const next: LocalRecordingRow = { ...existing, ...patch };
    const serialized = await serializeBlob(next.blob);
    const row: StoredRow = { ...next, blob: serialized };
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    await reqToPromise(store.put(row));
  },

  async reset(): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    await reqToPromise(store.clear());
  },
};
