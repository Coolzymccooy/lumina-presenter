import assert from 'node:assert/strict';
import test from 'node:test';

import { isAppHostedMediaUrl, isProjectionSafeBackgroundUrl } from './mediaUrlStability.ts';

test('workspace and visual media served by Lumina remain projection-safe', () => {
  assert.equal(isAppHostedMediaUrl('http://localhost:8787/media/workspaces/ws/slide-001.png'), true);
  assert.equal(isAppHostedMediaUrl('https://luminalive.co.uk/media/vis/ws/deck/slide-001.png'), true);
  assert.equal(isProjectionSafeBackgroundUrl('http://localhost:8787/media/workspaces/ws/slide-001.png'), true);
  assert.equal(isProjectionSafeBackgroundUrl('https://luminalive.co.uk/media/vis/ws/deck/slide-001.png'), true);
});

test('arbitrary remote media remains non-projection-safe until localized', () => {
  assert.equal(isAppHostedMediaUrl('https://images.pexels.com/photos/123/example.jpeg'), false);
  assert.equal(isProjectionSafeBackgroundUrl('https://images.pexels.com/photos/123/example.jpeg'), false);
});
