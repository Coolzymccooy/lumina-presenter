import express from 'express';

const LRCLIB_ENDPOINT = 'https://lrclib.net/api/search';
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_WORDS = 40;

function isFlagOn(env) {
  const raw = String(env?.AI_WEB_LYRICS_FETCH || '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

function clampSnippet(snippet) {
  const words = String(snippet || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_SNIPPET_WORDS) return words.join(' ');
  return words.slice(0, MAX_SNIPPET_WORDS).join(' ') + '…';
}

async function fetchWithTimeout(url, init = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function createLyricsRouter(options = {}) {
  const env = options.env || process.env;
  const router = express.Router();

  router.post('/lrclib', async (req, res) => {
    if (!isFlagOn(env)) return res.status(503).json({ ok: false, error: 'FEATURE_DISABLED' });
    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ ok: false, error: 'QUERY_REQUIRED' });

    try {
      const url = `${LRCLIB_ENDPOINT}?q=${encodeURIComponent(query)}`;
      const upstream = await fetchWithTimeout(url, { method: 'GET', headers: { 'User-Agent': 'LuminaPresenter/1.0' } });
      if (!upstream.ok) return res.status(502).json({ ok: false, error: 'LRCLIB_UPSTREAM_ERROR' });
      const arr = await upstream.json().catch(() => []);
      const first = Array.isArray(arr) ? arr.find((row) => row && typeof row.plainLyrics === 'string' && row.plainLyrics.trim().length > 0) : null;
      if (!first) return res.status(200).json({ ok: true, data: { hit: null } });
      return res.status(200).json({
        ok: true,
        data: {
          hit: {
            id: first.id,
            trackName: first.trackName,
            artistName: first.artistName,
            albumName: first.albumName || undefined,
            plainLyrics: first.plainLyrics,
            syncedLyrics: first.syncedLyrics || null,
            duration: first.duration || null,
          },
        },
      });
    } catch (err) {
      return res.status(502).json({ ok: false, error: 'LRCLIB_FETCH_FAILED', message: String(err?.message || err) });
    }
  });

  router.post('/web-search', async (req, res) => {
    if (!isFlagOn(env)) return res.status(503).json({ ok: false, error: 'FEATURE_DISABLED' });
    const apiKey = String(env?.BRAVE_SEARCH_API_KEY || '').trim();
    if (!apiKey) return res.status(503).json({ ok: false, error: 'BRAVE_API_KEY_MISSING' });

    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ ok: false, error: 'QUERY_REQUIRED' });

    try {
      const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(query + ' lyrics')}&count=10`;
      const upstream = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
      });
      if (!upstream.ok) return res.status(502).json({ ok: false, error: 'BRAVE_UPSTREAM_ERROR' });
      const body = await upstream.json().catch(() => null);
      const raw = body?.web?.results;
      const results = Array.isArray(raw)
        ? raw
            .slice(0, MAX_RESULTS)
            .map((r) => ({
              title: String(r.title || '').trim(),
              url: String(r.url || '').trim(),
              domain: String(r.meta_url?.hostname || r.profile?.long_name || new URL(r.url || 'https://x').hostname).trim(),
              snippet: clampSnippet(r.description || ''),
            }))
            .filter((r) => r.title && r.url)
        : [];
      return res.status(200).json({ ok: true, data: { results } });
    } catch (err) {
      return res.status(502).json({ ok: false, error: 'BRAVE_FETCH_FAILED', message: String(err?.message || err) });
    }
  });

  return router;
}
