import express from 'express';

const LRCLIB_ENDPOINT = 'https://lrclib.net/api/search';
const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_WORDS = 40;
const MAX_QUERY_LEN = 500;

function isFlagOn(env) {
  const raw = String(env?.AI_WEB_LYRICS_FETCH || '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

function clampSnippet(snippet) {
  const words = String(snippet || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_SNIPPET_WORDS) return words.join(' ');
  return `${words.slice(0, MAX_SNIPPET_WORDS).join(' ')}...`;
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenize(value) {
  return normalizeSearchText(value).split(/\s+/).filter((token) => token.length > 2);
}

export function scoreLrclibMatch(query, row) {
  if (!row || typeof row.plainLyrics !== 'string' || !row.plainLyrics.trim()) return 0;
  const q = normalizeSearchText(query);
  const title = normalizeSearchText(row.trackName);
  const artist = normalizeSearchText(row.artistName);
  if (!q || !title) return 0;
  if (title === q) return 1;
  if (title.length >= 6 && q.includes(title)) return 0.92;

  const queryTokens = tokenize(q);
  const titleTokens = tokenize(title);
  const artistTokens = tokenize(artist);
  if (!queryTokens.length || !titleTokens.length) return 0;

  const queryTokenSet = new Set(queryTokens);
  const titleOverlap = titleTokens.filter((token) => queryTokenSet.has(token)).length;
  const queryOverlap = queryTokens.filter((token) => titleTokens.includes(token)).length;
  const titleRatio = titleOverlap / titleTokens.length;
  const queryRatio = queryOverlap / queryTokens.length;
  const artistOverlap = artistTokens.filter((token) => queryTokenSet.has(token)).length;

  if (titleTokens.length === 1 && title !== q) {
    return artistOverlap > 0 && queryRatio >= 0.8 ? 0.75 : 0;
  }
  if (titleRatio >= 0.8 && queryRatio >= 0.6) return 0.85;
  if (titleRatio >= 0.55 && queryRatio >= 0.45 && artistOverlap > 0) return 0.72;
  return 0;
}

function findBestLrclibHit(query, rows) {
  if (!Array.isArray(rows)) return null;
  const ranked = rows
    .map((row) => ({ row, score: scoreLrclibMatch(query, row) }))
    .filter((entry) => entry.score >= 0.7)
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.row || null;
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function inferTitleParts(title) {
  const clean = String(title || '').replace(/\s+lyrics?\b.*$/i, '').trim();
  const parts = clean.split(/\s+[|-]\s+|\s+by\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { detectedTitle: parts[0], detectedArtist: parts.slice(1).join(' - ') };
  return { detectedTitle: clean || undefined, detectedArtist: undefined };
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
    if (query.length > MAX_QUERY_LEN) return res.status(400).json({ ok: false, error: 'QUERY_TOO_LONG' });

    try {
      const url = `${LRCLIB_ENDPOINT}?q=${encodeURIComponent(query)}`;
      const upstream = await fetchWithTimeout(url, { method: 'GET', headers: { 'User-Agent': 'LuminaPresenter/1.0' } });
      if (!upstream.ok) return res.status(502).json({ ok: false, error: 'LRCLIB_UPSTREAM_ERROR' });
      const arr = await upstream.json().catch(() => []);
      const first = findBestLrclibHit(query, arr);
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
      console.error('[lyrics/lrclib] upstream fetch failed', err);
      return res.status(502).json({ ok: false, error: 'LRCLIB_FETCH_FAILED' });
    }
  });

  router.post('/web-search', async (req, res) => {
    if (!isFlagOn(env)) return res.status(503).json({ ok: false, error: 'FEATURE_DISABLED' });
    const apiKey = String(env?.BRAVE_SEARCH_API_KEY || '').trim();
    if (!apiKey) return res.status(503).json({ ok: false, error: 'BRAVE_API_KEY_MISSING' });

    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ ok: false, error: 'QUERY_REQUIRED' });
    if (query.length > MAX_QUERY_LEN) return res.status(400).json({ ok: false, error: 'QUERY_TOO_LONG' });

    try {
      const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(`${query} lyrics`)}&count=10`;
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
              domain: String(r.meta_url?.hostname || r.profile?.long_name || getHostname(r.url)).trim(),
              snippet: clampSnippet(r.description || ''),
              provider: 'brave',
            }))
            .filter((r) => r.title && r.url)
        : [];
      return res.status(200).json({ ok: true, data: { results } });
    } catch (err) {
      console.error('[lyrics/web-search] upstream fetch failed', err);
      return res.status(502).json({ ok: false, error: 'BRAVE_FETCH_FAILED' });
    }
  });

  router.post('/tavily-search', async (req, res) => {
    if (!isFlagOn(env)) return res.status(503).json({ ok: false, error: 'FEATURE_DISABLED' });
    const apiKey = String(env?.TAVILY_API_KEY || '').trim();
    if (!apiKey) return res.status(503).json({ ok: false, error: 'TAVILY_API_KEY_MISSING' });

    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ ok: false, error: 'QUERY_REQUIRED' });
    if (query.length > MAX_QUERY_LEN) return res.status(400).json({ ok: false, error: 'QUERY_TOO_LONG' });

    try {
      const upstream = await fetchWithTimeout(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: `${query} lyrics`,
          search_depth: 'basic',
          max_results: 8,
          include_answer: false,
        }),
      }, 12_000);
      if (!upstream.ok) return res.status(502).json({ ok: false, error: 'TAVILY_UPSTREAM_ERROR' });
      const body = await upstream.json().catch(() => null);
      const raw = Array.isArray(body?.results) ? body.results : [];
      const results = raw
        .slice(0, MAX_RESULTS)
        .map((r) => {
          const url = String(r.url || '').trim();
          const title = String(r.title || '').trim();
          const parts = inferTitleParts(title);
          return {
            title,
            url,
            domain: String(getHostname(url) || r.domain || '').trim(),
            snippet: clampSnippet(r.content || ''),
            provider: 'tavily',
            score: typeof r.score === 'number' ? r.score : undefined,
            ...parts,
          };
        })
        .filter((r) => r.title && r.url);
      return res.status(200).json({ ok: true, data: { results } });
    } catch (err) {
      console.error('[lyrics/tavily-search] upstream fetch failed', err);
      return res.status(502).json({ ok: false, error: 'TAVILY_FETCH_FAILED' });
    }
  });

  return router;
}
