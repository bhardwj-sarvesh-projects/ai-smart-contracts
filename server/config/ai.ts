/**
 * AI Configuration
 * This file is used ONLY by the backend.
 * The frontend must never import it.
 */

export const AI_CONFIG = {
  provider: "openai",

  timeout: 60000,

  openai: {
    apiKey: "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",
    model: "gpt-5-mini",
  },

  groq: {
    apiKey: "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",
    model: "llama-3.3-70b-versatile",
    baseURL: "https://api.groq.com/openai/v1",
  },

  gemini: {
    apiKey: "",
    model: "",
  },
};

export const OPENAI_API_KEY = AI_CONFIG.openai.apiKey;

export const OPENAI_MODEL = AI_CONFIG.openai.model;

export const OPENAI_TIMEOUT = AI_CONFIG.timeout;