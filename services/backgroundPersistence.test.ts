import assert from 'node:assert/strict';
import test from 'node:test';

import { getBackgroundSnapshotFromItem } from './backgroundPersistence.ts';
import { ItemType, type ServiceItem, type Slide } from '../types.ts';

const buildItem = (): ServiceItem => ({
  id: 'item-1',
  title: 'Media Item',
  type: ItemType.ANNOUNCEMENT,
  slides: [],
  theme: {
    backgroundUrl: '',
    mediaType: 'image',
    fontFamily: 'sans-serif',
    textColor: '#ffffff',
    shadow: true,
    fontSize: 'medium',
  },
  metadata: {
    backgroundSource: 'user',
    backgroundSourceUrl: 'https://example.com/first-slide.jpg',
    backgroundFallbackUrl: 'local://first-slide',
    backgroundFallbackMediaType: 'image',
    backgroundProvider: 'workspace-upload',
    backgroundCategory: 'Imported',
    backgroundTitle: 'First Slide',
  },
});

test('explicit slide backgrounds ignore item-level background provenance', () => {
  const item = buildItem();
  const slide: Slide = {
    id: 'slide-2',
    label: 'Slide 2',
    content: '',
    backgroundUrl: 'https://example.com/second-slide.jpg',
    mediaType: 'image',
  };

  const snapshot = getBackgroundSnapshotFromItem(item, slide);
  assert.equal(snapshot?.backgroundUrl, 'https://example.com/second-slide.jpg');
  assert.equal(snapshot?.mediaType, 'image');
  assert.equal(snapshot?.backgroundSourceUrl, 'https://example.com/second-slide.jpg');
  assert.equal(snapshot?.backgroundFallbackUrl, undefined);
  assert.equal(snapshot?.backgroundProvider, undefined);
  assert.equal(snapshot?.backgroundCategory, undefined);
  assert.equal(snapshot?.backgroundTitle, undefined);
});

test('item-level backgrounds still use item metadata when slide has no explicit background', () => {
  const item = {
    ...buildItem(),
    theme: {
      ...buildItem().theme,
      backgroundUrl: 'local://theme-bg',
    },
  };

  const snapshot = getBackgroundSnapshotFromItem(item, null);
  assert.deepEqual(snapshot, {
    backgroundUrl: 'local://theme-bg',
    mediaType: 'image',
    backgroundFallbackUrl: 'local://first-slide',
    backgroundFallbackMediaType: 'image',
    backgroundSourceUrl: 'https://example.com/first-slide.jpg',
    backgroundProvider: 'workspace-upload',
    backgroundCategory: 'Imported',
    backgroundTitle: 'First Slide',
  });
});
