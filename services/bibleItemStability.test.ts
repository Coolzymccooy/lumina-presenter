import assert from 'node:assert/strict';
import test from 'node:test';

import { ItemType, type ServiceItem } from '../types.ts';
import {
  areBibleGeneratedItemsVisuallyEqual,
  isBibleGeneratedItem,
  mergeBibleGeneratedItem,
} from './bibleItemStability.ts';

const buildItem = (overrides: Partial<ServiceItem> = {}): ServiceItem => ({
  id: 'bible-existing',
  title: 'Exodus 1:1-2',
  type: ItemType.BIBLE,
  theme: {
    backgroundUrl: 'data:image/svg+xml;base64,AAA',
    mediaType: 'image',
    fontFamily: 'serif',
    textColor: '#ffffff',
    shadow: true,
    fontSize: 'large',
  },
  metadata: {
    source: 'bible',
    createdAt: 111,
    notes: 'keep me',
  },
  timerCue: {
    enabled: true,
    durationSec: 300,
  },
  slides: [
    {
      id: 'slide-1',
      content: 'Now these are the names...',
      label: 'Exodus 1:1 (KJV)',
      notes: 'slide note 1',
    },
    {
      id: 'slide-2',
      content: 'Reuben, Simeon, Levi...',
      label: 'Exodus 1:2 (KJV)',
      notes: 'slide note 2',
    },
  ],
  ...overrides,
});

test('mergeBibleGeneratedItem preserves existing slide identity for matching verses', () => {
  const existing = buildItem();
  const incoming = buildItem({
    id: 'bible-fresh',
    theme: {
      ...buildItem().theme,
      fontSize: 'xlarge',
    },
    slides: [
      {
        id: 'temp-a',
        content: 'Now these are the names...',
        label: 'Exodus 1:1 (KJV)',
        backgroundUrl: 'data:image/svg+xml;base64,BBB',
        mediaType: 'image',
      },
      {
        id: 'temp-b',
        content: 'Reuben, Simeon, Levi...',
        label: 'Exodus 1:2 (KJV)',
        backgroundUrl: 'data:image/svg+xml;base64,BBB',
        mediaType: 'image',
      },
    ],
  });

  const merged = mergeBibleGeneratedItem(existing, incoming);

  assert.equal(merged.id, existing.id);
  assert.equal(merged.slides[0]?.id, 'slide-1');
  assert.equal(merged.slides[1]?.id, 'slide-2');
  assert.equal(merged.slides[0]?.notes, 'slide note 1');
  assert.equal(merged.timerCue?.durationSec, 300);
  assert.equal(merged.metadata?.notes, 'keep me');
  assert.equal(merged.theme.fontSize, 'xlarge');
});

test('areBibleGeneratedItemsVisuallyEqual ignores regenerated ids', () => {
  const existing = buildItem();
  const regenerated = buildItem({
    id: 'bible-fresh',
    slides: existing.slides.map((slide, index) => ({
      ...slide,
      id: `fresh-${index}`,
    })),
  });

  assert.equal(areBibleGeneratedItemsVisuallyEqual(existing, regenerated), true);
});

test('isBibleGeneratedItem recognizes bible-origin schedule entries', () => {
  assert.equal(isBibleGeneratedItem(buildItem()), true);
  assert.equal(isBibleGeneratedItem(buildItem({ type: ItemType.SCRIPTURE })), true);
  assert.equal(isBibleGeneratedItem({
    ...buildItem(),
    type: ItemType.ANNOUNCEMENT,
    metadata: {
      source: 'manual',
    },
  }), false);
});
