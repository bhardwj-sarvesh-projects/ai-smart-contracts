import { AI_TEMPERATURE, GLOBAL_MAX_OUTPUT_TOKENS } from "./aiPolicy";

export const OPENAI_API_KEY = "";
export const OPENAI_MODEL = "platform-router";
export const OPENAI_TIMEOUT = 90000;

export const AI_CONFIG = Object.freeze({
  provider: "groq",
  temperature: AI_TEMPERATURE,
  maxTokens: GLOBAL_MAX_OUTPUT_TOKENS,
  openai: { apiKey: "", model: OPENAI_MODEL },
  groq: { apiKey: "", model: OPENAI_MODEL },
});
