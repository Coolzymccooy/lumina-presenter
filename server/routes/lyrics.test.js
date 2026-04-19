import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { createLyricsRouter } from './lyrics.js';

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
  });
});
