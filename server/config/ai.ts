/**
 * AI Configuration
 * This file is used ONLY by the backend.
 * The frontend must never import it.
 */

export const AI_CONFIG = {
  provider: "openai",

  timeout: 60000,

  openai: {
    apiKey: "PASTE_NEW_OPENAI_KEY_HERE",
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