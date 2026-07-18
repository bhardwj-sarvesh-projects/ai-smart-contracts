import { GoogleGenAI } from "@google/genai";

// Standardize types for usage and token tracking
export interface UsageMetadata {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  text: string;
  usage?: UsageMetadata;
  model: string;
}

export interface AIProvider {
  name: string;
  generateContent(prompt: string, model: string, options?: { responseMimeType?: string; systemInstruction?: string }): Promise<AIResponse>;
  generateContentStream(prompt: string, model: string, onChunk: (text: string) => void, options?: { responseMimeType?: string; systemInstruction?: string }): Promise<AIResponse>;
  healthCheck(): Promise<boolean>;
  testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }>;
}

// Global Usage Tracker
export class UsageTracker {
  private static totalPromptTokens = 0;
  private static totalCompletionTokens = 0;
  private static totalCalls = 0;

  static track(promptTokens: number, completionTokens: number) {
    this.totalPromptTokens += promptTokens;
    this.totalCompletionTokens += completionTokens;
    this.totalCalls += 1;
    console.log(`[AI SERVICE TRACKING] Total Calls: ${this.totalCalls}, Prompt Tokens: ${this.totalPromptTokens}, Completion Tokens: ${this.totalCompletionTokens}`);
  }

  static getStats() {
    return {
      totalCalls: this.totalCalls,
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      totalTokens: this.totalPromptTokens + this.totalCompletionTokens
    };
  }
}

// Gemini implementation
export class GeminiProvider implements AIProvider {
  readonly name = "Gemini";
  private ai: GoogleGenAI | null = null;
  private allowedModels = [
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash"
  ];

  constructor(apiKey: string | undefined) {
    if (apiKey) {
      try {
        this.ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
        console.log("[AI PROVIDER] Gemini initialized successfully.");
      } catch (err) {
        console.error("[AI PROVIDER] Failed to initialize Gemini client:", err);
      }
    } else {
      console.warn("[AI PROVIDER] Warning: No GEMINI_API_KEY provided. Provider running in simulation mode.");
    }
  }

  private validateModel(model: string): string {
    if (this.allowedModels.includes(model)) {
      return model;
    }
    // Handle aliases and fallback
    if (model.includes("flash")) {
      return "gemini-3.5-flash";
    }
    if (model.includes("pro")) {
      return "gemini-3.1-pro-preview";
    }
    return "gemini-3.5-flash"; // Default safe model
  }

  async generateContent(
    prompt: string,
    model: string,
    options?: { responseMimeType?: string; systemInstruction?: string }
  ): Promise<AIResponse> {
    const validatedModel = this.validateModel(model);
    if (!this.ai) {
      throw new Error("Gemini AI Client is not initialized. Please verify GEMINI_API_KEY.");
    }

    let lastError: any = null;
    const retries = 3;
    const baseDelayMs = 1000;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[AI PROVIDER] Calling ${validatedModel} (Attempt ${attempt}/${retries})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await this.ai.models.generateContent({
          model: validatedModel,
          contents: prompt,
          config: {
            responseMimeType: options?.responseMimeType === "application/json" ? "application/json" : undefined,
            systemInstruction: options?.systemInstruction,
          }
        });

        clearTimeout(timeoutId);

        if (response && response.text) {
          // Track usage if metadata exists
          const usage: UsageMetadata = {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0
          };
          UsageTracker.track(usage.promptTokens, usage.candidatesTokens);

          return {
            text: response.text,
            usage,
            model: validatedModel
          };
        }
        throw new Error("Empty response returned from Gemini");
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI PROVIDER] Attempt ${attempt} failed:`, err.message || err);
        if (attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async generateContentStream(
    prompt: string,
    model: string,
    onChunk: (text: string) => void,
    options?: { responseMimeType?: string; systemInstruction?: string }
  ): Promise<AIResponse> {
    const validatedModel = this.validateModel(model);
    if (!this.ai) {
      throw new Error("Gemini AI Client is not initialized for streaming.");
    }

    console.log(`[AI PROVIDER] Starting streaming on ${validatedModel}`);
    const responseStream = await this.ai.models.generateContentStream({
      model: validatedModel,
      contents: prompt,
      config: {
        responseMimeType: options?.responseMimeType === "application/json" ? "application/json" : undefined,
        systemInstruction: options?.systemInstruction,
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
        onChunk(chunk.text);
      }
    }

    return {
      text: fullText,
      model: validatedModel
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.ai) return false;
    try {
      const res = await this.ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "ping",
      });
      return !!res.text;
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const success = await this.healthCheck();
      return {
        success,
        latencyMs: Date.now() - start,
        error: success ? undefined : "Ping failed to return text."
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err.message || "Failed healthCheck test."
      };
    }
  }
}

// Future providers stub
export class OpenAIProvider implements AIProvider {
  readonly name = "OpenAI (Stub)";
  async generateContent(): Promise<AIResponse> { throw new Error("OpenAIProvider not implemented."); }
  async generateContentStream(): Promise<AIResponse> { throw new Error("OpenAIProvider not implemented."); }
  async healthCheck(): Promise<boolean> { return false; }
  async testConnection() { return { success: false, latencyMs: 0, error: "Not implemented" }; }
}

export class ClaudeProvider implements AIProvider {
  readonly name = "Claude (Stub)";
  async generateContent(): Promise<AIResponse> { throw new Error("ClaudeProvider not implemented."); }
  async generateContentStream(): Promise<AIResponse> { throw new Error("ClaudeProvider not implemented."); }
  async healthCheck(): Promise<boolean> { return false; }
  async testConnection() { return { success: false, latencyMs: 0, error: "Not implemented" }; }
}

export class DeepSeekProvider implements AIProvider {
  readonly name = "DeepSeek (Stub)";
  async generateContent(): Promise<AIResponse> { throw new Error("DeepSeekProvider not implemented."); }
  async generateContentStream(): Promise<AIResponse> { throw new Error("DeepSeekProvider not implemented."); }
  async healthCheck(): Promise<boolean> { return false; }
  async testConnection() { return { success: false, latencyMs: 0, error: "Not implemented" }; }
}
