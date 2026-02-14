// services/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import type { GeneratedSlideData } from "../types";

/**
 * Vite browser env var:
 * - set this in .env.local as: VITE_GOOGLE_AI_API_KEY=xxxx
 */
const getApiKeyOrThrow = (): string => {
  const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY as string | undefined;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("Missing VITE_GOOGLE_AI_API_KEY");
  }
  return apiKey.trim();
};

/**
 * Create the client right before each call (simple + reliable in browser).
 */
const getAi = () => {
  const apiKey = getApiKeyOrThrow();
  return new GoogleGenAI({ apiKey });
};

export const generateSlidesFromText = async (
  text: string
): Promise<GeneratedSlideData | null> => {
  try {
    const ai = getAi();

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Break the following text into presentation slides for a church service.
Identify sections like "Verse", "Chorus", "Bridge", or "Point".
Keep slide content concise (max 4-6 lines).

Text to process:
${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: "Verse 1, Chorus, etc." },
                  content: { type: Type.STRING, description: "Slide text (4-6 lines max)" },
                },
                required: ["label", "content"],
              },
            },
          },
          required: ["slides"],
        },
      },
    });

    const jsonStr = response.text?.trim();
    return jsonStr ? (JSON.parse(jsonStr) as GeneratedSlideData) : null;
  } catch (e) {
    // MVP-safe: don’t crash the app
    console.error("generateSlidesFromText failed:", e);
    return null;
  }
};

/**
 * Used by BibleBrowser.tsx
 * Returns a single best reference string.
 */
export const semanticBibleSearch = async (query: string): Promise<string> => {
  try {
    const ai = getAi();

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a biblical scholar. Given the user's input (topic, emotion, or situation),
provide the single best Bible reference (Book Chapter:Verse) to address it.

User Input: "${query}"

Return ONLY the reference (e.g., "Philippians 4:13" or "Psalm 23:1-4").`,
    });

    return response.text?.trim() || "John 3:16";
  } catch (e) {
    console.error("semanticBibleSearch failed:", e);
    return "John 3:16";
  }
};

/**
 * Used by BibleBrowser.tsx
 * Returns a data URL (base64) or null.
 */
export const generateVisionaryBackdrop = async (
  verseText: string
): Promise<string | null> => {
  try {
    const ai = getAi();

    // 1) turn verse into an art prompt
    const promptResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a Christian Art Director. Translate the essence and visual imagery of this Bible verse
into a detailed prompt for a high-quality cinematic background image.
Focus on atmosphere, lighting, symbolism. Avoid any human faces or text in the image.
Use a 16:9 cinematic style.

Verse: "${verseText}"

Return ONLY the art prompt.`,
    });

    const artPrompt =
      promptResponse.text?.trim() ||
      "A peaceful, atmospheric background with soft golden light and subtle clouds, cinematic 4k, no text.";

    // 2) generate the image
    const imageResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `High resolution, cinematic church presentation background: ${artPrompt}.
No text. No people. 16:9. 4k.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    const parts = imageResponse.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if ((part as any).inlineData?.data) {
        return `data:image/png;base64,${(part as any).inlineData.data}`;
      }
    }

    return null;
  } catch (e) {
    console.error("generateVisionaryBackdrop failed:", e);
    return null;
  }
};

/**
 * Used by AIModal.tsx
 * Returns a single keyword.
 */
export const suggestVisualTheme = async (contextText: string): Promise<string> => {
  try {
    const ai = getAi();

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on the following lyrics or text, suggest a single visual keyword for a background image search
(e.g., "mountains", "worship", "cross", "sky", "hands", "city"). Return ONLY the keyword.

Text:
${contextText.slice(0, 500)}`,
    });

    return response.text?.trim() || "abstract";
  } catch (e) {
    console.error("suggestVisualTheme failed:", e);
    return "abstract";
  }
};


export interface SermonAnalysisResult {
  scriptureReferences: string[];
  keyPoints: string[];
  slides: { label: string; content: string }[];
}

const scriptureRegex = /\b(?:[1-3]\s)?[A-Za-z]+\s\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/g;

export const analyzeSermonAndGenerateDeck = async (sermonText: string): Promise<SermonAnalysisResult> => {
  const references = Array.from(new Set((sermonText.match(scriptureRegex) || []).slice(0, 12)));
  const paragraphs = sermonText
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);

  const keyPoints = paragraphs.slice(0, 8).map((part, index) => {
    const compact = part.replace(/\s+/g, ' ').trim();
    return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact || `Point ${index + 1}`;
  });

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a sermon slide architect. Analyze the sermon text and return JSON with:
1) scriptureReferences: array of references found
2) keyPoints: concise bullet points
3) slides: exactly 20 slides with label/content for a preaching deck.

Sermon Text:
${sermonText}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scriptureReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ['label', 'content'],
              },
            },
          },
          required: ['scriptureReferences', 'keyPoints', 'slides'],
        },
      },
    });

    const parsed = response.text?.trim() ? JSON.parse(response.text.trim()) : null;
    if (parsed?.slides?.length) {
      const normalizedSlides = parsed.slides.slice(0, 20);
      while (normalizedSlides.length < 20) {
        const idx = normalizedSlides.length + 1;
        normalizedSlides.push({
          label: `Application ${idx}`,
          content: keyPoints[idx % Math.max(keyPoints.length, 1)] || `Reflection point ${idx}`,
        });
      }
      return {
        scriptureReferences: parsed.scriptureReferences?.length ? parsed.scriptureReferences : references,
        keyPoints: parsed.keyPoints?.length ? parsed.keyPoints : keyPoints,
        slides: normalizedSlides,
      };
    }
  } catch (error) {
    console.error('analyzeSermonAndGenerateDeck failed:', error);
  }

  const fallbackSlides = Array.from({ length: 20 }).map((_, idx) => ({
    label: idx === 0 ? 'Title' : idx <= references.length ? `Scripture ${idx}` : `Point ${idx}`,
    content:
      idx === 0
        ? 'Sermon Overview'
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
