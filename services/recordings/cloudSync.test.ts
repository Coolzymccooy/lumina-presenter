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
