
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse, BibleVersion } from "../types";

const getSystemInstruction = (version: BibleVersion) => `You are a wise and compassionate Bible scholar. 
Provide answers based strictly on Bible teachings using the ${version} translation. 
The 'answer' field should be a thoughtful, impactful, and spiritual response. It should be concise and avoid filler, but prioritized for depth and meaning rather than a strict word count.
The 'reference' should be the specific Bible verse(s) used.
The 'topic' should be a single word describing the subject.
The 'explanation' field should provide 1-2 sentences of further spiritual context to help the seeker understand the application.`;

/**
 * Helper to handle retries with exponential backoff for transient errors like 503
 */
const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3): Promise<any> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";
      const isRetryable = errorMsg.includes("503") || 
                          errorMsg.includes("429") || 
                          errorMsg.includes("overloaded") ||
                          errorMsg.includes("fetch");
                          
      if (isRetryable && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

export const getBibleWisdom = async (prompt: string, version: BibleVersion): Promise<GeminiResponse> => {
  const apiKey = process.env.API_KEY || '';
  
  if (!apiKey) {
    return { 
      answer: "Error", 
      reference: "", 
      topic: "Config", 
      explanation: "", 
      error: "API Key is missing."
    };
  }

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
            answer: {
              type: Type.STRING,
              description: `A thoughtful and impactful biblical response in ${version}.`,
            },
            reference: {
              type: Type.STRING,
              description: "The Bible verse reference.",
            },
            topic: {
              type: Type.STRING,
              description: "Short topic.",
            },
            explanation: {
              type: Type.STRING,
              description: "1-2 sentence context.",
            },
          },
          required: ["answer", "reference", "topic", "explanation"],
        },
        temperature: 0.5,
      },
    }));

    const jsonStr = result.text || "{}";
    const data = JSON.parse(jsonStr);
    
    return {
      answer: data.answer || "No scriptural answer found.",
      reference: data.reference || "Unknown",
      topic: data.topic || "Wisdom",
      explanation: data.explanation || ""
    };
  } catch (error: any) {
    console.error("Gemini API Final Error:", error);
    
    let errorMessage = "The service is currently busy. Please wait a moment and try again.";
    
    const errorString = typeof error === 'string' ? error : JSON.stringify(error);
    if (errorString.includes("503") || errorString.includes("overloaded")) {
      errorMessage = "Google's AI servers are currently at capacity. Please try again in a few seconds.";
    } else if (errorString.includes("429")) {
      errorMessage = "Too many requests. Please slow down a bit.";
    } else if (error.message && error.message.includes("fetch")) {
      errorMessage = "Connection lost. Please check your internet or VPN.";
    }

    return { 
      answer: "Connection Issue",
      reference: "",
      topic: "Error",
      explanation: "",
      error: errorMessage
    };
  }
};
