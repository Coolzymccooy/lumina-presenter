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
    const wasSynced = row?.syncState === 'synced' || !row;
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
