import { getCachedSemanticReference, normalizeBibleReference } from './bibleLookup.ts';
import {
  createBibleMemorySearchQuery,
  normalizeBibleMemoryText,
  type BibleMemoryProvider,
  type BibleMemoryQueryOrigin,
  type BibleMemorySearchHit,
} from './bibleMemory.ts';

export type BibleIntentResolutionStage =
  | 'exact-reference'
  | 'semantic-cache'
  | 'local-memory'
  | 'remote-rerank'
  | 'fallback'
  | 'unresolved';

export type BibleIntentCandidateSource =
  | 'exact-reference'
  | 'semantic-cache'
  | 'local-memory'
  | 'remote-rerank'
  | 'fallback';

export interface BibleIntentInput {
  rawText: string;
  translationId: string;
  origin: BibleMemoryQueryOrigin;
  allowRemoteRerank?: boolean;
  preferInstantProject?: boolean;
  contextHints?: string[];
  recentReferences?: string[];
  maxLocalCandidates?: number;
}

export interface BibleIntentCandidate {
  reference: string;
  translationId: string;
  confidence: number;
  source: BibleIntentCandidateSource;
  stage: BibleIntentResolutionStage;
  reason: string;
  matchedTerms: string[];
  previewText?: string;
  memoryHit?: BibleMemorySearchHit;
  latencyMs?: number;
}

export interface BibleIntentRemoteResolution {
  reference: string;
  confidence: number;
  model: string;
  reason: string;
  latencyMs: number;
}

export interface BibleIntentDiagnostics {
  normalizedText: string;
  exactReference: string | null;
  semanticCacheReference: string | null;
  localSearchTookMs: number;
  remoteRerankTookMs: number | null;
  notes: string[];
}

export interface BibleIntentResolution {
  status: 'resolved' | 'candidate' | 'unresolved';
  chosen: BibleIntentCandidate | null;
  localCandidates: BibleIntentCandidate[];
  remoteCandidate: BibleIntentCandidate | null;
  shouldEscalateToRemote: boolean;
  shouldProjectInstantly: boolean;
  diagnostics: BibleIntentDiagnostics;
}

export interface BibleIntentResolverConfig {
  maxLocalCandidates: number;
  instantProjectThreshold: number;
  remoteEscalationThreshold: number;
  remoteOverrideDelta: number;
  semanticCacheBoost: number;
  recentReferenceBoost: number;
  voicePartialPenalty: number;
  fallbackReference: string;
}

export interface BibleIntentRemoteResolver {
  id: string;
  resolve: (input: BibleIntentInput) => Promise<BibleIntentRemoteResolution | null>;
}

export interface BibleIntentResolverDependencies {
  memoryProvider: BibleMemoryProvider;
  remoteResolver?: BibleIntentRemoteResolver;
}

const DEFAULT_CONFIG: BibleIntentResolverConfig = {
  maxLocalCandidates: 5,
  instantProjectThreshold: 0.88,
  remoteEscalationThreshold: 0.72,
  remoteOverrideDelta: 0.08,
  semanticCacheBoost: 0.07,
  recentReferenceBoost: 0.05,
  voicePartialPenalty: 0.08,
  fallbackReference: 'Psalms 23:1-4',
};

const clampConfidence = (value: number): number => Math.max(0, Math.min(1, value));

const originPenalty = (origin: BibleMemoryQueryOrigin, config: BibleIntentResolverConfig): number => (
  origin === 'voice_partial' ? config.voicePartialPenalty : 0
);

const candidateFromReference = (
  reference: string,
  translationId: string,
  confidence: number,
  source: BibleIntentCandidateSource,
  stage: BibleIntentResolutionStage,
  reason: string,
  matchedTerms: string[] = [],
  memoryHit?: BibleMemorySearchHit,
  latencyMs?: number
): BibleIntentCandidate => ({
  reference,
  translationId,
  confidence: clampConfidence(confidence),
  source,
  stage,
  reason,
  matchedTerms,
  previewText: memoryHit?.passage.plainText,
  memoryHit,
  latencyMs,
});

export const createBibleIntentResolverConfig = (
  overrides: Partial<BibleIntentResolverConfig> = {}
): BibleIntentResolverConfig => ({
  ...DEFAULT_CONFIG,
  ...overrides,
  maxLocalCandidates: Math.max(1, Math.min(10, Number(overrides.maxLocalCandidates || DEFAULT_CONFIG.maxLocalCandidates))),
});

export const normalizeBibleIntentText = (value: string): string => normalizeBibleMemoryText(value);

export const resolveExactBibleIntent = (
  input: BibleIntentInput,
  config: Partial<BibleIntentResolverConfig> = {}
): BibleIntentCandidate | null => {
  const activeConfig = createBibleIntentResolverConfig(config);
  const exactReference = normalizeBibleReference(input.rawText);
  if (!exactReference) return null;
  const confidence = clampConfidence(0.99 - originPenalty(input.origin, activeConfig));
  return candidateFromReference(
    exactReference,
    input.translationId,
    confidence,
    'exact-reference',
    'exact-reference',
    'Matched an explicit Bible reference in the user input.',
    [exactReference]
  );
};

export const resolveSemanticCacheBibleIntent = (
  input: BibleIntentInput,
  config: Partial<BibleIntentResolverConfig> = {}
): BibleIntentCandidate | null => {
  const activeConfig = createBibleIntentResolverConfig(config);
  const cachedReference = getCachedSemanticReference(input.rawText);
  if (!cachedReference) return null;
  const confidence = clampConfidence(0.76 + activeConfig.semanticCacheBoost - originPenalty(input.origin, activeConfig));
  return candidateFromReference(
    cachedReference,
    input.translationId,
    confidence,
    'semantic-cache',
    'semantic-cache',
    'Reused a recent semantic scripture match from local cache.',
    tokenizeIntentTerms(input.rawText)
  );
};

const tokenizeIntentTerms = (value: string): string[] => normalizeBibleIntentText(value).split(' ').filter(Boolean);

const toLocalCandidate = (
  hit: BibleMemorySearchHit,
  input: BibleIntentInput,
  config: BibleIntentResolverConfig,
  recentReferences: Set<string>
): BibleIntentCandidate => {
  const isRecent = recentReferences.has(hit.reference);
  const boostedConfidence = hit.confidence + (isRecent ? config.recentReferenceBoost : 0) - originPenalty(input.origin, config);
  return candidateFromReference(
    hit.reference,
    input.translationId,
    boostedConfidence,
    'local-memory',
    'local-memory',
    hit.matchReason,
    hit.matchedTerms,
    hit
  );
};

export const buildLocalBibleIntentCandidates = async (
  input: BibleIntentInput,
  memoryProvider: BibleMemoryProvider,
  config: Partial<BibleIntentResolverConfig> = {}
): Promise<{ candidates: BibleIntentCandidate[]; tookMs: number }> => {
  const activeConfig = createBibleIntentResolverConfig(config);
  const startedAt = Date.now();
  const searchQuery = createBibleMemorySearchQuery(input.rawText, {
    translationId: input.translationId,
    origin: input.origin,
    mode: 'auto',
    maxResults: input.maxLocalCandidates || activeConfig.maxLocalCandidates,
    contextHints: input.contextHints,
    recentReferences: input.recentReferences,
  });
  const result = await memoryProvider.search(searchQuery);
  const recentReferenceSet = new Set((input.recentReferences || []).map((entry) => normalizeBibleReference(entry) || entry));
  const candidates = result.hits.map((hit) => toLocalCandidate(hit, input, activeConfig, recentReferenceSet));
  return {
    candidates,
    tookMs: Math.max(0, Date.now() - startedAt),
  };
};

export const selectPreferredBibleIntentCandidate = (
  candidates: BibleIntentCandidate[]
): BibleIntentCandidate | null => {
  if (!candidates.length) return null;
  return [...candidates].sort((left, right) => {
    if (right.confidence !== left.confidence) return right.confidence - left.confidence;
    const leftLatency = Number(left.latencyMs || 0);
    const rightLatency = Number(right.latencyMs || 0);
    return leftLatency - rightLatency;
  })[0] || null;
};

export const shouldEscalateBibleIntentToRemote = (
  chosen: BibleIntentCandidate | null,
  input: BibleIntentInput,
  config: Partial<BibleIntentResolverConfig> = {}
): boolean => {
  const activeConfig = createBibleIntentResolverConfig(config);
  if (!input.allowRemoteRerank) return false;
  if (!chosen) return true;
  if (chosen.source === 'exact-reference') return false;
  return chosen.confidence < activeConfig.remoteEscalationThreshold;
};

export const mergeRemoteBibleIntentCandidate = (
  localCandidate: BibleIntentCandidate | null,
  remoteCandidate: BibleIntentRemoteResolution | null,
  input: BibleIntentInput,
  config: Partial<BibleIntentResolverConfig> = {}
): BibleIntentCandidate | null => {
  const activeConfig = createBibleIntentResolverConfig(config);
  if (!remoteCandidate) return localCandidate;

  const normalizedReference = normalizeBibleReference(remoteCandidate.reference);
  if (!normalizedReference) return localCandidate;

  const promotedRemote = candidateFromReference(
    normalizedReference,
    input.translationId,
    remoteCandidate.confidence,
    'remote-rerank',
    'remote-rerank',
    remoteCandidate.reason,
    tokenizeIntentTerms(input.rawText),
    undefined,
    remoteCandidate.latencyMs
  );

  if (!localCandidate) return promotedRemote;
  if (promotedRemote.reference === localCandidate.reference) {
    return promotedRemote.confidence >= localCandidate.confidence ? promotedRemote : localCandidate;
  }

  return promotedRemote.confidence >= (localCandidate.confidence + activeConfig.remoteOverrideDelta)
    ? promotedRemote
    : localCandidate;
};

export const resolveBibleIntent = async (
  input: BibleIntentInput,
  dependencies: BibleIntentResolverDependencies,
  config: Partial<BibleIntentResolverConfig> = {}
): Promise<BibleIntentResolution> => {
  const activeConfig = createBibleIntentResolverConfig(config);
  const normalizedText = normalizeBibleIntentText(input.rawText);
  const exactCandidate = resolveExactBibleIntent(input, activeConfig);
  const semanticCacheCandidate = exactCandidate ? null : resolveSemanticCacheBibleIntent(input, activeConfig);
  const diagnostics: BibleIntentDiagnostics = {
    normalizedText,
    exactReference: exactCandidate?.reference || null,
    semanticCacheReference: semanticCacheCandidate?.reference || null,
    localSearchTookMs: 0,
    remoteRerankTookMs: null,
    notes: [],
  };

  if (exactCandidate) {
    return {
      status: 'resolved',
      chosen: exactCandidate,
      localCandidates: [exactCandidate],
      remoteCandidate: null,
      shouldEscalateToRemote: false,
      shouldProjectInstantly: true,
      diagnostics,
    };
  }

  const { candidates: localCandidates, tookMs } = await buildLocalBibleIntentCandidates(input, dependencies.memoryProvider, activeConfig);
  diagnostics.localSearchTookMs = tookMs;

  const mergedLocalCandidates = semanticCacheCandidate
    ? [semanticCacheCandidate, ...localCandidates]
    : localCandidates;
  const preferredLocal = selectPreferredBibleIntentCandidate(mergedLocalCandidates);
  const shouldEscalateToRemote = shouldEscalateBibleIntentToRemote(preferredLocal, input, activeConfig);

  let remoteCandidate: BibleIntentCandidate | null = null;
  let chosen = preferredLocal;
  if (shouldEscalateToRemote && dependencies.remoteResolver) {
    const remoteStartedAt = Date.now();
    const remote = await dependencies.remoteResolver.resolve(input);
    diagnostics.remoteRerankTookMs = Math.max(0, Date.now() - remoteStartedAt);
    remoteCandidate = mergeRemoteBibleIntentCandidate(null, remote, input, activeConfig);
    chosen = mergeRemoteBibleIntentCandidate(preferredLocal, remote, input, activeConfig);
  }

  if (!chosen && activeConfig.fallbackReference) {
    diagnostics.notes.push('No local or remote candidate cleared the threshold; using configured fallback.');
    chosen = candidateFromReference(
      activeConfig.fallbackReference,
      input.translationId,
      0.5,
      'fallback',
      'fallback',
      'Applied the configured fallback reference.'
    );
  }

  return {
    status: chosen ? (chosen.confidence >= activeConfig.instantProjectThreshold ? 'resolved' : 'candidate') : 'unresolved',
    chosen,
    localCandidates: mergedLocalCandidates,
    remoteCandidate,
    shouldEscalateToRemote,
    shouldProjectInstantly: Boolean(chosen && chosen.confidence >= activeConfig.instantProjectThreshold && (input.preferInstantProject ?? true)),
    diagnostics,
  };
};
