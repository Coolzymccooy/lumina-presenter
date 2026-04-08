import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bundledHymnCatalogProvider,
  listAllHymnCatalogProviders,
  listCatalogHymns,
  listVisibleHymnCatalogProviders,
  searchCatalogHymns,
} from './hymnCatalog.ts';
import { ccliCatalogProvider } from './ccliCatalogProvider.ts';

test('CCLI adapter is registered but dark (no credentials) by default', () => {
  const allProviders = listAllHymnCatalogProviders();
  const visibleProviders = listVisibleHymnCatalogProviders();

  assert.ok(allProviders.some((provider) => provider.id === ccliCatalogProvider.id));
  assert.ok(visibleProviders.every((provider) => provider.id !== ccliCatalogProvider.id));
  assert.equal(ccliCatalogProvider.availability, 'dark');
  assert.equal(ccliCatalogProvider.isVisibleInLibrary, false);
});

test('catalog listing continues to use the bundled provider only', () => {
  const hymns = listCatalogHymns();

  assert.ok(hymns.length >= 25);
  assert.ok(hymns.every((hymn) => hymn.librarySource.kind === 'bundled-pd'));
});

test('catalog search remains stable while the CCLI adapter is dark', () => {
  const results = searchCatalogHymns('Amazing Grace');

  assert.ok(results.length > 0);
  assert.equal(results[0]?.hymn.id, 'amazing-grace');
  assert.equal(bundledHymnCatalogProvider.availability, 'active');
});
