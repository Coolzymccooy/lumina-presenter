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
