import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../serverApi', () => ({
  getServerApiBaseCandidates: () => ['http://localhost:3001'],
}));

import { searchTavilyForLyrics } from './tavilyAdapter';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function mockFetchJson(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
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
});
