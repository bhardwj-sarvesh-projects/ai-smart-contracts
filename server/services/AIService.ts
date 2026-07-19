import { ProviderFactory } from "../providers/ProviderFactory";
import { AIProvider, AIResponse, HealthResponse } from "../providers/AIProvider";
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

  // Centralized JSON validation with self-healing automatic retries
  private static async executeWithJsonValidation(
    provider: AIProvider,
    action: string,
    executeFn: () => Promise<AIResponse>,
    maxRetries: number = 2
  ): Promise<any> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      try {
        const response = await executeFn();
        this.logRequest(provider, action, response, startTime);

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
          console.warn(`[AI SERVICE] JSON parse failed on attempt ${attempt}/${maxRetries}. Response raw was:`, response.text);
          throw new Error(`AI response was not valid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI SERVICE] Error in JSON validation route (Attempt ${attempt}/${maxRetries}):`, err.message || err);
      }
    }

    throw lastError;
  }

  static async generatePlan(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    const provider = ProviderFactory.getProvider(settings);
    return this.executeWithJsonValidation(provider, "Generate Plan", () =>
      provider.plan(prompt, systemInstruction)
    );
  }

  static async generateWorkspace(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    const provider = ProviderFactory.getProvider(settings);
    return this.executeWithJsonValidation(provider, "Generate Workspace", () =>
      provider.generate(prompt, systemInstruction, "application/json")
    );
  }

  static async editWorkspace(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    const provider = ProviderFactory.getProvider(settings);
    return this.executeWithJsonValidation(provider, "Edit Workspace", () =>
      provider.edit(prompt, systemInstruction)
    );
  }

  static async auditWorkspace(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    const provider = ProviderFactory.getProvider(settings);
    return this.executeWithJsonValidation(provider, "Audit Workspace", () =>
      provider.audit(prompt, systemInstruction)
    );
  }

  static async compileAnalysis(settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    const provider = ProviderFactory.getProvider(settings);
    return this.executeWithJsonValidation(provider, "Compile Analysis", () =>
      provider.compileAnalysis(prompt, systemInstruction)
    );
  }

  static async healthCheck(settings: UserConfig): Promise<HealthResponse> {
    const provider = ProviderFactory.getProvider(settings);
    return provider.healthCheck();
  }

  static async testConnection(settings: UserConfig): Promise<any> {
    const provider = ProviderFactory.getProvider(settings);
    return provider.testConnection();
  }
}
