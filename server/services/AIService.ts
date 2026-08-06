import { ProviderFactory, isDummyOrEmptyKey } from "../providers/ProviderFactory";
import { AIProvider, AIResponse, HealthResponse } from "../providers/AIProvider";
import { OpenRouterProvider } from "../providers/OpenRouterProvider";
import { UserConfig } from "./SettingsService";
import { JSONNormalizer } from "./JSONNormalizer";

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
    actionType: 'plan' | 'workspace' | 'edit' | 'audit' | 'compile',
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

        try {
          const parsed = JSONNormalizer.parseAndNormalize(response.text, actionType);
          return {
            data: parsed,
            model: response.model,
            durationMs: response.durationMs,
            usage: response.usage
          };
        } catch (parseErr) {
          console.warn(`[AI SERVICE] JSON parse/normalization failed on ${primaryProvider.name} (attempt ${attempt}/${maxRetries}). Raw text preview:`, response.text ? response.text.slice(0, 200) : '');
          throw new Error(`AI response was not valid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI SERVICE] Error using primary provider ${primaryProvider.name} (Attempt ${attempt}/${maxRetries}):`, err.message || err);
        
        // Fast break on unrecoverable authentication errors
        const isAuthErr = err.isAuthError || err.status === 401 || err.status === 403 ||
          (err.message && (
            err.message.includes('401') ||
            err.message.includes('403') ||
            err.message.toLowerCase().includes('invalid_api_key') ||
            err.message.toLowerCase().includes('incorrect api key') ||
            err.message.toLowerCase().includes('unauthorized')
          ));

        if (isAuthErr) {
          console.warn(`[AI SERVICE] Primary provider ${primaryProvider.name} encountered authentication error. Skipping retries to trigger fallback.`);
          break;
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // If primary provider failed, fallback to OpenRouter or OpenAI depending on available keys
    const envOpenRouterKey = process.env.OPENROUTER_API_KEY && !isDummyOrEmptyKey(process.env.OPENROUTER_API_KEY, "openrouter") ? process.env.OPENROUTER_API_KEY : "";
    const envOpenAIKey = process.env.OPENAI_API_KEY && !isDummyOrEmptyKey(process.env.OPENAI_API_KEY, "openai") ? process.env.OPENAI_API_KEY : "";

    if (primaryProvider.name !== "openrouter" && envOpenRouterKey) {
      console.warn(`[AI SERVICE] Primary provider ${primaryProvider.name} failed all attempts. Gracefully falling back to server-side OpenRouter.`);
      
      const fallbackProvider = new OpenRouterProvider({
        apiKey: envOpenRouterKey,
        model: "google/gemini-2.5-pro",
        temperature: settings.temperature || 0.2,
        maxTokens: settings.maxTokens || 2000
      });

      const startTime = Date.now();
      try {
        const response = await executeOnProvider(fallbackProvider);
        this.logRequest(fallbackProvider, action, response, startTime);

        const parsed = JSONNormalizer.parseAndNormalize(response.text, actionType);
        return {
          data: parsed,
          model: response.model,
          durationMs: response.durationMs,
          usage: response.usage,
          fallbackUsed: true
        };
      } catch (fallbackErr: any) {
        console.error(`[AI SERVICE] Fallback provider OpenRouter also failed:`, fallbackErr.message || fallbackErr);
        throw new Error(`AI Service failure: Both primary provider (${primaryProvider.name}) and backup (OpenRouter) failed. Detail: ${fallbackErr.message || String(fallbackErr)}`);
      }
    } else if (primaryProvider.name === "openrouter" && envOpenAIKey) {
      console.warn(`[AI SERVICE] Primary provider OpenRouter failed all attempts. Gracefully falling back to server-side OpenAI.`);
      
      const { OpenAIProvider } = await import("../providers/OpenAIProvider");
      const fallbackProvider = new OpenAIProvider({
        apiKey: envOpenAIKey,
        model: "gpt-4o-mini",
        temperature: settings.temperature || 0.2,
        maxTokens: settings.maxTokens || 2000
      });

      const startTime = Date.now();
      try {
        const response = await executeOnProvider(fallbackProvider);
        this.logRequest(fallbackProvider, action, response, startTime);

        const parsed = JSONNormalizer.parseAndNormalize(response.text, actionType);
        return {
          data: parsed,
          model: response.model,
          durationMs: response.durationMs,
          usage: response.usage,
          fallbackUsed: true
        };
      } catch (fallbackErr: any) {
        console.error(`[AI SERVICE] Fallback provider OpenAI also failed:`, fallbackErr.message || fallbackErr);
        throw new Error(`AI Service failure: Both primary provider (OpenRouter) and backup (OpenAI) failed. Detail: ${fallbackErr.message || String(fallbackErr)}`);
      }
    }

    throw lastError;
  }

  static async generatePlan(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Generate Plan", "plan", (provider) =>
      provider.plan(prompt, systemInstruction)
    );
  }

  static async generateWorkspace(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Generate Workspace", "workspace", (provider) =>
      provider.generate(prompt, systemInstruction, "application/json")
    );
  }

  static async editWorkspace(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Edit Workspace", "edit", (provider) =>
      provider.edit(prompt, systemInstruction)
    );
  }

  static async auditWorkspace(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Audit Workspace", "audit", (provider) =>
      provider.audit(prompt, systemInstruction)
    );
  }

  static async compileAnalysis(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.executeWithFallback(settings, "Compile Analysis", "compile", (provider) =>
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
