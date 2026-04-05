const DB_NAME = 'LuminaMediaDB';
const STORE_NAME = 'assets';
const SAVED_BACKGROUND_STORE_NAME = 'saved_backgrounds';
const DB_VERSION = 2;

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

export interface SavedBackgroundAsset {
  id: string;
  localUrl: string;
  name: string;
  title: string;
  mediaType: 'image' | 'video';
  provider: string;
  category: string;
  sourceUrl?: string;
  attribution?: string;
  contentHash?: string;
  mimeType?: string;
  createdAt: number;
  lastUsedAt: number;
}

export interface SavedBackgroundRegistrationInput {
  localUrl: string;
  mediaType: 'image' | 'video';
  name?: string;
  title?: string;
  provider?: string;
  category?: string;
  sourceUrl?: string;
  attribution?: string;
  contentHash?: string;
  mimeType?: string;
}

export interface SavedBackgroundFilters {
  category?: string;
  provider?: string;
  mediaType?: 'image' | 'video';
}

interface StoredMediaRecord {
  name?: unknown;
  type?: unknown;
  buffer?: unknown;
}

interface StoredBackgroundRecord {
  localUrl?: unknown;
  name?: unknown;
  title?: unknown;
  mediaType?: unknown;
  provider?: unknown;
  category?: unknown;
  sourceUrl?: unknown;
  attribution?: unknown;
  contentHash?: unknown;
  mimeType?: unknown;
  createdAt?: unknown;
  lastUsedAt?: unknown;
}

const getMediaKind = (mimeType: string): LocalMediaKind => {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  return 'other';
};

const randomId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const localMediaIdFromUrl = (localUrl: string) => {
  const trimmed = trimString(localUrl);
  return trimmed.startsWith('local://') ? trimmed.replace('local://', '') : '';
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

const normalizeStoredSavedBackground = (id: string, stored: unknown): SavedBackgroundAsset | null => {
  if (!stored || typeof stored !== 'object') return null;
  const record = stored as StoredBackgroundRecord;
  const localUrl = trimString(record.localUrl);
  if (!localUrl.startsWith('local://')) return null;
  const mediaType = record.mediaType === 'video' ? 'video' : 'image';
  const title = trimString(record.title) || trimString(record.name) || 'Saved Background';
  const createdAt = typeof record.createdAt === 'number' && Number.isFinite(record.createdAt) ? record.createdAt : Date.now();
  const lastUsedAt = typeof record.lastUsedAt === 'number' && Number.isFinite(record.lastUsedAt) ? record.lastUsedAt : createdAt;
  return {
    id,
    localUrl,
    name: trimString(record.name) || title,
    title,
    mediaType,
    provider: trimString(record.provider) || 'used',
    category: trimString(record.category) || 'Used',
    sourceUrl: trimString(record.sourceUrl) || undefined,
    attribution: trimString(record.attribution) || undefined,
    contentHash: trimString(record.contentHash) || undefined,
    mimeType: trimString(record.mimeType) || undefined,
    createdAt,
    lastUsedAt,
  };
};

const cacheMediaAsset = (asset: LocalMediaAsset) => {
  blobCache.set(asset.id, asset.url);
  mediaInfoCache.set(asset.id, asset);
  return asset;
};

const createSavedBackgroundStore = (db: IDBDatabase, transaction: IDBTransaction | null) => {
  const store = db.objectStoreNames.contains(SAVED_BACKGROUND_STORE_NAME)
    ? transaction?.objectStore(SAVED_BACKGROUND_STORE_NAME) || null
    : db.createObjectStore(SAVED_BACKGROUND_STORE_NAME, { keyPath: 'id' });
  if (!store) return;
  if (!store.indexNames.contains('by_localUrl')) store.createIndex('by_localUrl', 'localUrl', { unique: false });
  if (!store.indexNames.contains('by_sourceUrl')) store.createIndex('by_sourceUrl', 'sourceUrl', { unique: false });
  if (!store.indexNames.contains('by_contentHash')) store.createIndex('by_contentHash', 'contentHash', { unique: false });
  if (!store.indexNames.contains('by_provider')) store.createIndex('by_provider', 'provider', { unique: false });
  if (!store.indexNames.contains('by_category')) store.createIndex('by_category', 'category', { unique: false });
  if (!store.indexNames.contains('by_lastUsedAt')) store.createIndex('by_lastUsedAt', 'lastUsedAt', { unique: false });
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
      createSavedBackgroundStore(db, request.transaction || null);
    };
  });
};

const saveMediaWithId = async (file: File): Promise<{ localUrl: string; id: string }> => {
  const buffer = await file.arrayBuffer();
  const db = await initDB();
  const id = randomId('media');

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
      cacheMediaAsset({
        id,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        kind: getMediaKind(file.type || 'application/octet-stream'),
        url: objectUrl,
      });
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve({ localUrl: `local://${id}`, id });
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

export const saveMedia = async (file: File): Promise<string> => {
  const saved = await saveMediaWithId(file);
  return saved.localUrl;
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

const getStoreIndexMatches = async (store: IDBObjectStore, indexName: string, value: string): Promise<SavedBackgroundAsset[]> => {
  if (!value || !store.indexNames.contains(indexName)) return [];
  return new Promise((resolve, reject) => {
    const request = store.index(indexName).getAll(value);
    request.onsuccess = () => {
      const matches = Array.isArray(request.result)
        ? request.result
          .map((record) => normalizeStoredSavedBackground(String((record as { id?: unknown })?.id || ''), record))
          .filter((record): record is SavedBackgroundAsset => !!record)
        : [];
      resolve(matches);
    };
    request.onerror = () => reject(request.error);
  });
};

const getAllSavedBackgroundsFromStore = async (store: IDBObjectStore): Promise<SavedBackgroundAsset[]> => {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const records = Array.isArray(request.result)
        ? request.result
          .map((record) => normalizeStoredSavedBackground(String((record as { id?: unknown })?.id || ''), record))
          .filter((record): record is SavedBackgroundAsset => !!record)
        : [];
      resolve(records.sort((left, right) => right.lastUsedAt - left.lastUsedAt));
    };
    request.onerror = () => reject(request.error);
  });
};

const sha256Hex = async (buffer: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
};

export const findSavedBackgroundByLocalUrl = async (localUrl: string): Promise<SavedBackgroundAsset | null> => {
  const trimmedUrl = trimString(localUrl);
  if (!trimmedUrl.startsWith('local://')) return null;
  const db = await initDB();
  const transaction = db.transaction(SAVED_BACKGROUND_STORE_NAME, 'readonly');
  const store = transaction.objectStore(SAVED_BACKGROUND_STORE_NAME);
  const matches = await getStoreIndexMatches(store, 'by_localUrl', trimmedUrl);
  return matches.sort((left, right) => right.lastUsedAt - left.lastUsedAt)[0] || null;
};

export const findSavedBackgroundBySourceUrl = async (sourceUrl: string): Promise<SavedBackgroundAsset | null> => {
  const trimmedSource = trimString(sourceUrl);
  if (!trimmedSource) return null;
  const db = await initDB();
  const transaction = db.transaction(SAVED_BACKGROUND_STORE_NAME, 'readonly');
  const store = transaction.objectStore(SAVED_BACKGROUND_STORE_NAME);
  const matches = await getStoreIndexMatches(store, 'by_sourceUrl', trimmedSource);
  return matches.sort((left, right) => right.lastUsedAt - left.lastUsedAt)[0] || null;
};

export const findSavedBackgroundByContentHash = async (contentHash: string): Promise<SavedBackgroundAsset | null> => {
  const trimmedHash = trimString(contentHash);
  if (!trimmedHash) return null;
  const db = await initDB();
  const transaction = db.transaction(SAVED_BACKGROUND_STORE_NAME, 'readonly');
  const store = transaction.objectStore(SAVED_BACKGROUND_STORE_NAME);
  const matches = await getStoreIndexMatches(store, 'by_contentHash', trimmedHash);
  return matches.sort((left, right) => right.lastUsedAt - left.lastUsedAt)[0] || null;
};

export const registerSavedBackground = async (input: SavedBackgroundRegistrationInput): Promise<SavedBackgroundAsset | null> => {
  const localUrl = trimString(input.localUrl);
  if (!localUrl.startsWith('local://')) return null;

  const now = Date.now();
  const sourceUrl = trimString(input.sourceUrl);
  const contentHash = trimString(input.contentHash);
  const mediaType = input.mediaType === 'video' ? 'video' : 'image';
  const fallbackTitle = trimString(input.title) || trimString(input.name) || 'Saved Background';

  const existing =
    await findSavedBackgroundBySourceUrl(sourceUrl)
    || await findSavedBackgroundByContentHash(contentHash)
    || await findSavedBackgroundByLocalUrl(localUrl);

  const next: SavedBackgroundAsset = existing
    ? {
      ...existing,
      localUrl: existing.localUrl || localUrl,
      name: trimString(input.name) || existing.name || fallbackTitle,
      title: trimString(input.title) || existing.title || fallbackTitle,
      mediaType,
      provider: trimString(input.provider) || existing.provider || 'used',
      category: trimString(input.category) || existing.category || 'Used',
      sourceUrl: sourceUrl || existing.sourceUrl,
      attribution: trimString(input.attribution) || existing.attribution,
      contentHash: contentHash || existing.contentHash,
      mimeType: trimString(input.mimeType) || existing.mimeType,
      createdAt: existing.createdAt || now,
      lastUsedAt: now,
    }
    : {
      id: randomId('bg'),
      localUrl,
      name: trimString(input.name) || fallbackTitle,
      title: trimString(input.title) || fallbackTitle,
      mediaType,
      provider: trimString(input.provider) || 'used',
      category: trimString(input.category) || 'Used',
      sourceUrl: sourceUrl || undefined,
      attribution: trimString(input.attribution) || undefined,
      contentHash: contentHash || undefined,
      mimeType: trimString(input.mimeType) || undefined,
      createdAt: now,
      lastUsedAt: now,
    };

  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SAVED_BACKGROUND_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(SAVED_BACKGROUND_STORE_NAME);
    const request = store.put(next);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || request.error);
    transaction.onabort = () => reject(transaction.error || new Error('Saved background transaction aborted.'));
  });
  return next;
};

export const saveBackgroundAsset = async (
  file: File,
  input: Omit<SavedBackgroundRegistrationInput, 'localUrl' | 'mediaType' | 'contentHash' | 'mimeType'> & { mediaType?: 'image' | 'video' },
): Promise<SavedBackgroundAsset | null> => {
  const buffer = await file.arrayBuffer();
  const contentHash = await sha256Hex(buffer);
  const sourceUrl = trimString(input.sourceUrl);
  const existing =
    await findSavedBackgroundBySourceUrl(sourceUrl)
    || await findSavedBackgroundByContentHash(contentHash);
  if (existing) {
    return await registerSavedBackground({
      ...input,
      localUrl: existing.localUrl,
      mediaType: input.mediaType === 'video' ? 'video' : 'image',
      contentHash,
      mimeType: file.type,
    });
  }

  const localUrl = await saveMedia(new File([buffer], file.name, { type: file.type }));
  return await registerSavedBackground({
    ...input,
    localUrl,
    mediaType: input.mediaType === 'video' ? 'video' : 'image',
    contentHash,
    mimeType: file.type,
  });
};

export const markSavedBackgroundUsed = async (localUrl: string): Promise<SavedBackgroundAsset | null> => {
  const existing = await findSavedBackgroundByLocalUrl(localUrl);
  if (!existing) return null;
  return await registerSavedBackground({
    localUrl: existing.localUrl,
    mediaType: existing.mediaType,
    name: existing.name,
    title: existing.title,
    provider: existing.provider,
    category: existing.category,
    sourceUrl: existing.sourceUrl,
    attribution: existing.attribution,
    contentHash: existing.contentHash,
    mimeType: existing.mimeType,
  });
};

export const listSavedBackgrounds = async (filters: SavedBackgroundFilters = {}): Promise<SavedBackgroundAsset[]> => {
  const db = await initDB();
  const transaction = db.transaction(SAVED_BACKGROUND_STORE_NAME, 'readonly');
  const store = transaction.objectStore(SAVED_BACKGROUND_STORE_NAME);
  const items = await getAllSavedBackgroundsFromStore(store);
  const category = trimString(filters.category).toLowerCase();
  const provider = trimString(filters.provider).toLowerCase();
  return items.filter((item) => {
    if (filters.mediaType && item.mediaType !== filters.mediaType) return false;
    if (category && item.category.toLowerCase() !== category) return false;
    if (provider && item.provider.toLowerCase() !== provider) return false;
    return true;
  });
};

export const clearMediaCache = () => {
  blobCache.forEach((url) => URL.revokeObjectURL(url));
  blobCache.clear();
  mediaInfoCache.clear();
};

export const isLocalMediaUrl = (value: string) => trimString(value).startsWith('local://');
export const getLocalMediaId = (localUrl: string) => localMediaIdFromUrl(localUrl);
