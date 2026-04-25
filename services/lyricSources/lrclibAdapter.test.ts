import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../serverApi', () => ({
  getServerApiBaseCandidates: () => ['http://localhost:8787', 'https://api.example.test'],
  getServerApiBaseUrl: () => 'http://localhost:8787',
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

  it('falls through to next candidate when first base returns 503', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async (url) => {
      calls += 1;
      const isLocal = String(url).startsWith('http://localhost:8787');
      if (isLocal) {
        return {
          ok: false,
          status: 503,
          headers: { get: () => 'application/json' },
          json: async () => ({ ok: false, error: 'FEATURE_DISABLED' }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          ok: true,
          data: { hit: { id: 42, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'Way maker...' } },
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const hit = await searchLrclib('Way Maker Sinach');
    expect(calls).toBe(2);
    expect(hit?.trackName).toBe('Way Maker');
  });

  it('falls through on network error to next candidate', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async (url) => {
      calls += 1;
      if (String(url).startsWith('http://localhost:8787')) {
        throw new Error('ECONNREFUSED');
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ ok: true, data: { hit: { id: 7, trackName: 'X', artistName: 'Y', plainLyrics: 'lyrics' } } }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const hit = await searchLrclib('q');
    expect(calls).toBe(2);
    expect(hit?.trackName).toBe('X');
  });
});
