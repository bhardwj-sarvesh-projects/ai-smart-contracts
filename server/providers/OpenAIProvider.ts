import OpenAI from "openai";
import { AIProvider, AIResponse, HealthResponse } from "./AIProvider";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: { apiKey: string; model?: string; temperature?: number; maxTokens?: number }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: 60000,
    });
    this.model = config.model || "gpt-4o-mini";
    this.temperature = typeof config.temperature === "number" ? config.temperature : 0.2;
    this.maxTokens = typeof config.maxTokens === "number" ? config.maxTokens : 2000;
    console.log(`[OPENAI PROVIDER] Initialized dynamically with model: ${this.model}`);
  }

  private async executeWithRetry(
    prompt: string,
    systemInstruction: string = "",
    responseMimeType: string = "text/plain",
    route: string = "unknown",
    retries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<AIResponse> {
    const startTime = Date.now();
    let lastError: any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log("--------------------------------");
        console.log("OPENAI REQUEST");
        console.log(`Model: ${this.model}`);
        console.log(`Route: ${route}`);
        console.log(`Prompt Length: ${prompt.length + (systemInstruction ? systemInstruction.length : 0)}`);
        console.log("--------------------------------");

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
            { role: "user" as const, content: prompt }
          ],
          response_format: responseMimeType === "application/json" ? { type: "json_object" } : undefined,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        });

        const text = response.choices[0]?.message?.content || "";
        const durationMs = Date.now() - startTime;

        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;
        const totalTokens = response.usage?.total_tokens ?? 0;

        console.log(`Prompt Tokens: ${promptTokens}`);
        console.log(`Completion Tokens: ${completionTokens}`);
        console.log(`Total Tokens: ${totalTokens}`);
        console.log(`Latency: ${durationMs}ms`);

        return {
          text,
          model: this.model,
          durationMs,
          usage: response.usage ? {
            promptTokens,
            completionTokens,
            totalTokens
          } : undefined
        };
      } catch (err: any) {
        lastError = err;

        console.error("--------------------------------");
        console.error("OPENAI FAILURE DETAILS");
        console.error("Full OpenAI error:", err);
        console.error("HTTP status:", err.status || "N/A");
        console.error("Error code:", err.code || "N/A");
        console.error("Stack trace:", err.stack || "N/A");
        console.error("--------------------------------");

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
    return this.executeWithRetry(prompt, systemInstruction, responseMimeType || "application/json", "/api/generate");
  }

  async edit(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json", "/api/edit");
  }

  async audit(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json", "/api/audit");
  }

  async plan(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json", "/api/generate-plan");
  }

  async compileAnalysis(prompt: string, systemInstruction?: string): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json", "/api/compile");
  }

  async healthCheck(): Promise<HealthResponse> {
    const startTime = Date.now();
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user" as const, content: "ping" }],
        max_tokens: 5
      });
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        modelUsed: this.model
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        modelUsed: this.model,
        error: err.message || "Failed to call chat.completions."
      };
    }
  }

  async testConnection(): Promise<any> {
    return this.healthCheck();
  }
}
