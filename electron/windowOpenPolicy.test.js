import { describe, it, expect } from 'vitest';
import { decideWindowOpen } from './windowOpenPolicy.cjs';

describe('decideWindowOpen', () => {
  describe('about:blank — renderer-managed popouts', () => {
    it('allows about:blank so the timer popout, output window, and stage display can open', () => {
      // Regression: in production-packaged Electron the timer popout was being
      // denied by setWindowOpenHandler, breaking it for desktop users.
      expect(decideWindowOpen('about:blank')).toEqual({ kind: 'allow' });
    });

    it('still denies non-blank about: URLs (about:flags, about:settings, etc.)', () => {
      expect(decideWindowOpen('about:flags')).toEqual({ kind: 'deny' });
      expect(decideWindowOpen('about:settings')).toEqual({ kind: 'deny' });
      expect(decideWindowOpen('about:config')).toEqual({ kind: 'deny' });
    });
  });

  describe('https — external links', () => {
    it('returns deny-open-external for https URLs so the caller forwards them to shell.openExternal', () => {
      expect(decideWindowOpen('https://github.com/Coolzymccooy/lumina-presenter')).toEqual({
        kind: 'deny-open-external',
      });
    });

    it('treats https with a port the same way', () => {
      expect(decideWindowOpen('https://example.com:8443/page')).toEqual({
        kind: 'deny-open-external',
      });
    });
  });

  describe('hostile / unsupported schemes', () => {
    it.each([
      'file:///etc/passwd',
      'data:text/html,<script>alert(1)</script>',
      'javascript:alert(1)',
      'vbscript:msgbox(1)',
      'http://insecure.example.com',
      'ftp://example.com/file',
      '',
      'not a url',
    ])('denies %s', (url) => {
      expect(decideWindowOpen(url)).toEqual({ kind: 'deny' });
    });
  });

  describe('input shape robustness', () => {
    it('denies null / undefined / non-string input', () => {
      // @ts-expect-error - testing defensive behaviour
      expect(decideWindowOpen(null)).toEqual({ kind: 'deny' });
      // @ts-expect-error - testing defensive behaviour
      expect(decideWindowOpen(undefined)).toEqual({ kind: 'deny' });
      // @ts-expect-error - testing defensive behaviour
      expect(decideWindowOpen({})).toEqual({ kind: 'deny' });
    });
  });
});
