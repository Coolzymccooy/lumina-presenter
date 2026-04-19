import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../serverApi', () => ({
  getServerApiBaseCandidates: () => ['http://localhost:3001'],
  getServerApiBaseUrl: () => 'http://localhost:3001',
}));

import { searchLrclib } from './lrclibAdapter';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchJson(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }) as unknown as Response) as unknown as typeof fetch;
}

describe('searchLrclib', () => {
  it('returns first hit on success', async () => {
    mockFetchJson(200, {
      ok: true,
      data: { hit: { id: 1, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'Way maker...' } },
    });
    const hit = await searchLrclib('Way Maker Sinach');
    expect(hit?.trackName).toBe('Way Maker');
    expect(hit?.plainLyrics).toContain('Way maker');
  });

  it('returns null on miss (200 + no data)', async () => {
    mockFetchJson(200, { ok: true, data: { hit: null } });
    const hit = await searchLrclib('unknown song');
    expect(hit).toBeNull();
  });

  it('returns null on server 503 (flag off)', async () => {
    mockFetchJson(503, { ok: false, error: 'FEATURE_DISABLED' });
    const hit = await searchLrclib('anything');
    expect(hit).toBeNull();
  });

  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof fetch;
    const hit = await searchLrclib('anything');
    expect(hit).toBeNull();
  });
});
