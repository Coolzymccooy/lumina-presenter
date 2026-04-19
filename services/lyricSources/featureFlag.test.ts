import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWebLyricsFetchEnabled } from './featureFlag';

afterEach(() => { vi.unstubAllEnvs(); });

describe('isWebLyricsFetchEnabled', () => {
  it('returns false by default', () => {
    vi.stubEnv('VITE_AI_WEB_LYRICS_FETCH', '');
    expect(isWebLyricsFetchEnabled()).toBe(false);
  });

  it('returns true when env is "true"', () => {
    vi.stubEnv('VITE_AI_WEB_LYRICS_FETCH', 'true');
    expect(isWebLyricsFetchEnabled()).toBe(true);
  });

  it('returns true when env is "1"', () => {
    vi.stubEnv('VITE_AI_WEB_LYRICS_FETCH', '1');
    expect(isWebLyricsFetchEnabled()).toBe(true);
  });

  it('returns false for unexpected value', () => {
    vi.stubEnv('VITE_AI_WEB_LYRICS_FETCH', 'maybe');
    expect(isWebLyricsFetchEnabled()).toBe(false);
  });
});
