import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_DOMAIN_HYMNS } from '../seed/publicDomainHymns.ts';
import { generateSlidesFromHymn, splitSectionIntoSlides, expandHymnSectionsForPresentation } from './hymnGenerator.ts';
import { searchHymns } from './hymnSearch.ts';

test('bundled hymn library exposes the full 25-hymn public-domain starter set', () => {
  assert.equal(PUBLIC_DOMAIN_HYMNS.length, 25);
  assert.ok(PUBLIC_DOMAIN_HYMNS.every((entry) => entry.copyright.publicDomain));
  assert.ok(PUBLIC_DOMAIN_HYMNS.every((entry) => entry.librarySource.kind === 'bundled-pd'));
  assert.ok(PUBLIC_DOMAIN_HYMNS.every((entry) => entry.usageRights.canProject));
});

test('searchHymns matches first line and tune metadata', () => {
  const byFirstLine = searchHymns(PUBLIC_DOMAIN_HYMNS, 'peace like a river');
  assert.equal(byFirstLine[0]?.hymn.id, 'it-is-well-with-my-soul');

  const byTune = searchHymns(PUBLIC_DOMAIN_HYMNS, 'old 100th');
  assert.equal(byTune[0]?.hymn.id, 'praise-god-from-whom-all-blessings-flow');
});

test('searchHymns can filter by source kind without changing existing results', () => {
  const bundledOnly = searchHymns(PUBLIC_DOMAIN_HYMNS, 'grace', 25, { sourceKinds: ['bundled-pd'] });
  assert.ok(bundledOnly.length > 0);
  assert.ok(bundledOnly.every((entry) => entry.hymn.librarySource.kind === 'bundled-pd'));
});

test('expandHymnSectionsForPresentation repeats chorus after successive verses', () => {
  const hymn = PUBLIC_DOMAIN_HYMNS.find((entry) => entry.id === 'blessed-assurance');
  assert.ok(hymn);
  const expanded = expandHymnSectionsForPresentation(hymn!, 'smart');
  const chorusCount = expanded.filter((entry) => entry.section.type === 'chorus').length;
  assert.equal(chorusCount, 3);
});

test('splitSectionIntoSlides keeps common four-line verses in paired two-line slides', () => {
  const hymn = PUBLIC_DOMAIN_HYMNS.find((entry) => entry.id === 'amazing-grace');
  assert.ok(hymn);
  const firstVerse = hymn!.sections[0];
  const slides = splitSectionIntoSlides(firstVerse, { maxLinesPerSlide: 2, preferredCharsPerLine: 32 });
  assert.equal(slides.length, 2);
  assert.match(slides[0]?.text || '', /Amazing grace/);
  assert.match(slides[1]?.text || '', /I once was lost/);
});

test('generateSlidesFromHymn returns a stable hymn run-sheet item snapshot', () => {
  const hymn = PUBLIC_DOMAIN_HYMNS.find((entry) => entry.id === 'for-the-beauty-of-the-earth');
  assert.ok(hymn);
  const generated = generateSlidesFromHymn(hymn!, { chorusStrategy: 'smart' });
  assert.equal(generated.item.type, 'HYMN');
  assert.equal(generated.item.metadata?.source, 'hymn-library');
  assert.equal(generated.item.metadata?.hymn?.hymnId, hymn!.id);
  assert.equal(generated.item.metadata?.hymn?.sourceKind, 'bundled-pd');
  assert.equal(generated.item.metadata?.hymn?.licenseScope, 'bundled-distribution');
  assert.equal(generated.item.slides[0]?.metadata?.hymn?.sourceKind, 'bundled-pd');
  assert.ok(generated.item.slides.length >= 6);
});
