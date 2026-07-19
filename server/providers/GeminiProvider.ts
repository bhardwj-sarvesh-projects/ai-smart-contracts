import { GoogleGenAI } from "@google/genai";
import { AIProvider, AIResponse, HealthResponse } from "./AIProvider";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private ai: GoogleGenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: { apiKey: string; model?: string; temperature?: number; maxTokens?: number }) {
    this.ai = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    this.model = config.model || "gemini-3.5-flash";
    this.temperature = typeof config.temperature === "number" ? config.temperature : 0.2;
    this.maxTokens = typeof config.maxTokens === "number" ? config.maxTokens : 2000;
    console.log(`[GEMINI PROVIDER] Initialized dynamically with model: ${this.model}`);
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
        console.log("GEMINI REQUEST");
        console.log(`Model: ${this.model}`);
        console.log(`Route: ${route}`);
        console.log(`Prompt Length: ${prompt.length + (systemInstruction ? systemInstruction.length : 0)}`);
        console.log("--------------------------------");

        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: prompt,
          config: {
            systemInstruction: systemInstruction || undefined,
            temperature: this.temperature,
            maxOutputTokens: this.maxTokens,
            responseMimeType: responseMimeType === "application/json" ? "application/json" : undefined,
          },
        });

        const text = response.text || "";
        const durationMs = Date.now() - startTime;

        // Note: usage metadata may be present on the response metadata or response.usageMetadata
        const promptTokens = (response as any).usageMetadata?.promptTokenCount ?? 0;
        const completionTokens = (response as any).usageMetadata?.candidatesTokenCount ?? 0;
        const totalTokens = (response as any).usageMetadata?.totalTokenCount ?? 0;

        console.log(`Prompt Tokens: ${promptTokens}`);
        console.log(`Completion Tokens: ${completionTokens}`);
        console.log(`Total Tokens: ${totalTokens}`);
        console.log(`Latency: ${durationMs}ms`);

        return {
          text,
          model: this.model,
          durationMs,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens,
          },
        };
      } catch (err: any) {
        lastError = err;

        console.error("--------------------------------");
        console.error("GEMINI FAILURE DETAILS");
        console.error("Full Gemini error:", err);
        console.error("Stack trace:", err.stack || "N/A");
        console.error("--------------------------------");

        console.warn(`[GEMINI PROVIDER] Attempt ${attempt} failed:`, err.message || err);
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
      await this.ai.models.generateContent({
        model: this.model,
        contents: "ping",
        config: {
          maxOutputTokens: 5,
        },
      });
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        modelUsed: this.model,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        modelUsed: this.model,
        error: err.message || "Failed to call generateContent on Gemini.",
      };
    }
  }

  async testConnection(): Promise<any> {
    return this.healthCheck();
  }
}
