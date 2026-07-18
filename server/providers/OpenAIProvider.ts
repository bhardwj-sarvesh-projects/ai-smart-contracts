import OpenAI from "openai";

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

export interface AIProvider {
  name: string;
  generate(prompt: string, systemInstruction?: string, responseMimeType?: string): Promise<AIResponse>;
  edit(prompt: string, systemInstruction?: string): Promise<AIResponse>;
  audit(prompt: string, systemInstruction?: string): Promise<AIResponse>;
  plan(prompt: string, systemInstruction?: string): Promise<AIResponse>;
  compileAnalysis(prompt: string, systemInstruction?: string): Promise<AIResponse>;
  healthCheck(): Promise<{ success: boolean; latencyMs: number; modelUsed: string; error?: string }>;
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI | null = null;
  private defaultModel = "gpt-4o"; // Safe stable default for enterprise generation

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        this.client = new OpenAI({
          apiKey,
          timeout: 60000, // 60s timeout
        });
        console.log("[OPENAI PROVIDER] OpenAI client successfully initialized.");
      } catch (err) {
        console.error("[OPENAI PROVIDER] Failed to initialize OpenAI client:", err);
      }
    } else {
      console.warn("[OPENAI PROVIDER] No OPENAI_API_KEY found in process.env.");
    }
  }

  private getModel(): string {
    return process.env.AI_MODEL || this.defaultModel;
  }

  // Centred robust request executor with exponential backoff retry and tracking
  private async executeWithRetry(
    prompt: string,
    systemInstruction: string = "",
    responseMimeType: string = "text/plain",
    retries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<AIResponse> {
    if (!this.client) {
      throw new Error("OpenAI API client is not initialized. Please configure OPENAI_API_KEY.");
    }

    const model = this.getModel();
    const startTime = Date.now();
    let lastError: any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[OPENAI PROVIDER] Requesting ${model} (Attempt ${attempt}/${retries}) - MIME Type: ${responseMimeType}`);
        
        const response = await this.client.chat.completions.create({
          model,
          messages: [
            ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
            { role: "user" as const, content: prompt }
          ],
          response_format: responseMimeType === "application/json" ? { type: "json_object" } : undefined,
          temperature: 0.2, // low temperature for precise, compliant smart contracts
        });

        const text = response.choices[0]?.message?.content || "";
        const durationMs = Date.now() - startTime;

        console.log(`[OPENAI PROVIDER] Success in ${durationMs}ms. Usage: ${JSON.stringify(response.usage || {})}`);

        return {
          text,
          model,
          durationMs,
          usage: response.usage ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens
          } : undefined
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[OPENAI PROVIDER] Attempt ${attempt} failed:`, err.message || err);
        if (attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async generate(prompt: string, systemInstruction?: string, responseMimeType?: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, responseMimeType || "application/json");
  }

  async edit(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json");
  }

  async audit(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json");
  }

  async plan(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json");
  }

  async compileAnalysis(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json");
  }

  async healthCheck(): Promise<{ success: boolean; latencyMs: number; modelUsed: string; error?: string }> {
    const startTime = Date.now();
    if (!this.client) {
      return {
        success: false,
        latencyMs: 0,
        modelUsed: this.getModel(),
        error: "Client not initialized due to missing OPENAI_API_KEY."
      };
    }

    try {
      await this.client.chat.completions.create({
        model: this.getModel(),
        messages: [{ role: "user" as const, content: "ping" }],
        max_tokens: 5
      });
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        modelUsed: this.getModel()
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        modelUsed: this.getModel(),
        error: err.message || "Failed to call chat.completions."
      };
    }
  }
}
