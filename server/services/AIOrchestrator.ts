import OpenAI from "openai";
import { AIResponse, RequestOptions } from "../providers/AIProvider";
import { AICredentialService, classifyAIError } from "./AICredentialService";
import { AI_TEMPERATURE, AITask, GLOBAL_MAX_OUTPUT_TOKENS, AI_MODEL_POLICY, getModelPolicy } from "../config/aiPolicy";

export interface OrchestratorRequest {
  task: AITask;
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: string;
  options?: RequestOptions;
}

export interface OrchestratorResult extends AIResponse {
  credentialId: string;
  task: AITask;
}

export class AIOrchestrator {
  private static buildSystem(systemInstruction: string | undefined, responseMimeType: string | undefined) {
    let system = systemInstruction || "";
    if (responseMimeType === "application/json" && !/valid\s+json/i.test(system)) {
      system += `${system ? "\n" : ""}Return only valid JSON. Do not wrap the JSON in markdown.`;
    }
    system += `\nSYSTEM AI POLICY: Temperature is fixed at ${AI_TEMPERATURE}. Do not discuss or request changes to platform AI routing parameters.`;
    return system.trim();
  }

  private static getRequestMaxTokens(model: string, requested?: number, targetPath?: string) {
    const modelPolicy = Object.values(AI_MODEL_POLICY)
      .flat()
      .find((entry: any) => entry.model === model);
    let max = modelPolicy?.maxOutputTokens || GLOBAL_MAX_OUTPUT_TOKENS;
    if (requested && Number.isFinite(requested)) max = Math.min(max, Math.max(256, Math.floor(requested)));
    if (targetPath) {
      const lower = targetPath.toLowerCase();
      if (lower.endsWith(".json")) max = Math.min(max, 16384);
      if (lower.endsWith(".md")) max = Math.min(max, 16384);
      if (lower.endsWith(".toml") || lower.endsWith(".yaml") || lower.endsWith(".yml")) max = Math.min(max, 8192);
    }
    return Math.max(256, max);
  }

  static async execute(request: OrchestratorRequest): Promise<OrchestratorResult> {
    const credentials = await AICredentialService.getEnabled();
    const routeAttempt = Math.max(1, Number(request.options?.routeAttempt || 1));
    if (credentials.length === 0) {
      throw AIOrchestrator.structuredError("NO_AI_CREDENTIALS", "No enabled Groq API credentials are configured in the Admin Panel.", 503, "", "");
    }

    const models = request.task === "research"
      ? getModelPolicy("research")
      : getModelPolicy(request.task);
    const system = this.buildSystem(request.systemInstruction, request.responseMimeType);
    let lastError: any = null;

    // Credential-major traversal intentionally matches the platform policy:
    // API-1 -> all approved models -> API-2 -> all approved models -> ...
    const routePairs = credentials.flatMap(credential => models.map(modelEntry => ({ credential, modelEntry })));
    const startIndex = Math.min(routePairs.length, routeAttempt > 1 ? (routeAttempt - 1) : 0);

    for (const route of routePairs.slice(startIndex)) {
      const credential = route.credential;
      const modelEntry = route.modelEntry;
      const secret = await AICredentialService.getSecret(credential.id);
      if (!secret?.apiKey) continue;

        const model = modelEntry.model;
        const maxTokens = Math.min(
          AIOrchestrator.getRequestMaxTokens(model, request.options?.maxTokens, request.options?.targetPath),
          modelEntry.maxOutputTokens
        );
        const started = Date.now();
        const client = new OpenAI({
          apiKey: secret.apiKey,
          baseURL: "https://api.groq.com/openai/v1",
          timeout: 90000,
        });

        try {
          const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
          if (system) messages.push({ role: "system", content: system });
          messages.push({ role: "user", content: request.prompt });

          let response: OpenAI.Chat.ChatCompletion;
          try {
            response = await client.chat.completions.create({
              model,
              messages,
              temperature: AI_TEMPERATURE,
              max_tokens: maxTokens,
              response_format: request.responseMimeType === "application/json" ? { type: "json_object" } : undefined,
            });
          } catch (formatError: any) {
            // Some models/endpoints may reject JSON response_format. This is a
            // request capability issue, not an API credential failure.
            if (request.responseMimeType === "application/json" && Number(formatError?.status) === 400 && /response.?format|json_object/i.test(String(formatError?.message || ""))) {
              response = await client.chat.completions.create({
                model,
                messages,
                temperature: AI_TEMPERATURE,
                max_tokens: maxTokens,
              });
            } else {
              throw formatError;
            }
          }

          const text = response.choices?.[0]?.message?.content || "";
          if (!text.trim()) throw AIOrchestrator.structuredError("EMPTY_RESPONSE", "The selected model returned an empty response.", 502, "groq", model);
          if (request.responseMimeType === "application/json") {
            try { JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim()); }
            catch { throw AIOrchestrator.structuredError("INVALID_AI_RESPONSE", "The selected model returned invalid JSON.", 502, "groq", model); }
          }

          const usage = response.usage ? {
            promptTokens: response.usage.prompt_tokens || 0,
            completionTokens: response.usage.completion_tokens || 0,
            totalTokens: response.usage.total_tokens || 0,
          } : undefined;

          await AICredentialService.record(credential.id, true);
          console.log(`[AI ORCHESTRATOR] SUCCESS task=${request.task} credential=${credential.id} model=${model} duration=${Date.now() - started}ms`);

          return {
            text,
            model,
            durationMs: Date.now() - started,
            usage,
            credentialId: credential.id,
            task: request.task,
          };
        } catch (error: any) {
          lastError = error;
          const failureType = classifyAIError(error);
          const status = Number(error?.status || error?.statusCode || 0);
          const retryAfterSeconds = Number(error?.headers?.["retry-after"] || 0);
          const cooldownMs = failureType === "RATE_LIMIT_ERROR"
            ? Math.max(15000, (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 30000))
            : failureType === "AUTH_ERROR" ? 10 * 60 * 1000 : 0;

          await AICredentialService.record(credential.id, false, failureType, cooldownMs);
          console.warn(`[AI ORCHESTRATOR] FAIL task=${request.task} credential=${credential.id} model=${model} type=${failureType} status=${status}`);

          // Try the next hardcoded model for this credential. After the last
          // model, the outer loop advances to the next Admin-managed credential.
          continue;
        }
    }

    const code = classifyAIError(lastError);
    throw AIOrchestrator.structuredError(code, lastError?.message || "All configured AI routes failed.", Number(lastError?.status || 503), "groq", lastError?.model || "");
  }

  private static structuredError(code: string, message: string, statusCode: number, provider: string, model: string) {
    const err = new Error(JSON.stringify({
      code,
      errorCode: code,
      stage: "AI Generation",
      engine: "AIOrchestrator",
      provider,
      model,
      statusCode,
      message,
      retryable: false,
      requestId: `req-${Date.now()}`,
    }));
    (err as any).code = code;
    (err as any).status = statusCode;
    return err;
  }
}
