export type AIProvider =
  | "openai"
  | "groq"
  | "anthropic";

export interface AISettings {
  provider: AIProvider;

  apiKey: string;

  model: string;

  temperature: number;

  maxTokens: number;

  stream: boolean;
}
