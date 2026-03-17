
export type Role = 'user' | 'assistant';
export type BibleVersion = 'NIV' | 'KJV' | 'ESV' | 'NLT' | 'NKJV' | 'NASB';
export type AiProvider = 'gemini' | 'ollama';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  metadata?: {
    reference: string;
    topic: string;
    explanation: string;
    version?: BibleVersion;
    sources?: string[];
  };
}

export interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  reference: string;
  topic: string;
  explanation: string;
  version: BibleVersion;
  timestamp: Date;
  sources?: string[];
}

export interface GeminiResponse {
  answer: string;
  reference: string;
  topic: string;
  explanation: string;
  sources?: string[];
  error?: string;
}

export interface AiSettings {
  provider: AiProvider;
  ollamaHost: string;
  ollamaModel: string;
}
