import test from 'node:test';
import assert from 'node:assert/strict';
import { getLayoutPreset } from './presets/index.ts';
import { normalizeFrame } from './utils/frameMath.ts';
import { buildStructuredSlide, getRenderableElements } from './utils/slideHydration.ts';
import { PROGRAM_MEDIA_PRESENTATION_FILTER, shouldUseScriptureReadingPanel } from './render/backgroundTone.ts';
import type { Slide } from '../../types.ts';

test('legacy slides hydrate into a single visible body element', () => {
  const slide: Slide = {
    id: 'legacy-1',
    label: 'Legacy Slide',
    content: 'Legacy body copy',
  };

  const elements = getRenderableElements(slide, null);
  assert.equal(elements.length, 1);
  assert.equal(elements[0]?.type, 'text');
  assert.equal(elements[0]?.role, 'body');
  assert.equal(elements[0]?.content, 'Legacy body copy');
  assert.equal(elements[0]?.visible, true);
});

test('offering split preset builds four structured text blocks', () => {
  const preset = getLayoutPreset('offering-split');
  const elements = preset.createElements();

  assert.equal(preset.id, 'offering-split');
  assert.equal(elements.length, 4);
  assert.deepEqual(
    elements.map((element) => element.name),
    ['Offering Title', 'Offering Body', 'Project Title', 'Project Body'],
  );
});

test('scripture reference preset uses medium-sized projector-friendly text', () => {
  const preset = getLayoutPreset('scripture-reference');
  const elements = preset.createElements();
  const scripture = elements.find((element) => element.name === 'Scripture Body');
  const reference = elements.find((element) => element.name === 'Reference');

  assert.equal(scripture?.type, 'text');
  assert.equal(reference?.type, 'text');
  assert.equal(scripture?.style.fontSize, 56);
  assert.equal(reference?.style.fontSize, 34);
  assert.equal(scripture?.frame.height, 0.24);
});

test('normalizeFrame clamps position and dimensions into the canvas bounds', () => {
  const frame = normalizeFrame({
    x: 0.95,
    y: -0.2,
    width: 0.3,
    height: 0.01,
    zIndex: 1,
  });

  assert.equal(frame.x, 0.7);
  assert.equal(frame.y, 0);
  assert.equal(frame.width, 0.3);
  assert.equal(frame.height, 0.06);
});

test('buildStructuredSlide keeps elements as the source of truth and summarizes content', () => {
  const preset = getLayoutPreset('title-body');
  const structured = buildStructuredSlide({
    id: 'structured-1',
    label: 'Structured',
    content: '',
    layoutType: 'title-body',
    elements: preset.createElements(),
  }, null);

  assert.equal(structured.layoutType, 'title-body');
  assert.equal(structured.elements?.length, 2);
  assert.match(structured.content, /Slide Title/);
  assert.match(structured.content, /Main content goes here/);
});

test('scripture slides on media backgrounds use the reading panel guardrail', () => {
  assert.equal(PROGRAM_MEDIA_PRESENTATION_FILTER, 'brightness(1.06) saturate(1.06) contrast(1.03)');
  assert.equal(shouldUseScriptureReadingPanel({
    itemType: 'BIBLE',
    layoutType: undefined,
    hasStructuredElements: false,
    hasReadableText: true,
    hasBackground: true,
    mediaType: 'image',
  }), true);
  assert.equal(shouldUseScriptureReadingPanel({
    itemType: 'ANNOUNCEMENT',
    layoutType: undefined,
    hasStructuredElements: false,
    hasReadableText: true,
    hasBackground: true,
    mediaType: 'image',
  }), false);
});

