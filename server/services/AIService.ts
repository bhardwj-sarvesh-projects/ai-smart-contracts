import { AIResponse, HealthResponse } from "../providers/AIProvider";
import { UserConfig } from "./SettingsService";
import { JSONNormalizer } from "./JSONNormalizer";
import { AIOrchestrator } from "./AIOrchestrator";
import { AITask } from "../config/aiPolicy";
import { AICredentialService } from "./AICredentialService";

export class AIService {
  private static logRequest(response: AIResponse, action: string, started: number) {
    console.log(`[AI SERVICE] action=${action} provider=groq model=${response.model} duration=${Date.now() - started}ms`);
    if (response.usage) console.log(`[AI SERVICE] tokens=${response.usage.totalTokens}`);
  }

  private static async execute(
    action: string,
    task: AITask,
    actionType: 'plan' | 'workspace' | 'edit' | 'audit' | 'compile',
    prompt: string,
    systemInstruction?: string,
    options?: { maxTokens?: number; targetPath?: string }
  ) {
    const started = Date.now();
    const response = await AIOrchestrator.execute({
      task,
      prompt,
      systemInstruction,
      responseMimeType: "application/json",
      options,
    });
    this.logRequest(response, action, started);
    const parsed = JSONNormalizer.parseAndNormalize(response.text, actionType);
    return {
      data: parsed,
      model: response.model,
      credentialId: response.credentialId,
      durationMs: response.durationMs,
      usage: response.usage,
    };
  }

  static async generateRawSource(
    _settings: UserConfig,
    prompt: string,
    systemInstruction?: string,
    targetPath?: string,
    maxTokens?: number,
    routeAttempt?: number
  ): Promise<string> {
    const started = Date.now();
    const response = await AIOrchestrator.execute({
      task: targetPath && /test/i.test(targetPath) ? "testing" : targetPath && /audit|security/i.test(targetPath) ? "security" : "generation",
      prompt,
      systemInstruction,
      responseMimeType: "text/plain",
      options: { maxTokens, targetPath, routeAttempt },
    });
    this.logRequest(response, "Generate Raw Source", started);
    return response.text;
  }

  static async generatePlan(_settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.execute("Generate Plan", "architecture", "plan", prompt, systemInstruction, { maxTokens: 65536 });
  }

  static async generateWorkspace(_settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.execute("Generate Workspace", "generation", "workspace", prompt, systemInstruction, { maxTokens: 65536 });
  }

  static async editWorkspace(_settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.execute("Edit Workspace", "edit", "edit", prompt, systemInstruction, { maxTokens: 65536 });
  }

  static async auditWorkspace(_settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.execute("Audit Workspace", "security", "audit", prompt, systemInstruction, { maxTokens: 65536 });
  }

  static async compileAnalysis(_settings: UserConfig, prompt: string, systemInstruction?: string): Promise<any> {
    return this.execute("Compile Analysis", "repair", "compile", prompt, systemInstruction, { maxTokens: 65536 });
  }

  static async healthCheck(_settings: UserConfig): Promise<HealthResponse> {
    const credentials = await AICredentialService.getEnabled();
    if (!credentials.length) return { success: false, latencyMs: 0, modelUsed: "platform-router", error: "No enabled Groq credentials configured." };
    const result = await AICredentialService.test(credentials[0].id);
    return { success: result.success, latencyMs: result.latencyMs, modelUsed: "openai/gpt-oss-20b", error: result.error };
  }

  static async testConnection(settings: UserConfig): Promise<any> {
    return this.healthCheck(settings);
  }
}
