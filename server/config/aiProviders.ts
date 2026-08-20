/**
 * Platform provider registry.
 *
 * AI Contracts production execution is intentionally Groq-only. The registry
 * remains as a small compatibility boundary for older imports, but it exposes
 * no alternative provider routes.
 */
export type AIProtocol = "openai-compatible";

export interface AIProviderDefinition {
  id: "groq";
  label: "Groq";
  protocol: AIProtocol;
  baseUrl: "https://api.groq.com/openai/v1";
  docsHint: string;
}

export const GROQ_PROVIDER: AIProviderDefinition = Object.freeze({
  id: "groq",
  label: "Groq",
  protocol: "openai-compatible",
  baseUrl: "https://api.groq.com/openai/v1",
  docsHint: "Groq OpenAI-compatible API",
});

export const AI_PROVIDER_REGISTRY: Readonly<Record<string, AIProviderDefinition>> = Object.freeze({
  groq: GROQ_PROVIDER,
});

export const AI_PROVIDER_OPTIONS = Object.freeze([GROQ_PROVIDER]);

export function getAIProviderDefinition(provider: string): AIProviderDefinition {
  if (String(provider || "").trim().toLowerCase() !== "groq") {
    throw new Error("AI Contracts production routing supports Groq only.");
  }
  return GROQ_PROVIDER;
}
