
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse, BibleVersion, AiSettings } from "../types";

const getSystemInstruction = (version: BibleVersion) => `You are a wise and compassionate Bible scholar. 
Your primary goal is to provide spiritual wisdom grounded in the Holy Bible.

STRICT REQUIREMENTS:
1. You MUST use the ${version} (Bible translation) for all quotes and references.
2. When a user asks for a specific verse (e.g., "John 3:16"), the 'answer' field MUST contain ONLY the verbatim text of that verse from the ${version}.
3. Use Google Search grounding to find the EXACT text of the verse in the ${version} translation. You MUST use ONLY the text source from bible.com (YouVersion).
4. Do not use commentary or explanations as the source for the 'answer' text if a verse is requested.
5. Do not summarize or paraphrase the verse in the 'answer' field if the user is asking for the verse itself.

JSON STRUCTURE:
- 'answer': The verbatim text of the verse from ${version} (if a verse is requested) OR a thoughtful spiritual response.
- 'reference': The specific book, chapter, and verse (e.g., "John 3:16").
- 'topic': A single word describing the theme.
- 'explanation': 1-2 sentences of spiritual context or application.

Return ONLY valid JSON.`;

const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3): Promise<any> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";
      if ((errorMsg.includes("503") || errorMsg.includes("429")) && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

export const getBibleWisdom = async (
  prompt: string, 
  version: BibleVersion, 
  settings: AiSettings
): Promise<GeminiResponse> => {
  if (settings.provider === 'ollama') {
    return getOllamaWisdom(prompt, version, settings);
  }
  return getGeminiWisdom(prompt, version);
};

const getOllamaWisdom = async (prompt: string, version: BibleVersion, settings: AiSettings): Promise<GeminiResponse> => {
  try {
    const response = await fetch(`${settings.ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.ollamaModel,
        messages: [
          { role: 'system', content: getSystemInstruction(version) + " Output in JSON format with keys: answer, reference, topic, explanation." },
          { role: 'user', content: prompt }
        ],
        stream: false,
        format: 'json'
      })
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    const data = await response.json();
    const content = JSON.parse(data.message.content);
    
    return {
      answer: content.answer,
      reference: content.reference,
      topic: content.topic,
      explanation: content.explanation
    };
  } catch (error: any) {
    console.error("Ollama Error:", error);
    return { 
      answer: "Local Service Error", 
      reference: "", 
      topic: "Network", 
      explanation: "", 
      error: "Could not connect to Ollama. Ensure Ollama is running and OLLAMA_ORIGINS='*' is set." 
    };
  }
};

const getGeminiWisdom = async (prompt: string, version: BibleVersion): Promise<GeminiResponse> => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return { answer: "Error", reference: "", topic: "Config", explanation: "", error: "Gemini API Key missing in environment." };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(version) + " Use Google Search grounding to verify Bible verses and find relevant spiritual web sources if needed.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { 
              type: Type.STRING,
              description: "The verbatim verse text from the requested translation if a verse is asked for, otherwise a spiritual response."
            },
            reference: { type: Type.STRING },
            topic: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["answer", "reference", "topic", "explanation"],
        },
        temperature: 0,
        tools: [{ googleSearch: {} }],
      },
    }));

    const content = JSON.parse(response.text || "{}");
    
    // Extract grounding sources
    const sources: string[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri) sources.push(chunk.web.uri);
      });
    }

    return {
      ...content,
      sources: sources.length > 0 ? Array.from(new Set(sources)) : undefined
    };
  } catch (error: any) {
    return { answer: "Error", reference: "", topic: "Error", explanation: "", error: error.message };
  }
};
