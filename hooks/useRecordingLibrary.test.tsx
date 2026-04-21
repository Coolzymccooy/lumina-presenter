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
