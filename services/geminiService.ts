import type { GeneratedSlideData } from "../types";
import type { MacroDefinition, MacroActionType, MacroCategory, MacroTriggerType } from "../types/macros";
import type { SermonSummary } from "./sermonSummaryService";
import { nanoid } from "nanoid";
import { getServerApiBaseCandidates, getServerApiBaseUrl } from "./serverApi";
import { getCachedSemanticReference, normalizeBibleReference, setCachedSemanticReference } from "./bibleLookup";
import { sanitizeLyricsForSlideGeneration } from "./lyricSources/lyricSanitizer";

type AiJson = {
  ok?: boolean;
  error?: string;
  message?: string;
  retryAfterMs?: number;
  [key: string]: any;
};

export const postAi = async (path: string, payload: Record<string, unknown>, timeoutMs = 45000): Promise<AiJson | null> => {
  const apiBases = getServerApiBaseCandidates();
  if (!apiBases.length) {
    return {
      ok: false,
      error: "API_BASE_URL_MISSING",
      message: "Missing API base URL. Set VITE_API_BASE_URL to your backend service.",
    };
  }

  const shouldRetry = (status: number) => (
    status === 404
    || status === 502
    || status === 503
    || status === 504
  );

  let lastFailure: AiJson | null = null;
  for (let idx = 0; idx < apiBases.length; idx += 1) {
    const apiBase = apiBases[idx];
    const isLastCandidate = idx >= apiBases.length - 1;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${apiBase.replace(/\/+$/, "")}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      const json = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : null;

      if (!response.ok) {
        lastFailure = {
          ok: false,
          error: json?.error || `HTTP_${response.status}`,
          message: json?.message || `AI request failed (${response.status})`,
          retryAfterMs: Number(json?.retryAfterMs || 0),
          apiBase,
        };
        if (!isLastCandidate && shouldRetry(response.status)) continue;
        return lastFailure;
      }

      if (json && typeof json === "object") return json;
      lastFailure = {
        ok: false,
        error: "INVALID_JSON",
        message: "AI endpoint returned an invalid JSON payload.",
        apiBase,
      };
      if (!isLastCandidate) continue;
      return lastFailure;
    } catch {
      lastFailure = {
        ok: false,
        error: "NETWORK_OR_TIMEOUT",
        message: `Could not reach AI backend at ${apiBase}.`,
        retryAfterMs: 0,
        apiBase,
      };
      if (!isLastCandidate) continue;
      return lastFailure;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  return lastFailure;
};

const sanitizeSlides = (slides: any[]): { label: string; content: string }[] => {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((entry, idx) => ({
      label: String(entry?.label || `Slide ${idx + 1}`).trim() || `Slide ${idx + 1}`,
      content: String(entry?.content || "").trim(),
    }))
    .filter((entry) => entry.content.length > 0);
};

const BIBLE_REFERENCE_PATTERN = /\b(?:[1-3]\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/i;
const JOHN_316_PATTERN = /^john\s+3:16$/i;

const extractBibleReference = (value: unknown): string | null => {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(BIBLE_REFERENCE_PATTERN);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
};

const inferSemanticFallbackReference = (query: string): string => {
  const text = query.toLowerCase();
  const includesAny = (keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

  if (includesAny(["peace", "comfort", "anx", "worry", "stress", "trouble"])) return "Philippians 4:6-7";
  if (includesAny(["grief", "mourning", "loss", "broken", "sad"])) return "Psalm 34:18";
  if (includesAny(["fear", "afraid", "panic"])) return "Isaiah 41:10";
  if (includesAny(["strength", "weak", "tired", "weary"])) return "Isaiah 40:31";
  if (includesAny(["guidance", "direction", "decision", "wisdom"])) return "Proverbs 3:5-6";
  if (includesAny(["healing", "sick", "pain", "disease"])) return "Jeremiah 30:17";
  if (includesAny(["forgive", "forgiveness", "guilt", "sin", "shame"])) return "1 John 1:9";
  if (includesAny(["marriage", "family", "relationship", "love"])) return "1 Corinthians 13:4-7";
  if (includesAny(["hope", "future", "discourage", "depress"])) return "Romans 15:13";
  if (includesAny(["protection", "danger", "battle", "war"])) return "Psalm 91:1-2";
  return "Psalm 23:1-4";
};

export const generateSlidesFromText = async (text: string): Promise<GeneratedSlideData | null> => {
  const cleaned = sanitizeLyricsForSlideGeneration(text);
  const payloadText = cleaned || text;
  const response = await postAi("/api/ai/generate-slides", { text: payloadText }, 30000);
  if (!response) {
    throw new Error(`Could not reach AI backend at ${getServerApiBaseUrl()}.`);
  }
  if (!response.ok) {
    throw new Error(String(response.message || response.error || "AI request failed."));
  }
  if (!response?.data?.slides) {
    throw new Error("AI returned no slide data. Please retry or check backend logs.");
  }
  const slides = sanitizeSlides(response.data.slides);
  if (!slides.length) {
    throw new Error("AI returned empty slide content. Try a more specific prompt.");
  }
  return { slides };
};

export type TranscribeSermonChunkRequest = {
  audioBase64: string;
  mimeType: 'audio/webm' | 'audio/webm;codecs=opus' | 'audio/mp4';
  locale: 'en-GB' | 'en-US';
  /** Church-specific accent hint for improved Gemini accuracy */
  accentHint?: string;
  workspaceId?: string;
  sessionId?: string;
  clientId?: string;
};

export type TranscribeSermonChunkResult =
  | {
      ok: true;
      transcript: string;
      locale: 'en-GB' | 'en-US';
      retryAfterMs?: 0;
      mode: 'success';
    }
  | {
      ok: false;
      mode: 'cooldown';
      retryAfterMs: number;
      error: string;
      message: string;
    }
  | {
      ok: false;
      mode: 'transient_error' | 'terminal_error';
      retryAfterMs: 0;
      error: string;
      message: string;
    };

export const transcribeSermonChunk = async (
  payload: TranscribeSermonChunkRequest
): Promise<TranscribeSermonChunkResult> => {
  const response = await postAi('/api/ai/transcribe-sermon-chunk', payload, 20000);
  if (response?.ok) {
    const locale = response.locale === 'en-GB' ? 'en-GB' : 'en-US';
    return {
      ok: true,
      mode: 'success',
      transcript: String(response.transcript || '').trim(),
      locale,
      retryAfterMs: 0,
    };
  }

  const errorCode = String(response?.error || 'TRANSCRIBE_REQUEST_FAILED').trim() || 'TRANSCRIBE_REQUEST_FAILED';
  const message = String(response?.message || 'Cloud transcription request failed.').trim() || 'Cloud transcription request failed.';
  const retryAfterMs = Number(response?.retryAfterMs || 0);

  if (errorCode === 'TRANSCRIBE_COOLDOWN' || errorCode === 'QUOTA_EXCEEDED' || errorCode === 'HTTP_429') {
    const cooldownMs = errorCode === 'QUOTA_EXCEEDED' || errorCode === 'HTTP_429'
      ? 30000
      : Number.isFinite(retryAfterMs) ? Math.max(0, retryAfterMs) : 0;
    return {
      ok: false,
      mode: 'cooldown',
      retryAfterMs: cooldownMs,
      error: errorCode,
      message: errorCode === 'QUOTA_EXCEEDED' ? 'Gemini quota reached. Pausing 30s before retry.' : message,
    };
  }

  const transient = (
    errorCode === 'SERVER_TIMEOUT'
    || errorCode === 'HTTP_502'
    || errorCode === 'HTTP_503'
    || errorCode === 'TRANSCRIBE_FAILED'
    || errorCode === 'TRANSCRIBE_REQUEST_FAILED'
  );

  return {
    ok: false,
    mode: transient ? 'transient_error' : 'terminal_error',
    retryAfterMs: 0,
    error: errorCode,
    message,
  };
};

export interface SermonProcessingJob {
  id: string;
  workspaceId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  phase: 'queued' | 'transcribe' | 'summarize' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  error: string | null;
  retryAfterMs: number;
  nextRetryAt: number | null;
  attemptCount: number;
  transcript: string | null;
  summary: SermonSummary | null;
  accentHint: string;
  locale: 'en-GB' | 'en-US';
}

const normalizeSermonProcessingJob = (raw: any): SermonProcessingJob => ({
  id: String(raw?.id || ''),
  workspaceId: String(raw?.workspaceId || 'default-workspace'),
  status: raw?.status === 'completed' || raw?.status === 'failed' || raw?.status === 'processing' ? raw.status : 'queued',
  phase: raw?.phase === 'transcribe' || raw?.phase === 'summarize' || raw?.phase === 'completed' || raw?.phase === 'failed' ? raw.phase : 'queued',
  progress: Number(raw?.progress || 0),
  createdAt: Number(raw?.createdAt || 0),
  updatedAt: Number(raw?.updatedAt || 0),
  completedAt: raw?.completedAt ? Number(raw.completedAt) : null,
  error: raw?.error ? String(raw.error) : null,
  retryAfterMs: Math.max(0, Number(raw?.retryAfterMs || 0)),
  nextRetryAt: raw?.nextRetryAt ? Number(raw.nextRetryAt) : null,
  attemptCount: Math.max(0, Number(raw?.attemptCount || 0)),
  transcript: raw?.transcript ? String(raw.transcript) : null,
  summary: raw?.summary && typeof raw.summary === 'object' ? raw.summary as SermonSummary : null,
  accentHint: String(raw?.accentHint || 'standard'),
  locale: raw?.locale === 'en-GB' ? 'en-GB' : 'en-US',
});

export type TranscribeSermonAudioResult =
  | { ok: true; transcript: string }
  | {
      ok: false;
      deferred: true;
      error: string;
      code: 'PROCESSING_DEFERRED';
      job: SermonProcessingJob;
    }
  | {
      ok: false;
      deferred?: false;
      error: string;
      code?: string;
      retryAfterMs?: number;
    };

export const transcribeSermonAudio = async (
  audioBlob: Blob,
  mimeType: string,
  locale: 'en-GB' | 'en-US',
  accentHint?: string,
  options: {
    allowDeferred?: boolean;
    workspaceId?: string;
  } = {}
): Promise<TranscribeSermonAudioResult> => {
  const apiBase = getServerApiBaseUrl();
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  form.append('audio', audioBlob, `sermon.${ext}`);
  form.append('mimeType', mimeType);
  form.append('locale', locale);
  form.append('accentHint', accentHint || 'standard');
  form.append('allowDeferred', options.allowDeferred === false ? '0' : '1');
  if (options.workspaceId) {
    form.append('workspaceId', options.workspaceId);
  }
  try {
    const res = await fetch(`${apiBase}/api/ai/transcribe-sermon-audio`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json() as {
      ok: boolean;
      deferred?: boolean;
      transcript?: string;
      job?: unknown;
      message?: string;
      error?: string;
      retryAfterMs?: number;
    };
    if (data.ok && typeof data.transcript === 'string') {
      return { ok: true, transcript: data.transcript };
    }
    if (data.ok && data.deferred && data.job) {
      return {
        ok: false,
        deferred: true,
        code: 'PROCESSING_DEFERRED',
        error: data.message || 'Transcription queued for automatic retry.',
        job: normalizeSermonProcessingJob(data.job),
      };
    }
    return {
      ok: false,
      deferred: false,
      error: data.message || data.error || 'Transcription failed.',
      code: data.error,
      retryAfterMs: Number(data.retryAfterMs || 0),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      deferred: false,
      error: err instanceof Error ? err.message : 'Transcription request failed.',
    };
  }
};

export const getSermonProcessingJob = async (
  jobId: string
): Promise<{ ok: true; job: SermonProcessingJob } | { ok: false; error: string; code?: string }> => {
  const apiBase = getServerApiBaseUrl();
  try {
    const res = await fetch(`${apiBase}/api/ai/sermon-processing-jobs/${encodeURIComponent(jobId)}`);
    const data = await res.json() as { ok?: boolean; job?: unknown; message?: string; error?: string };
    if (res.ok && data?.ok && data.job) {
      return { ok: true, job: normalizeSermonProcessingJob(data.job) };
    }
    return {
      ok: false,
      error: data?.message || data?.error || 'Unable to fetch sermon processing job.',
      code: data?.error,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to fetch sermon processing job.',
    };
  }
};

export const retrySermonProcessingJob = async (
  jobId: string
): Promise<{ ok: true; job: SermonProcessingJob } | { ok: false; error: string; code?: string }> => {
  const apiBase = getServerApiBaseUrl();
  try {
    const res = await fetch(`${apiBase}/api/ai/sermon-processing-jobs/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
    });
    const data = await res.json() as { ok?: boolean; job?: unknown; message?: string; error?: string };
    if (res.ok && data?.ok && data.job) {
      return { ok: true, job: normalizeSermonProcessingJob(data.job) };
    }
    return {
      ok: false,
      error: data?.message || data?.error || 'Unable to retry sermon processing job.',
      code: data?.error,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to retry sermon processing job.',
    };
  }
};

export const semanticBibleSearch = async (query: string): Promise<string> => {
  const sanitizedQuery = String(query || "").trim();
  if (!sanitizedQuery) return "Psalm 23:1-4";

  const exactReference = normalizeBibleReference(sanitizedQuery);
  if (exactReference) return exactReference;

  const cachedReference = getCachedSemanticReference(sanitizedQuery);
  if (cachedReference) return cachedReference;

  const response = await postAi("/api/ai/semantic-bible-search", { query: sanitizedQuery }, 20000);
  const reference = extractBibleReference(response?.reference);
  const looksLikeDefaultJohn = reference ? JOHN_316_PATTERN.test(reference) : false;
  const userAskedForJohn316 = /john\s*3:16|for god so loved|eternal life|believe/i.test(sanitizedQuery);

  const resolved = response?.ok && reference && (!looksLikeDefaultJohn || userAskedForJohn316)
    ? reference
    : inferSemanticFallbackReference(sanitizedQuery);
  setCachedSemanticReference(sanitizedQuery, resolved);
  return resolved;
};

export const semanticBibleSearchMulti = async (query: string, maxResults = 4): Promise<string[]> => {
  const sanitizedQuery = String(query || '').trim();
  if (!sanitizedQuery) return ['Psalm 23:1-4'];

  const exactReference = normalizeBibleReference(sanitizedQuery);
  if (exactReference) return [exactReference];

  const response = await postAi('/api/ai/semantic-bible-search', { query: sanitizedQuery, maxResults }, 25000);
  if (!response?.ok) return [inferSemanticFallbackReference(sanitizedQuery)];

  const refs = Array.isArray(response.references)
    ? (response.references as unknown[]).map((r) => extractBibleReference(String(r || ''))).filter((r): r is string => Boolean(r))
    : [];
  if (refs.length > 0) return refs;

  const single = extractBibleReference(response.reference);
  return single ? [single] : [inferSemanticFallbackReference(sanitizedQuery)];
};

export const generateVisionaryBackdrop = async (verseText: string): Promise<string | null> => {
  const response = await postAi("/api/ai/generate-visionary-backdrop", { verseText }, 90000);
  if (!response?.ok) return null;
  const imageDataUrl = String(response.imageDataUrl || "").trim();
  return imageDataUrl || null;
};

export const suggestVisualTheme = async (contextText: string): Promise<string> => {
  const response = await postAi("/api/ai/suggest-visual-theme", { contextText }, 20000);
  if (!response?.ok) return "abstract";
  return String(response.keyword || "").trim() || "abstract";
};

const VALID_ACTION_TYPES = new Set<MacroActionType>([
  'next_slide','prev_slide','go_to_item','go_to_slide','clear_output',
  'show_message','hide_message','start_timer','stop_timer','trigger_aether_scene','wait',
]);

const VALID_TRIGGER_TYPES = new Set<MacroTriggerType>([
  'manual','item_start','slide_enter','timer_end','service_mode_change','webhook',
]);

const VALID_CATEGORIES = new Set<MacroCategory>([
  'service_flow','worship','sermon','streaming','emergency','stage','output','media','custom',
]);

export const generateMacroDefinition = async (
  prompt: string,
  scheduleItems: Array<{ id: string; title: string }>,
): Promise<MacroDefinition> => {
  const response = await postAi('/api/ai/generate-macro', { prompt, scheduleItems }, 30000);
  if (!response?.ok) {
    throw new Error(String(response?.message || response?.error || 'AI macro generation failed.'));
  }
  const d = response.data as Record<string, unknown>;
  if (!d?.name || !Array.isArray(d?.actions)) {
    throw new Error('AI returned an incomplete macro definition.');
  }
  const now = new Date().toISOString();
  const triggerType = VALID_TRIGGER_TYPES.has(d.triggerType as MacroTriggerType)
    ? (d.triggerType as MacroTriggerType)
    : 'manual';
  const category = VALID_CATEGORIES.has(d.category as MacroCategory)
    ? (d.category as MacroCategory)
    : 'custom';
  const actions = (d.actions as Record<string, unknown>[])
    .filter(a => VALID_ACTION_TYPES.has(a.type as MacroActionType))
    .map(a => ({
      id: nanoid(),
      type: a.type as MacroActionType,
      payload: (a.payload && typeof a.payload === 'object' ? a.payload : {}) as Record<string, unknown>,
      delayMs: typeof a.delayMs === 'number' ? a.delayMs : undefined,
      continueOnError: a.continueOnError === true,
    }));
  return {
    id: nanoid(),
    name: String(d.name).trim(),
    description: String(d.description || '').trim() || undefined,
    category,
    scope: 'workspace',
    triggers: [{ type: triggerType }],
    actions,
    tags: [],
    isEnabled: true,
    requiresConfirmation: false,
    isTemplate: false,
    createdAt: now,
    updatedAt: now,
  };
};

export interface SermonAnalysisResult {
  scriptureReferences: string[];
  keyPoints: string[];
  slides: { label: string; content: string }[];
}

const scriptureRegex = /\b(?:[1-3]\s)?[A-Za-z]+\s\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/g;

const buildSermonFallback = (sermonText: string): SermonAnalysisResult => {
  const references = Array.from(new Set((sermonText.match(scriptureRegex) || []).slice(0, 12)));
  const paragraphs = sermonText
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);

  const keyPoints = paragraphs.slice(0, 8).map((part, index) => {
    const compact = part.replace(/\s+/g, " ").trim();
    return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact || `Point ${index + 1}`;
  });

  const fallbackSlides = Array.from({ length: 20 }).map((_, idx) => ({
    label: idx === 0 ? "Title" : idx <= references.length ? `Scripture ${idx}` : `Point ${idx}`,
    content:
      idx === 0
        ? "Sermon Overview"
        : idx <= references.length
          ? references[idx - 1]
          : keyPoints[(idx - 1) % Math.max(keyPoints.length, 1)] || `Key takeaway ${idx}`,
  }));

  return {
    scriptureReferences: references,
    keyPoints,
    slides: fallbackSlides,
  };
};

export const analyzeSermonAndGenerateDeck = async (sermonText: string): Promise<SermonAnalysisResult> => {
  const fallback = buildSermonFallback(sermonText);
  const response = await postAi("/api/ai/analyze-sermon", { sermonText }, 60000);
  if (!response?.ok || !response?.data) return fallback;

  const slides = sanitizeSlides(response.data.slides || []).slice(0, 20);
  while (slides.length < 20) {
    const idx = slides.length + 1;
    slides.push({
      label: `Application ${idx}`,
      content: fallback.keyPoints[idx % Math.max(fallback.keyPoints.length, 1)] || `Reflection point ${idx}`,
    });
  }

  return {
    scriptureReferences: Array.isArray(response.data.scriptureReferences) && response.data.scriptureReferences.length
      ? response.data.scriptureReferences
      : fallback.scriptureReferences,
    keyPoints: Array.isArray(response.data.keyPoints) && response.data.keyPoints.length
      ? response.data.keyPoints
      : fallback.keyPoints,
    slides,
  };
};

// ─── AI Assist Query ──────────────────────────────────────────────────────────

export type AIAssistSectionType = 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'point' | 'body' | 'heading';

export interface AIAssistSection {
  label: string;
  type: AIAssistSectionType;
  text: string;
}

export interface AIAssistResult {
  title: string;
  intent: 'lyrics' | 'sermon' | 'announcement' | 'prayer' | 'unknown';
  source: 'ai';
  sections: AIAssistSection[];
  rawText: string;
  confidence: number;
  requiresManualInput?: boolean;
}

export const assistQueryWithAI = async (query: string, mode: string): Promise<AIAssistResult | null> => {
  const response = await postAi('/api/ai/assist-query', { query, mode }, 45000);
  if (!response?.ok || !response?.data) return null;
  return response.data as AIAssistResult;
};
