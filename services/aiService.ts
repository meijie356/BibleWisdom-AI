
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse, BibleVersion, AiSettings } from "../types";

const getSystemInstruction = (version: BibleVersion) => `You are a wise and compassionate Bible scholar. 
Provide answers based strictly on Bible teachings using the ${version} translation. 
The 'answer' field should be a thoughtful, impactful, and spiritual response. 
The 'reference' should be the specific Bible verse(s) used.
The 'topic' should be a single word describing the subject.
The 'explanation' field should provide 1-2 sentences of further spiritual context.
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
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) return { answer: "Error", reference: "", topic: "Config", explanation: "", error: "Gemini API Key missing." };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(version),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            reference: { type: Type.STRING },
            topic: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["answer", "reference", "topic", "explanation"],
        },
        temperature: 0.5,
      },
    }));

    return JSON.parse(result.text || "{}");
  } catch (error: any) {
    return { answer: "Error", reference: "", topic: "Error", explanation: "", error: error.message };
  }
};
