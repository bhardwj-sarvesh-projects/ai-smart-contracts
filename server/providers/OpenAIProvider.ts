import OpenAI from "openai";
import { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TIMEOUT } from "../../src/config/openai";

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
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: OPENAI_API_KEY,
      timeout: OPENAI_TIMEOUT
    });
    console.log("[OPENAI PROVIDER] OpenAI client successfully initialized using central config.");
  }

  // Centred robust request executor with exponential backoff retry and tracking
  private async executeWithRetry(
    prompt: string,
    systemInstruction: string = "",
    responseMimeType: string = "text/plain",
    retries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<AIResponse> {
    const startTime = Date.now();
    let lastError: any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Step 8: Improve logging
        console.log("--------------------------------");
        console.log("Provider: OpenAI");
        console.log(`Model: ${OPENAI_MODEL}`);
        console.log("--------------------------------");
        
        const response = await this.client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
            { role: "user" as const, content: prompt }
          ],
          response_format: responseMimeType === "application/json" ? { type: "json_object" } : undefined,
          temperature: 0.2, // low temperature for precise, compliant smart contracts
        });

        const text = response.choices[0]?.message?.content || "";
        const durationMs = Date.now() - startTime;

        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;
        const totalTokens = response.usage?.total_tokens ?? 0;

        // Step 8: Print latency and tokens after request
        console.log(`Latency: ${durationMs}ms`);
        console.log(`Prompt Tokens: ${promptTokens}`);
        console.log(`Completion Tokens: ${completionTokens}`);
        console.log(`Total Tokens: ${totalTokens}`);

        return {
          text,
          model: OPENAI_MODEL,
          durationMs,
          usage: response.usage ? {
            promptTokens,
            completionTokens,
            totalTokens
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
    try {
      await this.client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user" as const, content: "ping" }],
        max_tokens: 5
      });
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        modelUsed: OPENAI_MODEL
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        modelUsed: OPENAI_MODEL,
        error: err.message || "Failed to call chat.completions."
      };
    }
  }
}
