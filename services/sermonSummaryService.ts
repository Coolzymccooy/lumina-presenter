import { postAi } from "./geminiService";

export interface SermonSummary {
  title: string;
  mainTheme: string;
  keyPoints: string[];
  scripturesReferenced: string[];
  callToAction: string;
  quotableLines: string[];
}

export interface SermonSummaryResult {
  ok: boolean;
  summary?: SermonSummary;
  error?: string;
  durationMs?: number;
}

// Minimum words required to attempt summarization
const MIN_WORDS_FOR_SUMMARY = 40;

export const canSummarize = (transcript: string): boolean =>
  transcript.trim().split(/\s+/).filter(Boolean).length >= MIN_WORDS_FOR_SUMMARY;

export const summarizeSermon = async (
  transcript: string,
  accentHint?: string
): Promise<SermonSummaryResult> => {
  const trimmed = transcript.trim();
  if (!canSummarize(trimmed)) {
    return {
      ok: false,
      error: `At least ${MIN_WORDS_FOR_SUMMARY} words are needed for a summary. Keep recording.`,
    };
  }

  const startedAt = Date.now();
  const result = await postAi(
    "/api/ai/summarize-sermon",
    { transcript: trimmed, accentHint: accentHint || "standard" },
    90_000
  );

  if (!result?.ok) {
    return {
      ok: false,
      error: result?.message || "Summarization failed. Try again.",
    };
  }

  const data = result.summary as SermonSummary | undefined;
  if (!data) {
    return { ok: false, error: "Server returned an empty summary." };
  }

  return {
    ok: true,
    summary: data,
    durationMs: Date.now() - startedAt,
  };
};

export const formatTranscriptDuration = (wordCount: number): string => {
  // Average spoken English: ~130 words per minute
  const minutes = Math.round(wordCount / 130);
  if (minutes < 1) return "< 1 min";
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
};
