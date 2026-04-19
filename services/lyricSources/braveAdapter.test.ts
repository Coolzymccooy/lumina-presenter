import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../serverApi', () => ({
  getServerApiBaseCandidates: () => ['http://localhost:3001'],
  getServerApiBaseUrl: () => 'http://localhost:3001',
}));

import { searchWebForLyrics } from './braveAdapter';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function mockFetchJson(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
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
});
