import type { LocalRecordingRow, RecordedTrack } from './types';

const DB_NAME = 'lumina-recordings';
const DB_VERSION = 1;
const STORE = 'recordings';

// Internal representation for storage (Blob converted to ArrayBuffer)
interface StoredRow extends Omit<LocalRecordingRow, 'blob'> {
  blob: { buffer: ArrayBuffer; type: string };
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

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const result = fn(store);
    let value: T;
    if (result instanceof Promise) {
      result.then((v) => {
        value = v;
      }, reject);
    } else {
      result.onsuccess = () => {
        value = result.result;
      };
      result.onerror = () => reject(result.error);
    }
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error);
  });
}

export const localStore = {
  async put(track: RecordedTrack, blob: Blob): Promise<void> {
    const buffer = await blob.arrayBuffer();
    const row: StoredRow = { ...track, blob: { buffer, type: blob.type } };
    try {
      await tx('readwrite', (s) => s.put(row));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        throw new Error('Not enough storage to save this recording. Free up space and try again.');
      }
      throw err;
    }
  },

  async get(id: string): Promise<LocalRecordingRow | undefined> {
    const row = await tx<StoredRow | undefined>('readonly', (s) => s.get(id));
    if (!row) return undefined;
    return { ...row, blob: new Blob([row.blob.buffer], { type: row.blob.type }) };
  },

  async delete(id: string): Promise<void> {
    await tx('readwrite', (s) => s.delete(id));
  },

  async list(): Promise<LocalRecordingRow[]> {
    const all = await tx<StoredRow[]>('readonly', (s) => s.getAll());
    return [...all]
      .map((row) => ({ ...row, blob: new Blob([row.blob.buffer], { type: row.blob.type }) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async updateMeta(id: string, patch: Partial<RecordedTrack>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;
    const next: LocalRecordingRow = { ...existing, ...patch };
    const buffer = await next.blob.arrayBuffer();
    const row: StoredRow = { ...next, blob: { buffer, type: next.blob.type } };
    await tx('readwrite', (s) => s.put(row));
  },

  async reset(): Promise<void> {
    await tx('readwrite', (s) => s.clear());
  },
};
