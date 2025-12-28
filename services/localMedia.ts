
const DB_NAME = 'LuminaMediaDB';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

// In-memory cache for resolved Blob URLs
const blobCache = new Map<string, string>();

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
  const db = await initDB();
  const id = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file, id);

    request.onsuccess = () => {
        // Cache immediately upon save
        const objectUrl = URL.createObjectURL(file);
        blobCache.set(id, objectUrl);
        resolve(`local://${id}`);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getMedia = async (localUrl: string): Promise<string | null> => {
  if (!localUrl.startsWith('local://')) return null;
  const id = localUrl.replace('local://', '');

  // 1. Check Cache
  if (blobCache.has(id)) {
      return blobCache.get(id) || null;
  }

  // 2. Fetch from DB
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
        const result = request.result;
        if (result instanceof Blob || result instanceof File) {
            const objectUrl = URL.createObjectURL(result);
            blobCache.set(id, objectUrl);
            resolve(objectUrl);
        } else {
            resolve(null);
        }
    };
    request.onerror = () => reject(request.error);
  });
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
};
