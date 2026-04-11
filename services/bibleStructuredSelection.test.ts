import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStructuredBibleDraft,
  buildStructuredBibleRange,
  isStructuredBibleRangeReady,
} from './bibleStructuredSelection.ts';

test('structured bible range stays incomplete until To verse is selected', () => {
  assert.equal(isStructuredBibleRangeReady('Proverbs', null), false);
  assert.equal(buildStructuredBibleRange('Proverbs', 1, 7, null), '');
  assert.equal(
    buildStructuredBibleDraft('Proverbs', 1, 7, null),
    'Proverbs 1:7 - Select destination verse',
  );
});

test('structured bible range builds the final reference once To verse is selected', () => {
  assert.equal(isStructuredBibleRangeReady('Proverbs', 9), true);
  assert.equal(buildStructuredBibleRange('Proverbs', 1, 7, 9), 'Proverbs 1:7-9');
  assert.equal(buildStructuredBibleDraft('Proverbs', 1, 7, 9), 'Proverbs 1:7-9');
});
