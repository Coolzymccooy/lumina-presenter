
const DB_NAME = 'LuminaMediaDB';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

// In-memory cache for resolved Blob URLs
const blobCache = new Map<string, string>();
const mediaInfoCache = new Map<string, LocalMediaAsset>();

export type LocalMediaKind = 'image' | 'video' | 'other';

export interface LocalMediaAsset {
  id: string;
  name: string;
  mimeType: string;
  kind: LocalMediaKind;
  url: string;
}

export interface LocalMediaBinary {
  id: string;
  name: string;
  mimeType: string;
  kind: LocalMediaKind;
  buffer: ArrayBuffer;
}

interface StoredMediaRecord {
  name?: unknown;
  type?: unknown;
  buffer?: unknown;
}

const getMediaKind = (mimeType: string): LocalMediaKind => {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  return 'other';
};

const toArrayBuffer = (value: unknown): ArrayBuffer | null => {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  if (value && typeof value === 'object' && 'buffer' in (value as Record<string, unknown>)) {
    return toArrayBuffer((value as { buffer?: unknown }).buffer);
  }
  return null;
};

const normalizeStoredMedia = (id: string, stored: unknown): LocalMediaAsset | null => {
  if (stored instanceof Blob || stored instanceof File) {
    const mimeType = stored.type || 'application/octet-stream';
    const url = URL.createObjectURL(stored);
    return {
      id,
      name: stored instanceof File ? stored.name : '',
      mimeType,
      kind: getMediaKind(mimeType),
      url,
    };
  }

  if (!stored || typeof stored !== 'object') return null;
  const record = stored as StoredMediaRecord;
  const buffer = toArrayBuffer(record.buffer);
  if (!buffer) return null;
  const mimeType = typeof record.type === 'string' && record.type.trim()
    ? record.type
    : 'application/octet-stream';
  const blob = new Blob([buffer], { type: mimeType });
  return {
    id,
    name: typeof record.name === 'string' ? record.name : '',
    mimeType,
    kind: getMediaKind(mimeType),
    url: URL.createObjectURL(blob),
  };
};

const normalizeStoredBinary = async (id: string, stored: unknown): Promise<LocalMediaBinary | null> => {
  if (stored instanceof Blob || stored instanceof File) {
    const mimeType = stored.type || 'application/octet-stream';
    return {
      id,
      name: stored instanceof File ? stored.name : '',
      mimeType,
      kind: getMediaKind(mimeType),
      buffer: await stored.arrayBuffer(),
    };
  }

  if (!stored || typeof stored !== 'object') return null;
  const record = stored as StoredMediaRecord;
  const buffer = toArrayBuffer(record.buffer);
  if (!buffer) return null;
  const mimeType = typeof record.type === 'string' && record.type.trim()
    ? record.type
    : 'application/octet-stream';
  return {
    id,
    name: typeof record.name === 'string' ? record.name : '',
    mimeType,
    kind: getMediaKind(mimeType),
    buffer,
  };
};

const cacheMediaAsset = (asset: LocalMediaAsset) => {
  blobCache.set(asset.id, asset.url);
  mediaInfoCache.set(asset.id, asset);
  return asset;
};

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveMedia = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const db = await initDB();
  const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const payload = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      buffer,
    };
    const request = store.put(payload, id);
    const objectUrl = URL.createObjectURL(file);

    request.onsuccess = () => {
        // Cache immediately so current window can render without a second fetch.
        cacheMediaAsset({
          id,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          kind: getMediaKind(file.type || 'application/octet-stream'),
          url: objectUrl,
        });
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(`local://${id}`);
    transaction.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        blobCache.delete(id);
        mediaInfoCache.delete(id);
        reject(transaction.error || request.error);
    };
    transaction.onabort = () => {
        URL.revokeObjectURL(objectUrl);
        blobCache.delete(id);
        mediaInfoCache.delete(id);
        reject(transaction.error || new Error('Media save transaction aborted.'));
    };
  });
};

export const getMediaAsset = async (localUrl: string): Promise<LocalMediaAsset | null> => {
  if (!localUrl.startsWith('local://')) return null;
  const id = localUrl.replace('local://', '');

  const cachedAsset = mediaInfoCache.get(id);
  if (cachedAsset) return cachedAsset;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
        const asset = normalizeStoredMedia(id, request.result);
        if (!asset) {
          resolve(null);
          return;
        }
        resolve(cacheMediaAsset(asset));
    };
    request.onerror = () => reject(request.error);
  });
};

export const getMedia = async (localUrl: string): Promise<string | null> => {
  const asset = await getMediaAsset(localUrl);
  return asset?.url || null;
};

export const getMediaBinary = async (localUrl: string): Promise<LocalMediaBinary | null> => {
  if (!localUrl.startsWith('local://')) return null;
  const id = localUrl.replace('local://', '');
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      void normalizeStoredBinary(id, request.result).then(resolve).catch(reject);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getCachedMediaAsset = (localUrl: string): LocalMediaAsset | null => {
    if (!localUrl.startsWith('local://')) return null;
    const id = localUrl.replace('local://', '');
    return mediaInfoCache.get(id) || null;
};

// Synchronous accessor for cache to prevent render flashes
export const getCachedMedia = (localUrl: string): string | null => {
    if (!localUrl.startsWith('local://')) return null;
    const id = localUrl.replace('local://', '');
    return blobCache.get(id) || null;
};

export const clearMediaCache = () => {
    blobCache.forEach(url => URL.revokeObjectURL(url));
    blobCache.clear();
    mediaInfoCache.clear();
};
