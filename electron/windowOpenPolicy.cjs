'use strict';

/**
 * Decide how the main BrowserWindow should respond to a window.open() call
 * from the renderer.
 *
 * - https://...  → deny (the caller should hand the URL to shell.openExternal
 *                  so it opens in the user's default browser)
 * - about:blank  → allow (renderer-managed popouts: timer, output window,
 *                  stage display — they inject content via document.write
 *                  on a same-origin window). Other about: URLs (about:flags,
 *                  about:settings, etc.) stay denied.
 * - anything else → deny (file://, data:, javascript:, etc.)
 *
 * Returns one of:
 *   { kind: 'allow' }                — let the renderer create the popup
 *   { kind: 'deny-open-external' }   — caller should shell.openExternal(url)
 *                                       and then deny the popup
 *   { kind: 'deny' }                  — refuse outright
 */
function decideWindowOpen(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    return { kind: 'deny' };
  }

  if (parsed.protocol === 'https:') {
    return { kind: 'deny-open-external' };
  }

  if (parsed.protocol === 'about:' && parsed.pathname === 'blank') {
    return { kind: 'allow' };
  }

  return { kind: 'deny' };
}

module.exports = { decideWindowOpen };
