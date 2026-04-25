import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../serverApi', () => ({
  getServerApiBaseCandidates: () => ['http://localhost:8787', 'https://api.example.test'],
}));

import { searchTavilyForLyrics } from './tavilyAdapter';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function mockFetchJson(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    clone() { return this; },
    json: async () => body,
  }) as unknown as Response) as unknown as typeof fetch;
}

describe('searchTavilyForLyrics', () => {
  it('maps source cards and strips unknown raw content fields', async () => {
    mockFetchJson(200, {
      ok: true,
      data: {
        results: [{
          title: 'Joy Overflow lyrics',
          url: 'https://example.com/joy',
          domain: 'example.com',
          snippet: 'Joy overflow in my heart',
          score: 0.82,
          raw_content: 'must not leak',
        }],
      },
    });
    const [result] = await searchTavilyForLyrics('Joy overflow');
    expect(result.provider).toBe('tavily');
    expect(result.score).toBe(0.82);
    expect(result).not.toHaveProperty('raw_content');
  });

  it('returns empty array on auth, rate limit, and server errors', async () => {
    for (const status of [401, 429, 500]) {
      mockFetchJson(status, { ok: false });
      expect(await searchTavilyForLyrics('anything')).toEqual([]);
    }
  });

  it('clamps snippets to 40 words', async () => {
    const longSnippet = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    mockFetchJson(200, {
      ok: true,
      data: { results: [{ title: 't', url: 'https://x.test/y', domain: 'x.test', snippet: longSnippet }] },
    });
    const [result] = await searchTavilyForLyrics('q');
    expect(result.snippet.split(/\s+/).length).toBeLessThanOrEqual(40);
  });

  it('falls through to next candidate when first base returns 503', async () => {
    // Desktop installer scenario: localhost:8787 has no API key, prod URL does.
    let calls = 0;
    globalThis.fetch = vi.fn(async (url) => {
      calls += 1;
      const isLocal = String(url).startsWith('http://localhost:8787');
      if (isLocal) {
        return {
          ok: false,
          status: 503,
          clone() { return this; },
          json: async () => ({ ok: false, error: 'TAVILY_API_KEY_MISSING' }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        clone() { return this; },
        json: async () => ({
          ok: true,
          data: {
            results: [{
              title: 'Way Maker — Sinach',
              url: 'https://prod.example.test/way-maker',
              domain: 'prod.example.test',
              snippet: 'Way maker miracle worker',
              score: 0.95,
            }],
          },
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const results = await searchTavilyForLyrics('Way Maker Sinach');
    expect(calls).toBe(2);
    expect(results).toHaveLength(1);
    expect(results[0].domain).toBe('prod.example.test');
    expect(results[0].provider).toBe('tavily');
  });

  it('falls through on network error then succeeds on next candidate', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async (url) => {
      calls += 1;
      if (String(url).startsWith('http://localhost:8787')) {
        throw new Error('ECONNREFUSED');
      }
      return {
        ok: true,
        status: 200,
        clone() { return this; },
        json: async () => ({ ok: true, data: { results: [{ title: 'a', url: 'https://b.test/c', domain: 'b.test', snippet: 's' }] } }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const results = await searchTavilyForLyrics('q');
    expect(calls).toBe(2);
    expect(results).toHaveLength(1);
  });
});
