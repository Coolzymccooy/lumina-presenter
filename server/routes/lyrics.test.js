import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { createLyricsRouter, scoreLrclibMatch } from './lyrics.js';

const originalFetch = globalThis.fetch;

function makeApp(env) {
  const app = express();
  app.use(express.json());
  app.use('/api/lyrics', createLyricsRouter({ env }));
  return app;
}

async function callJson(app, path, body) {
  const { default: request } = await import('supertest');
  return request(app).post(path).send(body).set('Content-Type', 'application/json');
}

beforeEach(() => {
  globalThis.fetch = originalFetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

async function callGet(app, path) {
  const { default: request } = await import('supertest');
  return request(app).get(path);
}

describe('GET /api/lyrics/health', () => {
  it('reports flagOn=false and both keys absent on a bare env', async () => {
    const app = makeApp({});
    const res = await callGet(app, '/api/lyrics/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual({ flagOn: false, hasBraveKey: false, hasTavilyKey: false });
  });

  it('reports flagOn=true and hasTavilyKey=true when both are configured', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true', TAVILY_API_KEY: 'tvly-XXX' });
    const res = await callGet(app, '/api/lyrics/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ flagOn: true, hasBraveKey: false, hasTavilyKey: true });
  });

  it('never echoes actual key values', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: '1', TAVILY_API_KEY: 'tvly-secret', BRAVE_SEARCH_API_KEY: 'brv-secret' });
    const res = await callGet(app, '/api/lyrics/health');
    expect(JSON.stringify(res.body)).not.toContain('tvly-secret');
    expect(JSON.stringify(res.body)).not.toContain('brv-secret');
    expect(res.body.data.hasBraveKey).toBe(true);
    expect(res.body.data.hasTavilyKey).toBe(true);
  });

  it('treats whitespace-only key as absent', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true', TAVILY_API_KEY: '   ' });
    const res = await callGet(app, '/api/lyrics/health');
    expect(res.body.data.hasTavilyKey).toBe(false);
  });
});

describe('POST /api/lyrics/lrclib', () => {
  it('returns 503 when feature flag is off', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'false' });
    const res = await callJson(app, '/api/lyrics/lrclib', { query: 'Way Maker' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('FEATURE_DISABLED');
  });

  it('returns first hit when flag on and LRCLIB has match', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ([{ id: 1, trackName: 'Way Maker', artistName: 'Sinach', plainLyrics: 'Way maker...' }]),
    }));
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/lrclib', { query: 'Way Maker' });
    expect(res.status).toBe(200);
    expect(res.body.data.hit.trackName).toBe('Way Maker');
  });

  it('rejects weak LRCLIB false positives so later providers can run', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ([{ id: 9, trackName: 'Joy', artistName: 'Tree63', plainLyrics: 'Joy lyrics...' }]),
    }));
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/lrclib', { query: 'Joy overflow' });
    expect(res.status).toBe(200);
    expect(res.body.data.hit).toBeNull();
  });

  it('returns 400 when query missing', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/lrclib', {});
    expect(res.status).toBe(400);
  });

  it('returns 400 when query exceeds 500 chars', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/lrclib', { query: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('QUERY_TOO_LONG');
  });

  it('does not leak raw error message on upstream failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('socket hang up at internal-host:5432'); });
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/lrclib', { query: 'Way Maker' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('LRCLIB_FETCH_FAILED');
    expect(res.body.message).toBeUndefined();
  });
});

describe('scoreLrclibMatch', () => {
  it('scores exact title matches highly', () => {
    expect(scoreLrclibMatch('Jehovah Reigns', {
      trackName: 'Jehovah Reigns',
      artistName: 'Solomon Lange',
      plainLyrics: 'lyrics',
    })).toBeGreaterThanOrEqual(0.9);
  });

  it('rejects artist-only and one-token false positives', () => {
    expect(scoreLrclibMatch('casting crowns', {
      trackName: 'What If His People Prayed',
      artistName: 'Casting Crowns',
      plainLyrics: 'lyrics',
    })).toBe(0);
    expect(scoreLrclibMatch('Joy overflow', {
      trackName: 'Joy',
      artistName: 'Tree63',
      plainLyrics: 'lyrics',
    })).toBe(0);
  });
});

describe('POST /api/lyrics/web-search', () => {
  it('returns 503 when Brave API key missing', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/web-search', { query: 'any' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('BRAVE_API_KEY_MISSING');
  });

  it('returns 503 when flag off', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'false', BRAVE_SEARCH_API_KEY: 'x' });
    const res = await callJson(app, '/api/lyrics/web-search', { query: 'any' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('FEATURE_DISABLED');
  });

  it('returns 400 when query exceeds 500 chars', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true', BRAVE_SEARCH_API_KEY: 'x' });
    const res = await callJson(app, '/api/lyrics/web-search', { query: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('QUERY_TOO_LONG');
  });

  it('does not leak raw error message on upstream failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('ECONNREFUSED 10.0.0.1:443'); });
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true', BRAVE_SEARCH_API_KEY: 'x' });
    const res = await callJson(app, '/api/lyrics/web-search', { query: 'any' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('BRAVE_FETCH_FAILED');
    expect(res.body.message).toBeUndefined();
  });

  it('returns mapped results on success', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        web: {
          results: [
            { title: 'Song A', url: 'https://naijalyrics.example/a', meta_url: { hostname: 'naijalyrics.example' }, description: 'Lyrics snippet' },
          ],
        },
      }),
    }));
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true', BRAVE_SEARCH_API_KEY: 'test-key' });
    const res = await callJson(app, '/api/lyrics/web-search', { query: 'Olowogbogboro' });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].domain).toBe('naijalyrics.example');
    expect(res.body.data.results[0].provider).toBe('brave');
  });
});

describe('POST /api/lyrics/tavily-search', () => {
  it('returns 503 when Tavily API key missing', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true' });
    const res = await callJson(app, '/api/lyrics/tavily-search', { query: 'any' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('TAVILY_API_KEY_MISSING');
  });

  it('returns 503 when flag off', async () => {
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'false', TAVILY_API_KEY: 'x' });
    const res = await callJson(app, '/api/lyrics/tavily-search', { query: 'any' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('FEATURE_DISABLED');
  });

  it('maps Tavily results without leaking raw_content', async () => {
    globalThis.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init.body));
      expect(body.include_raw_content).toBeUndefined();
      expect(body.safe_search).toBeUndefined();
      expect(body.include_favicon).toBeUndefined();
      return {
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          results: [
            {
              title: 'Joy Overflow - Joe Praize Lyrics',
              url: 'https://africangospellyrics.example/joy-overflow',
              content: 'Joy overflow source summary',
              raw_content: 'full page lyrics must not leak',
              score: 0.9,
            },
          ],
        }),
      };
    });
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true', TAVILY_API_KEY: 'test-key' });
    const res = await callJson(app, '/api/lyrics/tavily-search', { query: 'Joy overflow' });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0]).toMatchObject({
      title: 'Joy Overflow - Joe Praize Lyrics',
      domain: 'africangospellyrics.example',
      provider: 'tavily',
      score: 0.9,
      detectedTitle: 'Joy Overflow',
      detectedArtist: 'Joe Praize',
    });
    expect(JSON.stringify(res.body)).not.toContain('full page lyrics must not leak');
  });

  it('does not leak raw error message on upstream failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('ECONNREFUSED secret-host:443'); });
    const app = makeApp({ AI_WEB_LYRICS_FETCH: 'true', TAVILY_API_KEY: 'x' });
    const res = await callJson(app, '/api/lyrics/tavily-search', { query: 'any' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('TAVILY_FETCH_FAILED');
    expect(res.body.message).toBeUndefined();
  });
});
