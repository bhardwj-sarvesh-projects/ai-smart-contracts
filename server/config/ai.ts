import { AI_TEMPERATURE, GLOBAL_MAX_OUTPUT_TOKENS, GROQ_BASE_URL } from "./aiPolicy";

/**
 * Legacy compatibility configuration. Production execution is owned by
 * AIOrchestrator + AICredentialService and uses Groq credentials from Supabase.
 */
export const OPENAI_API_KEY = "";
export const OPENAI_MODEL = "platform-router";
export const OPENAI_TIMEOUT = 90000;

export const AI_CONFIG = Object.freeze({
  provider: "groq-platform-router",
  baseUrl: GROQ_BASE_URL,
  temperature: AI_TEMPERATURE,
  maxTokens: GLOBAL_MAX_OUTPUT_TOKENS,
});
