// electron/clipboardLyricWatcher.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClipboardLyricWatcher } from './clipboardLyricWatcher.cjs';

function makeClipboard(initial = '') {
  let current = initial;
  return {
    readText: () => current,
    writeText: (t) => { current = t; },
    _set: (t) => { current = t; },
  };
}

const VALID_LYRICS = `Way maker, miracle worker
Promise keeper, light in the darkness
My God, that is who you are
My God, that is who you are
Even when I don't see it, you're working
Even when I don't feel it, you're working
You never stop, you never stop working`;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('clipboardLyricWatcher', () => {
  it('does not fire before arm()', () => {
    const cb = makeClipboard(VALID_LYRICS);
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 5000, onCaptured });
    vi.advanceTimersByTime(500);
    expect(onCaptured).not.toHaveBeenCalled();
    w.dispose();
  });

  it('captures lyrics after arm() when clipboard changes', () => {
    const cb = makeClipboard('baseline');
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 5000, onCaptured });
    w.arm('https://source.example/song');
    cb._set(VALID_LYRICS);
    vi.advanceTimersByTime(150);
    expect(onCaptured).toHaveBeenCalledTimes(1);
    expect(onCaptured.mock.calls[0][0]).toMatchObject({ text: VALID_LYRICS, sourceUrl: 'https://source.example/song' });
    w.dispose();
  });

  it('auto-disarms after TTL', () => {
    const cb = makeClipboard('baseline');
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 1000, onCaptured });
    w.arm('https://source.example/song');
    vi.advanceTimersByTime(1500);
    cb._set(VALID_LYRICS);
    vi.advanceTimersByTime(200);
    expect(onCaptured).not.toHaveBeenCalled();
    w.dispose();
  });

  it('ignores clipboard changes that fail the heuristic', () => {
    const cb = makeClipboard('baseline');
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 5000, onCaptured });
    w.arm('https://source.example/song');
    cb._set('short text');
    vi.advanceTimersByTime(200);
    expect(onCaptured).not.toHaveBeenCalled();
    w.dispose();
  });

  it('disarm() stops captures', () => {
    const cb = makeClipboard('baseline');
    const onCaptured = vi.fn();
    const w = createClipboardLyricWatcher({ clipboard: cb, pollIntervalMs: 100, ttlMs: 5000, onCaptured });
    w.arm('https://source.example/song');
    w.disarm();
    cb._set(VALID_LYRICS);
    vi.advanceTimersByTime(200);
    expect(onCaptured).not.toHaveBeenCalled();
    w.dispose();
  });
});
