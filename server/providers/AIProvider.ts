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

export interface RequestOptions {
  maxTokens?: number;
  targetPath?: string;
  routeAttempt?: number;
}

export interface AIProvider {
  readonly name: string;

  generate(
    prompt: string,
    systemInstruction?: string,
    responseMimeType?: string,
    options?: RequestOptions
  ): Promise<AIResponse>;

  edit(
    prompt: string,
    systemInstruction?: string,
    options?: RequestOptions
  ): Promise<AIResponse>;

  audit(
    prompt: string,
    systemInstruction?: string,
    options?: RequestOptions
  ): Promise<AIResponse>;

  plan(
    prompt: string,
    systemInstruction?: string,
    options?: RequestOptions
  ): Promise<AIResponse>;

  compileAnalysis(
    prompt: string,
    systemInstruction?: string,
    options?: RequestOptions
  ): Promise<AIResponse>;

  healthCheck(): Promise<HealthResponse>;

  testConnection(): Promise<any>;
}