import type { GeneratedSlideData } from "../types";
import { getServerApiBaseUrl } from "./serverApi";

type AiJson = {
  ok?: boolean;
  error?: string;
  message?: string;
  [key: string]: any;
};

const postAi = async (path: string, payload: Record<string, unknown>, timeoutMs = 45000): Promise<AiJson | null> => {
  const apiBase = getServerApiBaseUrl();
  if (!apiBase) return null;

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
      return {
        ok: false,
        error: json?.error || `HTTP_${response.status}`,
        message: json?.message || `AI request failed (${response.status})`,
      };
    }

    return (json && typeof json === "object") ? json : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
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

export const generateSlidesFromText = async (text: string): Promise<GeneratedSlideData | null> => {
  const response = await postAi("/api/ai/generate-slides", { text }, 30000);
  if (!response?.ok || !response?.data?.slides) return null;
  const slides = sanitizeSlides(response.data.slides);
  return slides.length ? { slides } : null;
};

export const semanticBibleSearch = async (query: string): Promise<string> => {
  const response = await postAi("/api/ai/semantic-bible-search", { query }, 20000);
  if (!response?.ok) return "John 3:16";
  return String(response.reference || "").trim() || "John 3:16";
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
