import test from 'node:test';
import assert from 'node:assert/strict';
import { setCachedSemanticReference } from './bibleLookup.ts';
import {
  createBibleMemorySearchQuery,
  createNullBibleMemoryProvider,
  type BibleMemoryProvider,
  type BibleMemorySearchResult,
} from './bibleMemory.ts';
import {
  mergeRemoteBibleIntentCandidate,
  resolveBibleIntent,
  resolveExactBibleIntent,
  resolveSemanticCacheBibleIntent,
  shouldEscalateBibleIntentToRemote,
  type BibleIntentInput,
} from './bibleIntentResolver.ts';

const createStubMemoryProvider = (searchResult: BibleMemorySearchResult): BibleMemoryProvider => ({
  ...createNullBibleMemoryProvider(),
  id: 'stub-memory',
  isReady: () => true,
  search: async () => searchResult,
});

test('resolveExactBibleIntent returns an immediate exact candidate', () => {
  const input: BibleIntentInput = {
    rawText: 'John 3:16',
    translationId: 'kjv',
    origin: 'typed',
    allowRemoteRerank: true,
  };
  const candidate = resolveExactBibleIntent(input);

  assert.ok(candidate);
  assert.equal(candidate?.reference, 'John 3:16');
  assert.equal(candidate?.source, 'exact-reference');
  assert.ok((candidate?.confidence || 0) > 0.95);
});

test('resolveSemanticCacheBibleIntent reuses cached semantic matches before remote AI', () => {
  setCachedSemanticReference('peace and comfort for grief', 'Psalm 34:18');
  const candidate = resolveSemanticCacheBibleIntent({
    rawText: 'peace and comfort for grief',
    translationId: 'kjv',
    origin: 'voice_final',
    allowRemoteRerank: true,
  });

  assert.ok(candidate);
  assert.equal(candidate?.reference, 'Psalms 34:18');
  assert.equal(candidate?.source, 'semantic-cache');
});

test('resolveBibleIntent prefers strong local-memory hits and skips remote escalation', async () => {
  const query = createBibleMemorySearchQuery('peace and comfort', { translationId: 'kjv' });
  const provider = createStubMemoryProvider({
    providerId: 'stub-memory',
    cacheStatus: 'fresh',
    tookMs: 4,
    query,
    hits: [
      {
        reference: 'Philippians 4:6-7',
        confidence: 0.91,
        matchedTerms: ['peace', 'comfort'],
        matchedThemes: ['peace'],
        matchReason: 'Strong local token and theme overlap.',
        mode: 'semantic-hint',
        tokenProfile: { allTokens: ['peace', 'comfort'], matchedTokens: ['peace', 'comfort'] },
        passage: {
          id: 'kjv:philippians-4_6-7',
          title: 'Philippians 4:6-7',
          plainText: 'Be careful for nothing...',
          lines: ['Be careful for nothing...'],
          themes: ['peace'],
          keywords: ['peace', 'anxiety'],
          aliases: ['do not be anxious'],
          source: 'bundled',
          locator: {
            reference: 'Philippians 4:6-7',
            normalizedReference: 'Philippians 4:6-7',
            translationId: 'kjv',
            bookName: 'Philippians',
            chapter: 4,
            verseStart: 6,
            verseEnd: 7,
            verseCount: 2,
            division: 'new-testament',
          },
          verses: [],
        },
      },
    ],
  });

  const resolution = await resolveBibleIntent({
    rawText: 'peace and comfort',
    translationId: 'kjv',
    origin: 'typed',
    allowRemoteRerank: true,
  }, { memoryProvider: provider });

  assert.equal(resolution.chosen?.reference, 'Philippians 4:6-7');
  assert.equal(resolution.shouldEscalateToRemote, false);
  assert.equal(resolution.shouldProjectInstantly, true);
});

test('shouldEscalateBibleIntentToRemote keeps exact references local and escalates weak local matches', () => {
  const exact = resolveExactBibleIntent({
    rawText: 'Romans 8:28',
    translationId: 'kjv',
    origin: 'typed',
    allowRemoteRerank: true,
  });
  assert.equal(shouldEscalateBibleIntentToRemote(exact, {
    rawText: 'Romans 8:28',
    translationId: 'kjv',
    origin: 'typed',
    allowRemoteRerank: true,
  }), false);

  assert.equal(shouldEscalateBibleIntentToRemote({
    reference: 'Psalm 23:1-4',
    translationId: 'kjv',
    confidence: 0.54,
    source: 'local-memory',
    stage: 'local-memory',
    reason: 'Weak match',
    matchedTerms: ['care'],
  }, {
    rawText: 'something about care',
    translationId: 'kjv',
    origin: 'voice_final',
    allowRemoteRerank: true,
  }), true);
});

test('mergeRemoteBibleIntentCandidate only overrides local when the confidence delta is meaningful', () => {
  const local = {
    reference: 'Psalm 23:1-4',
    translationId: 'kjv',
    confidence: 0.8,
    source: 'local-memory' as const,
    stage: 'local-memory' as const,
    reason: 'Local search',
    matchedTerms: ['comfort'],
  };

  const keptLocal = mergeRemoteBibleIntentCandidate(local, {
    reference: 'Isaiah 41:10',
    confidence: 0.84,
    model: 'gemini',
    reason: 'Remote suggestion',
    latencyMs: 620,
  }, {
    rawText: 'comfort',
    translationId: 'kjv',
    origin: 'typed',
    allowRemoteRerank: true,
  });
  assert.equal(keptLocal?.reference, 'Psalm 23:1-4');

  const promotedRemote = mergeRemoteBibleIntentCandidate(local, {
    reference: 'Isaiah 41:10',
    confidence: 0.92,
    model: 'gemini',
    reason: 'Remote suggestion',
    latencyMs: 620,
  }, {
    rawText: 'comfort',
    translationId: 'kjv',
    origin: 'typed',
    allowRemoteRerank: true,
  });
  assert.equal(promotedRemote?.reference, 'Isaiah 41:10');
});
