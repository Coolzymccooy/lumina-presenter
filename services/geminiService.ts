
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedSlideData } from "../types";

// Follow Guidelines: Initialize GoogleGenAI client right before making an API call to ensure latest API key usage
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSlidesFromText = async (text: string): Promise<GeneratedSlideData | null> => {
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Break the following text into presentation slides for a church service. 
      Identify sections like 'Verse', 'Chorus', 'Bridge', or 'Point'.
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
                  label: { type: Type.STRING, description: "Label like Verse 1, Chorus, etc." },
                  content: { type: Type.STRING, description: "The lyrics or text content for the slide" }
                },
                required: ["label", "content"]
              }
            }
          },
          required: ["slides"]
        }
      }
    });

    // Follow Guidelines: Access the extracted string output via .text property and trim whitespace
    const jsonStr = response.text?.trim();
    if (jsonStr) {
      return JSON.parse(jsonStr) as GeneratedSlideData;
    }
    return null;
  } catch (error) {
    console.error("Error generating slides:", error);
    return null;
  }
};

/**
 * Uses semantic reasoning to find relevant bible verses based on a topic or emotion.
 */
export const semanticBibleSearch = async (query: string): Promise<string> => {
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a biblical scholar. Given the user's input (topic, emotion, or situation), provide the single best Bible reference (Book Chapter:Verse) to address it.
      
      User Input: "${query}"
      
      Return ONLY the reference (e.g., 'Philippians 4:13' or 'Psalm 23:1-4').`,
    });
    // Follow Guidelines: Use .text property directly
    return response.text?.trim() || "John 3:16";
  } catch (error) {
    console.error("Semantic search failed", error);
    return query; // Fallback to literal query
  }
};

/**
 * Generates a cinematic, high-quality background image based on the imagery of a verse.
 */
export const generateVisionaryBackdrop = async (verseText: string): Promise<string | null> => {
  const ai = getAi();
  try {
    // Step 1: Generate a detailed artistic prompt from the verse
    const promptResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a Christian Art Director. Translate the essence and visual imagery of this Bible verse into a detailed prompt for a high-quality cinematic background image. 
      Focus on atmosphere, lighting, and symbolism. Avoid including any human faces or text in the image. Use a 16:9 cinematic aspect ratio style.
      
      Verse: "${verseText}"
      
      Return ONLY the art prompt.`,
    });

    const artPrompt = promptResponse.text?.trim() || "A peaceful, atmospheric background with soft golden light and subtle clouds, cinematic 4k.";

    // Step 2: Generate the actual image using nano banana (Gemini 2.5 Flash Image)
    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `High resolution, cinematic church presentation background: ${artPrompt}. Atmosphere is reverent and awe-inspiring. 4k resolution, no text, no people.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    // Follow Guidelines: Iterate through candidates and parts to find the image part (inlineData)
    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Image generation failed", error);
    return null;
  }
};

/**
 * Suggests a visual theme based on context.
 */
export const suggestVisualTheme = async (contextText: string): Promise<string> => {
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on the following lyrics or text, suggest a single visual keyword for a background image search (e.g., 'mountains', 'worship', 'cross', 'sky', 'hands', 'city').
      Return ONLY the keyword.
      
      Text: "${contextText.substring(0, 500)}..."`
    });
    // Follow Guidelines: Use .text property
    return response.text?.trim() || "abstract";
  } catch (error) {
    console.error("Theme suggestion failed", error);
    return "abstract";
  }
};
