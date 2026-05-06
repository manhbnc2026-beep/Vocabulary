import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface WordAnalysis {
  text: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  examples: string[];
  imagePrompt: string;
}

export async function extractWordsFromImage(base64Image: string): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extract all English words from this image. Keep it as a simple list separated by commas or lines. Return ONLY the words, no extra text." },
            {
              inlineData: {
                data: base64Image.split(",")[1],
                mimeType: "image/jpeg"
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            words: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["words"]
        }
      }
    });

    const data = JSON.parse(response.text || '{"words": []}');
    return data.words || [];
  } catch (error: any) {
    console.error("Gemini OCR error:", error);
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('QUOTA_EXHAUSTED');
    }
    throw error;
  }
}

export async function analyzeWords(words: string[]): Promise<WordAnalysis[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following list of English words. For each word, provide:
1. Phonetic (IPA)
2. Part of speech
3. Meaning in Vietnamese
4. 2 simple example sentences in English with their Vietnamese translations.
5. A descriptive English prompt for an AI image generator that visually represents the first example sentence provided.

Words: ${words.join(", ")}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              phonetic: { type: Type.STRING },
              partOfSpeech: { type: Type.STRING },
              meaningVi: { type: Type.STRING },
              examples: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "English example with Vietnamese translation in parentheses"
              },
              imagePrompt: { 
                type: Type.STRING,
                description: "A detailed English prompt to generate an image specifically illustrating the context of the first example sentence."
              }
            },
            required: ["text", "phonetic", "partOfSpeech", "meaningVi", "examples", "imagePrompt"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('QUOTA_EXHAUSTED');
    }
    throw error;
  }
}
