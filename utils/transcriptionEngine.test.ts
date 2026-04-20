import { describe, it, expect } from 'vitest';
import { resolveTranscriptionEngine } from './transcriptionEngine';

describe('resolveTranscriptionEngine', () => {
  it('returns "disabled" when auto visionary is off', () => {
    expect(resolveTranscriptionEngine({ autoEnabled: false, isOnline: true })).toBe('disabled');
    expect(resolveTranscriptionEngine({ autoEnabled: false, isOnline: false })).toBe('disabled');
  });

  it('returns "cloud" when enabled and online', () => {
    expect(resolveTranscriptionEngine({ autoEnabled: true, isOnline: true })).toBe('cloud');
  });

  it('returns "browser_stt" when enabled and offline', () => {
    expect(resolveTranscriptionEngine({ autoEnabled: true, isOnline: false })).toBe('browser_stt');
  });
});
