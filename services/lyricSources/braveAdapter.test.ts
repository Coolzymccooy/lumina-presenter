import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../serverApi', () => ({
  getServerApiBaseCandidates: () => ['http://localhost:8787', 'https://api.example.test'],
  getServerApiBaseUrl: () => 'http://localhost:8787',
}));

import { searchWebForLyrics } from './braveAdapter';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function mockFetchJson(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    clone() { return this; },
    json: async () => body,
  }) as unknown as Response) as unknown as typeof fetch;
}

describe('searchWebForLyrics', () => {
  it('returns up to 5 results on success', async () => {
    mockFetchJson(200, {
      ok: true,
      data: {
        results: Array.from({ length: 8 }, (_, i) => ({
          title: `Song ${i}`,
          url: `https://naijalyrics.example/song-${i}`,
          domain: 'naijalyrics.example',
          snippet: 'Short snippet',
        })),
      },
    });
    const results = await searchWebForLyrics('Nathaniel Bassey Olowogbogboro');
    expect(results.length).toBe(5);
    expect(results[0].domain).toBe('naijalyrics.example');
  });

  it('returns empty array on miss', async () => {
    mockFetchJson(200, { ok: true, data: { results: [] } });
    expect(await searchWebForLyrics('nothing')).toEqual([]);
  });

  it('returns empty array on 503 (flag off)', async () => {
    mockFetchJson(503, { ok: false, error: 'FEATURE_DISABLED' });
    expect(await searchWebForLyrics('any')).toEqual([]);
  });

  it('clamps snippet to 40 words', async () => {
    const longSnippet = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    mockFetchJson(200, {
      ok: true,
      data: { results: [{ title: 't', url: 'https://x.example/y', domain: 'x.example', snippet: longSnippet }] },
    });
    const [r] = await searchWebForLyrics('q');
    expect(r.snippet.split(/\s+/).length).toBeLessThanOrEqual(40);
  });

  it('falls through to next candidate on 503 from local installer server', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async (url) => {
      calls += 1;
      const isLocal = String(url).startsWith('http://localhost:8787');
      if (isLocal) {
        return {
          ok: false,
          status: 503,
          headers: { get: () => 'application/json' },
          clone() { return this; },
          json: async () => ({ ok: false, error: 'BRAVE_API_KEY_MISSING' }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        clone() { return this; },
        json: async () => ({
          ok: true,
          data: {
            results: [{ title: 'Hit', url: 'https://prod.example.test/h', domain: 'prod.example.test', snippet: 'lyrics' }],
          },
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const results = await searchWebForLyrics('Way Maker Sinach');
    expect(calls).toBe(2);
    expect(results).toHaveLength(1);
    expect(results[0].domain).toBe('prod.example.test');
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
        clone() { return this; },
        json: async () => ({ ok: true, data: { results: [{ title: 'a', url: 'https://b.test/c', domain: 'b.test', snippet: 's' }] } }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const results = await searchWebForLyrics('q');
    expect(calls).toBe(2);
    expect(results).toHaveLength(1);
  });
});
