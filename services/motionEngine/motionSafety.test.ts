import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMotionUrl,
  hasMotionScene,
  isRegisteredMotionUrl,
  normalizeMotionSceneId,
  normalizeMotionUrl,
} from './index.ts';

test('registered motion scenes and urls are recognized', () => {
  assert.equal(hasMotionScene('sermon-clean'), true);
  assert.equal(isRegisteredMotionUrl(buildMotionUrl('sermon-clean')), true);
});

test('invalid motion scenes fall back to sermon-clean', () => {
  assert.equal(normalizeMotionSceneId('missing-scene', 'sermon-clean'), 'sermon-clean');
  assert.equal(normalizeMotionUrl('motion://missing-scene', 'sermon-clean'), buildMotionUrl('sermon-clean'));
});
