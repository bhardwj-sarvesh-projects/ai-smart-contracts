export interface AIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  durationMs: number;
}

export interface HealthResponse {
  success: boolean;
  latencyMs: number;
  modelUsed: string;
  error?: string;
}

export interface AIProvider {
  readonly name: string;

  generate(
    prompt: string,
    systemInstruction?: string,
    responseMimeType?: string
  ): Promise<AIResponse>;

  edit(
    prompt: string,
    systemInstruction?: string
  ): Promise<AIResponse>;

  audit(
    prompt: string,
    systemInstruction?: string
  ): Promise<AIResponse>;

  plan(
    prompt: string,
    systemInstruction?: string
  ): Promise<AIResponse>;

  compileAnalysis(
    prompt: string,
    systemInstruction?: string
  ): Promise<AIResponse>;

  healthCheck(): Promise<HealthResponse>;

  testConnection(): Promise<any>;
}