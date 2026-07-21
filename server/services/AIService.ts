import { ProviderFactory } from "../providers/ProviderFactory";
import { AIProvider, AIResponse, HealthResponse } from "../providers/AIProvider";
import { GeminiProvider } from "../providers/GeminiProvider";
import { UserConfig } from "./SettingsService";

export class AIService {
  // Centralized logging and statistics tracking
  private static logRequest(provider: AIProvider, action: string, response: AIResponse, startTime: number) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[AI SERVICE LOG] --------------------------------------------------`);
    console.log(`[AI SERVICE LOG] Action: ${action}`);
    console.log(`[AI SERVICE LOG] Provider: ${provider.name}`);
    console.log(`[AI SERVICE LOG] Model: ${response.model}`);
    console.log(`[AI SERVICE LOG] Duration: ${duration}ms`);
    if (response.usage) {
      console.log(`[AI SERVICE LOG] Tokens Used: Prompt: ${response.usage.promptTokens}, Completion: ${response.usage.completionTokens}, Total: ${response.usage.totalTokens}`);
    }
    console.log(`[AI SERVICE LOG] --------------------------------------------------`);
  }

  // Unified fallback engine with self-healing automatic retries and server-side fallback
  private static async executeWithFallback(
    settings: UserConfig,
    action: string,
    executeOnProvider: (provider: AIProvider) => Promise<AIResponse>,
    maxRetries: number = 2
  ): Promise<any> {
    const primaryProvider = ProviderFactory.getProvider(settings);
    let lastError: any = null;

    // Try primary provider first (with retries)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      try {
        const response = await executeOnProvider(primaryProvider);
        this.logRequest(primaryProvider, action, response, startTime);

        // Sanitize markdown wrappers if present
        const cleaned = response.text
          .replace(/^\s*```json/i, "")
          .replace(/```\s*$/, "")
          .trim();

        try {
          const parsed = JSON.parse(cleaned);
          return {
            data: parsed,
            model: response.model,
            durationMs: response.durationMs,
            usage: response.usage
          };
        } catch (parseErr) {
          console.warn(`[AI SERVICE] JSON parse failed on ${primaryProvider.name} (attempt ${attempt}/${maxRetries}). Raw response:`, response.text);
          throw new Error(`AI response was not valid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI SERVICE] Error using primary provider ${primaryProvider.name} (Attempt ${attempt}/${maxRetries}):`, err.message || err);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // If primary provider failed and we have a backend GEMINI_API_KEY, fallback to Gemini
    if (primaryProvider.name !== "gemini" && process.env.GEMINI_API_KEY) {
      console.warn(`[AI SERVICE] Primary provider ${primaryProvider.name} failed all attempts. Gracefully falling back to server-side Gemini.`);
      
      const fallbackProvider = new GeminiProvider({
        apiKey: process.env.GEMINI_API_KEY,
        model: "gemini-3.5-flash",
        temperature: settings.temperature || 0.2,
        maxTokens: settings.maxTokens || 2000
      });

      const startTime = Date.now();
      try {
        const response = await executeOnProvider(fallbackProvider);
        this.logRequest(fallbackProvider, action, response, startTime);

        const cleaned = response.text
          .replace(/^\s*```json/i, "")
          .replace(/```\s*$/, "")
          .trim();

        const parsed = JSON.parse(cleaned);
        return {
          data: parsed,
          model: response.model,
          durationMs: response.durationMs,
          usage: response.usage,
          fallbackUsed: true
        };
      } catch (fallbackErr: any) {
        console.error(`[AI SERVICE] Fallback provider Gemini also failed:`, fallbackErr.message || fallbackErr);
        throw new Error(`AI Service failure: Both primary provider (${primaryProvider.name}) and backup (Gemini) failed. Detail: ${fallbackErr.message || String(fallbackErr)}`);
      }
    }

    throw lastError;
  }

  static async generatePlan(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Generate Plan", (provider) =>
      provider.plan(prompt, systemInstruction)
    );
  }

  static async generateWorkspace(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Generate Workspace", (provider) =>
      provider.generate(prompt, systemInstruction, "application/json")
    );
  }

  static async editWorkspace(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Edit Workspace", (provider) =>
      provider.edit(prompt, systemInstruction)
    );
  }

  static async auditWorkspace(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Audit Workspace", (provider) =>
      provider.audit(prompt, systemInstruction)
    );
  }

  static async compileAnalysis(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Compile Analysis", (provider) =>
      provider.compileAnalysis(prompt, systemInstruction)
    );
  }

  static async healthCheck(settings: UserConfig): Promise<HealthResponse> {
    try {
      const provider = ProviderFactory.getProvider(settings);
      return await provider.healthCheck();
    } catch (err: any) {
      return {
        success: false,
        latencyMs: 0,
        modelUsed: settings.defaultModel || "unknown",
        error: err.message || String(err)
      };
    }
  }

  static async testConnection(settings: UserConfig): Promise<any> {
    try {
      const provider = ProviderFactory.getProvider(settings);
      return await provider.testConnection();
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err)
      };
    }
  }
}

