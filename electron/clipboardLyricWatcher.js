// electron/clipboardLyricWatcher.js
import { looksLikeLyrics } from '../services/lyricSources/lyricHeuristic.ts';

const DEFAULT_POLL_MS = 1000;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function createClipboardLyricWatcher(opts) {
  const clipboard = opts.clipboard;
  const pollIntervalMs = opts.pollIntervalMs || DEFAULT_POLL_MS;
  const ttlMs = opts.ttlMs || DEFAULT_TTL_MS;
  const onCaptured = opts.onCaptured;
  const isLyrics = opts.isLyrics || looksLikeLyrics;

  let state = 'IDLE';
  let sourceUrl = '';
  let baseline = '';
  let lastCaptured = '';
  let pollTimer = null;
  let ttlTimer = null;

  function clearTimers() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (ttlTimer) { clearTimeout(ttlTimer); ttlTimer = null; }
  }

  function disarm() {
    state = 'IDLE';
    sourceUrl = '';
    baseline = '';
    clearTimers();
  }

  function arm(url) {
    disarm();
    state = 'ARMED';
    sourceUrl = String(url || '');
    baseline = safeRead();
    pollTimer = setInterval(poll, pollIntervalMs);
    ttlTimer = setTimeout(disarm, ttlMs);
  }

  function safeRead() {
    try { return String(clipboard.readText() || ''); } catch { return ''; }
  }

  function poll() {
    if (state !== 'ARMED') return;
    const current = safeRead();
    if (!current || current === baseline || current === lastCaptured) return;
    if (!isLyrics(current)) return;
    lastCaptured = current;
    const payload = { text: current, sourceUrl };
    disarm();
    try { onCaptured && onCaptured(payload); } catch { /* swallow */ }
  }

  return { arm, disarm, dispose: disarm, getState: () => state };
}
