import { ProviderFactory, isDummyOrEmptyKey } from "../providers/ProviderFactory";
import { AIProvider, AIResponse, HealthResponse } from "../providers/AIProvider";
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

  // Execution engine on selected provider with retry handling
  private static async executeWithFallback(
    settings: UserConfig,
    action: string,
    actionType: 'plan' | 'workspace' | 'edit' | 'audit' | 'compile',
    executeOnProvider: (provider: AIProvider) => Promise<AIResponse>,
    maxRetries: number = 1
  ): Promise<any> {
    const primaryProvider = ProviderFactory.getProvider(settings);
    let lastError: any = null;

    // Execute on selected provider
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
        console.warn(`[AI SERVICE] Error using provider ${primaryProvider.name} (Attempt ${attempt}/${maxRetries}):`, err.message || err);
        
        const msg = (err.message || String(err)).toLowerCase();
        const isRateLimit = err.status === 429 || err.isTerminal || msg.includes("429") || msg.includes("rate limit") || msg.includes("rate exceeded") || msg.includes("rate_limit_exceeded") || msg.includes("too many requests") || msg.includes("tpd") || msg.includes("tpm") || msg.includes("rpm") || msg.includes("quota exceeded") || msg.includes("insufficient quota") || msg.includes("insufficient credits");
        const isAuth = err.status === 401 || err.status === 403 || err.status === 402 || msg.includes("401") || msg.includes("403") || msg.includes("402") || msg.includes("invalid_api_key") || msg.includes("unauthorized");

        if (isRateLimit || isAuth) {
          console.warn(`[AI SERVICE] Terminal error encountered on provider ${primaryProvider.name}. Bypassing retries.`);
          throw err;
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    throw lastError;
  }

  static async generateRawSource(
    settings: UserConfig,
    prompt: string,
    systemInstruction?: string,
    targetPath?: string,
    maxTokens?: number
  ): Promise<string> {
    const primaryProvider = ProviderFactory.getProvider(settings);
    let lastError: any = null;
    const reqOptions = { maxTokens, targetPath };

    for (let attempt = 1; attempt <= 1; attempt++) {
      const startTime = Date.now();
      try {
        const response = await primaryProvider.generate(prompt, systemInstruction, undefined, reqOptions);
        this.logRequest(primaryProvider, "Generate Raw Source", response, startTime);
        return response.text;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI SERVICE] Raw source generation failed on ${primaryProvider.name}:`, err.message || err);

        const msg = (err.message || String(err)).toLowerCase();
        const isRateLimit = err.status === 429 || err.isTerminal || msg.includes("429") || msg.includes("rate limit") || msg.includes("rate exceeded") || msg.includes("rate_limit_exceeded") || msg.includes("too many requests") || msg.includes("tpd") || msg.includes("tpm") || msg.includes("rpm") || msg.includes("quota exceeded") || msg.includes("insufficient quota") || msg.includes("insufficient credits");
        const isAuth = err.status === 401 || err.status === 403 || err.status === 402 || msg.includes("401") || msg.includes("403") || msg.includes("402") || msg.includes("invalid_api_key") || msg.includes("unauthorized");

        if (isRateLimit || isAuth) {
          throw err;
        }
      }
    }

    throw lastError || new Error(`Raw source generation failed on provider ${primaryProvider.name}.`);
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
