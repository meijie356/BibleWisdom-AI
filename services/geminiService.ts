
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse, BibleVersion } from "../types";

const getSystemInstruction = (version: BibleVersion) => `You are a wise and compassionate Bible scholar. 
Provide answers based strictly on Bible teachings using the ${version} translation. 
The 'answer' field should be approximately 2 verses in length (roughly 40-60 words). 
The 'reference' should be the specific Bible verse(s) used (e.g., John 3:16-17).
The 'topic' should be a single word or short phrase describing the subject (e.g., Love, Faith, Patience).
The 'explanation' field should provide 2-3 sentences of deeper context, theological meaning, or practical application of the teaching.`;

export const getBibleWisdom = async (prompt: string, version: BibleVersion): Promise<GeminiResponse> => {
  const apiKey = process.env.API_KEY || '';
  
  if (!apiKey) {
    return { 
      answer: "Error", 
      reference: "", 
      topic: "Config", 
      explanation: "", 
      error: "API Key is missing. Please check your environment configuration."
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
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
              description: `A biblical answer in the ${version} version, approximately 2 verses in length.`,
            },
            reference: {
              type: Type.STRING,
              description: "The Bible verse reference(s).",
            },
            topic: {
              type: Type.STRING,
              description: "A short topic category.",
            },
            explanation: {
              type: Type.STRING,
              description: "A more detailed 2-3 sentence explanation.",
            },
          },
          required: ["answer", "reference", "topic", "explanation"],
        },
        temperature: 0.7,
      },
    });

    const jsonStr = response.text || "{}";
    const result = JSON.parse(jsonStr);
    
    return {
      answer: result.answer || "I could not find a scriptural answer.",
      reference: result.reference || "Unknown Reference",
      topic: result.topic || "Spiritual Wisdom",
      explanation: result.explanation || "No further explanation available."
    };
  } catch (error) {
    console.error("Gemini API Error Detail:", error);
    
    let errorMessage = "Network connection issue. Please check your signal or VPN.";
    
    if (error instanceof Error) {
      if (error.message.includes('API_KEY_INVALID')) {
        errorMessage = "Invalid API Key. Configuration issue.";
      } else if (error.message.includes('fetch')) {
        errorMessage = "Network request failed. Ensure your iPhone is online and not blocking the Google API.";
      } else {
        errorMessage = error.message;
      }
    }

    return { 
      answer: "Connection Interrupted",
      reference: "",
      topic: "Error",
      explanation: "",
      error: errorMessage
    };
  }
};
