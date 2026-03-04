import type { GeneratedSlideData } from "../types";
import { getServerApiBaseCandidates, getServerApiBaseUrl } from "./serverApi";

type AiJson = {
  ok?: boolean;
  error?: string;
  message?: string;
  retryAfterMs?: number;
  [key: string]: any;
};

const postAi = async (path: string, payload: Record<string, unknown>, timeoutMs = 45000): Promise<AiJson | null> => {
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
  const response = await postAi("/api/ai/generate-slides", { text }, 30000);
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
  const response = await postAi('/api/ai/transcribe-sermon-chunk', payload, 10000);
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

  if (errorCode === 'TRANSCRIBE_COOLDOWN') {
    return {
      ok: false,
      mode: 'cooldown',
      retryAfterMs: Number.isFinite(retryAfterMs) ? Math.max(0, retryAfterMs) : 0,
      error: errorCode,
      message,
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

export const semanticBibleSearch = async (query: string): Promise<string> => {
  const sanitizedQuery = String(query || "").trim();
  if (!sanitizedQuery) return "Psalm 23:1-4";

  const response = await postAi("/api/ai/semantic-bible-search", { query: sanitizedQuery }, 20000);
  const reference = extractBibleReference(response?.reference);
  const looksLikeDefaultJohn = reference ? JOHN_316_PATTERN.test(reference) : false;
  const userAskedForJohn316 = /john\s*3:16|for god so loved|eternal life|believe/i.test(sanitizedQuery);

  if (response?.ok && reference && (!looksLikeDefaultJohn || userAskedForJohn316)) {
    return reference;
  }

  return inferSemanticFallbackReference(sanitizedQuery);
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
