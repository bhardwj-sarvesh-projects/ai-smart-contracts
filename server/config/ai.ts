/**
 * AI Configuration
 * This file is used ONLY by the backend.
 * The frontend must never import it.
 */

import { isDummyOrEmptyKey } from "../providers/ProviderFactory";

export const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || "openai",

  timeout: 60000,

  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: "gpt-4o-mini",
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || "",
    model: "llama-3.3-70b-versatile",
    baseURL: "https://api.groq.com/openai/v1",
  },
};

export const OPENAI_API_KEY = AI_CONFIG.openai.apiKey;

export const OPENAI_MODEL = AI_CONFIG.openai.model;

export const OPENAI_TIMEOUT = AI_CONFIG.timeout;
