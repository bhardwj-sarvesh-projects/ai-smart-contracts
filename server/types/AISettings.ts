export type AIProvider =
  | "openai"
  | "groq"
  | "anthropic"
  | "openrouter";

export interface AISettings {
  provider: AIProvider;

  apiKey: string;

  model: string;

  temperature: number;

  maxTokens: number;

  stream: boolean;
}
