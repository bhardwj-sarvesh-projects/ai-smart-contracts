import OpenAI from "openai";
import {
  AI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_TEMPERATURE,
  AITask,
  GROQ_BASE_URL,
  getEffectiveMaxOutputTokens,
  getModelPolicy,
  getRoutingGroupForTask,
  ModelPolicyEntry,
} from "../config/aiPolicy";
import { AIResponse, HealthResponse, RequestOptions } from "../providers/AIProvider";
import {
  AICredentialService,
  AICredential,
  classifyAIError,
} from "./AICredentialService";
import { safeErrorMessage } from "../utils/secretRedaction";
import { TokenBudgetEngine } from "../../src/core/EngineeringCore/runtime/TokenBudgetEngine";

export interface OrchestratorRequest {
  task: AITask;
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  options?: RequestOptions;
}

export interface OrchestratorResult extends AIResponse {
  credentialId: string;
  task: AITask;
  provider: "groq";
}

let groupCursor = new Map<string, number>();
const MODEL_UNAVAILABLE_TTL_MS = 10 * 60 * 1000;
const unavailableModels = new Map<string, number>();
let groqGlobalCooldownUntil = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function modelUnavailableKey(credentialId: string, model: string): string {
  return `${credentialId}:${model}`;
}

function isModelTemporarilyUnavailable(credentialId: string, model: string): boolean {
  const globalKey = `*:${model}`;
  const key = modelUnavailableKey(credentialId, model);
  const now = Date.now();

  const globalExpires = unavailableModels.get(globalKey) || 0;
  if (globalExpires > now) return true;
  if (globalExpires) unavailableModels.delete(globalKey);

  const expiresAt = unavailableModels.get(key) || 0;
  if (expiresAt > now) return true;
  if (expiresAt) unavailableModels.delete(key);

  return false;
}

function markModelUnavailable(
  credentialId: string,
  model: string,
  ttlMs = MODEL_UNAVAILABLE_TTL_MS,
  global = false,
): void {
  const key = global ? `*:${model}` : modelUnavailableKey(credentialId, model);
  unavailableModels.set(key, Date.now() + ttlMs);
}

function buildSystem(systemInstruction?: string, responseMimeType?: string): string {
  let system = String(systemInstruction || "").trim();

  if (responseMimeType === "application/json" && !/json/i.test(system)) {
    system += "\nReturn only valid JSON. Do not use markdown fences.";
  }

  system += `\nPLATFORM AI POLICY: Provider, API credential, model selection, temperature, and token ceilings are controlled by AI Contracts. Temperature is fixed at ${AI_TEMPERATURE}.`;
  return system.trim();
}

function rotateWithinGroup(credentials: AICredential[], groupId: string): AICredential[] {
  if (credentials.length <= 1) return credentials;

  const cursor = groupCursor.get(groupId) || 0;
  const start = cursor % credentials.length;
  groupCursor.set(groupId, (cursor + 1) % credentials.length);

  return credentials.slice(start).concat(credentials.slice(0, start));
}

function isKeyTerminalFailure(failureType: string): boolean {
  return (
    failureType === "AUTH_ERROR" ||
    failureType === "BILLING_SPEND_LIMIT" ||
    failureType === "DAILY_QUOTA_EXCEEDED"
  );
}

function isRateLimitFailure(failureType: string): boolean {
  return failureType === "RATE_LIMIT_ERROR" || failureType === "TEMPORARY_TPM_RATE_LIMIT";
}

function modelFallbackAllowed(failureType: string): boolean {
  return failureType === "MODEL_UNAVAILABLE";
}

function cooldownFor(failureType: string, error: any): number {
  if (isRateLimitFailure(failureType)) {
    const retryAfter = TokenBudgetEngine.extractRetryAfter(
      safeErrorMessage(error),
      error?.headers || error?.response?.headers,
    );
    const resetMs = TokenBudgetEngine.parseDurationToMs(retryAfter);
    return Math.max(10_000, resetMs || 30_000);
  }

  if (failureType === "AUTH_ERROR" || failureType === "BILLING_SPEND_LIMIT") {
    return 10 * 60 * 1000;
  }

  if (failureType === "DAILY_QUOTA_EXCEEDED") {
    return 24 * 60 * 60 * 1000;
  }

  if (failureType === "TRANSIENT_ERROR") {
    return 5_000;
  }

  return 0;
}

function findCredentialSlotGroup(credential: AICredential, groupSlots: readonly number[]): boolean {
  return groupSlots.includes(Number(credential.priority));
}

function buildStructuredError(
  code: string,
  message: string,
  statusCode: number,
  provider: string,
  model: string,
  retryAfterMs = 0,
) {
  const error: any = new Error(
    JSON.stringify({
      code,
      errorCode: code,
      stage: "AI Generation",
      engine: "AIOrchestrator",
      provider,
      model,
      statusCode,
      message,
      retryable:
        code === "RATE_LIMIT_ERROR" ||
        code === "TEMPORARY_TPM_RATE_LIMIT" ||
        code === "TRANSIENT_ERROR",
      retryAfterMs,
      requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }),
  );

  error.code = code;
  error.status = statusCode;
  error.provider = provider;
  error.model = model;
  error.retryAfterMs = retryAfterMs;
  return error;
}

async function executeGroq(
  credential: AICredential,
  apiKey: string,
  modelEntry: ModelPolicyEntry,
  request: OrchestratorRequest,
): Promise<AIResponse> {
  const client = new OpenAI({
    apiKey,
    baseURL: GROQ_BASE_URL,
    timeout: 90_000,
    maxRetries: 0,
  });

  const model = modelEntry.model;
  const requestedTokens = Math.min(
    request.options?.maxTokens || AI_DEFAULT_MAX_OUTPUT_TOKENS,
    modelEntry.maxOutputTokens,
    AI_DEFAULT_MAX_OUTPUT_TOKENS,
  );

  const system = buildSystem(request.systemInstruction, request.responseMimeType);
  const promptLength = system.length + request.prompt.length;

  TokenBudgetEngine.logTPMGuard("groq", model, requestedTokens, promptLength);

  const budget = TokenBudgetEngine.getSafeRequestBudget(
    "groq",
    requestedTokens,
    promptLength,
    model,
  );

  if (budget.shouldCompact) {
    throw buildStructuredError(
      "PROVIDER_CONTEXT_BUDGET",
      "The request context is too large for the currently observed Groq TPM window. Reduce workspace context before retrying.",
      413,
      "groq",
      model,
    );
  }

  // When the organization has a known shared TPM window and the prompt/output
  // would exceed the remaining window, wait for the provider reset instead of
  // burning the remaining 19 keys on the same organization-level quota.
  if (budget.shouldWait && budget.retryAfterMs > 0) {
    await sleep(Math.min(budget.retryAfterMs + 250, 20_000));
  }

  const finalMaxTokens = Math.min(
    Math.max(256, budget.safeOutputTokens),
    modelEntry.maxOutputTokens,
    AI_DEFAULT_MAX_OUTPUT_TOKENS,
  );

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: request.prompt });

  const started = Date.now();

  try {
    let result: any;

    try {
      const response = await (client.chat.completions.create({
        model,
        messages,
        temperature: AI_TEMPERATURE,
        max_completion_tokens: finalMaxTokens,
        response_format:
          request.responseMimeType === "application/json"
            ? { type: "json_object" }
            : undefined,
        ...(model.startsWith("openai/gpt-oss-")
          ? { include_reasoning: false }
          : {}),
      } as any) as any).withResponse();

      result = response;
      const headers = response?.response?.headers;
      if (headers) TokenBudgetEngine.updateFromHeaders("groq", headers, model);
    } catch (firstError: any) {
      const message = safeErrorMessage(firstError);

      // Some Groq model/API combinations do not accept max_completion_tokens.
      if (
        Number(firstError?.status) === 400 &&
        /max_completion_tokens|max_tokens|unsupported parameter|temperature|include_reasoning/i.test(message)
      ) {
        result = await (client.chat.completions.create({
          model,
          messages,
          max_tokens: finalMaxTokens,
          response_format:
            request.responseMimeType === "application/json"
              ? { type: "json_object" }
              : undefined,
        } as any) as any).withResponse();
      } else if (
        request.responseMimeType === "application/json" &&
        Number(firstError?.status) === 400 &&
        /response.?format|json_object/i.test(message)
      ) {
        result = await (client.chat.completions.create({
          model,
          messages,
          temperature: AI_TEMPERATURE,
          max_completion_tokens: finalMaxTokens,
        } as any) as any).withResponse();
      } else {
        (firstError as any).model = model;
        throw firstError;
      }
    }

    const response = result.data || result;
    const headers = result.response?.headers;
    if (headers) TokenBudgetEngine.updateFromHeaders("groq", headers, model);

    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const totalTokens = response.usage?.total_tokens || 0;

    if (totalTokens > 0) {
      TokenBudgetEngine.updateTPMUsageSuccess("groq", totalTokens);
    }

    const text = String(response.choices?.[0]?.message?.content || "").trim();
    if (!text) {
      throw buildStructuredError(
        "EMPTY_AI_RESPONSE",
        "The selected Groq model returned an empty response.",
        502,
        "groq",
        model,
      );
    }

    if (request.responseMimeType === "application/json") {
      try {
        JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim());
      } catch {
        throw buildStructuredError(
          "INVALID_AI_JSON",
          "The selected Groq model returned invalid JSON.",
          502,
          "groq",
          model,
        );
      }
    }

    return {
      text,
      model,
      durationMs: Date.now() - started,
      usage: response.usage
        ? { promptTokens, completionTokens, totalTokens }
        : undefined,
    };
  } catch (error: any) {
    const failureType = classifyAIError(error);
    const retryAfter = TokenBudgetEngine.extractRetryAfter(
      safeErrorMessage(error),
      error?.headers || error?.response?.headers,
    );
    const retryAfterMs = TokenBudgetEngine.parseDurationToMs(retryAfter);

    if (failureType === "RATE_LIMIT_ERROR" || failureType === "TEMPORARY_TPM_RATE_LIMIT") {
      TokenBudgetEngine.updateTPMUsageFromError("groq", safeErrorMessage(error));
      const parsedRetryMs = Math.max(1_000, retryAfterMs || 4_000);

      // If the cooldown is reasonable (<= 15 seconds), pause and retry the request once internally
      if (parsedRetryMs <= 15_000 && !request.options?.skipInternalRetry) {
        console.log(`[AIOrchestrator] Groq TPM limit hit (${parsedRetryMs}ms). Pausing and retrying execution...`);
        await sleep(parsedRetryMs + 250);
        return executeGroq(
          credential,
          apiKey,
          modelEntry,
          {
            ...request,
            options: {
              ...request.options,
              skipInternalRetry: true,
            },
          },
        );
      }

      throw buildStructuredError(
        "TEMPORARY_TPM_RATE_LIMIT",
        safeErrorMessage(error),
        429,
        "groq",
        model,
        Math.max(1_000, retryAfterMs || 10_000),
      );
    }

    (error as any).model = model;
    throw error;
  }
}

export class AIOrchestrator {
  static async healthCheck(): Promise<HealthResponse> {
    const started = Date.now();
    try {
      const credentials = await AICredentialService.getEnabled();
      if (!credentials.length) {
        return {
          success: false,
          latencyMs: Date.now() - started,
          modelUsed: getModelPolicy("generation")[0]?.model || "unknown",
          error: "No enabled Groq credentials are available.",
        };
      }

      const first = credentials.slice().sort((a, b) => a.priority - b.priority)[0];
      const secret = await AICredentialService.getSecret(first.id);
      if (!secret?.apiKey) {
        return {
          success: false,
          latencyMs: Date.now() - started,
          modelUsed: getModelPolicy("generation")[0]?.model || "unknown",
          error: "The selected Groq credential is not available.",
        };
      }

      const client = new OpenAI({
        apiKey: secret.apiKey,
        baseURL: GROQ_BASE_URL,
        timeout: 10_000,
        maxRetries: 0,
      });

      // Model listing is deliberately used instead of a completion ping so a
      // health check does not consume generation tokens from the shared TPM pool.
      await client.models.list();

      return {
        success: true,
        latencyMs: Date.now() - started,
        modelUsed: getModelPolicy("generation")[0]?.model || "openai/gpt-oss-120b",
      };
    } catch (error: any) {
      return {
        success: false,
        latencyMs: Date.now() - started,
        modelUsed: getModelPolicy("generation")[0]?.model || "openai/gpt-oss-120b",
        error: safeErrorMessage(error),
      };
    }
  }

  static async execute(request: OrchestratorRequest): Promise<OrchestratorResult> {
    if (groqGlobalCooldownUntil > Date.now()) {
      const remainingMs = groqGlobalCooldownUntil - Date.now();
      if (remainingMs <= 15_000) {
        console.log(`[AIOrchestrator] Global Groq TPM cooldown active (${remainingMs}ms remaining). Pausing before execution...`);
        await sleep(remainingMs + 250);
      } else {
        const retryAfterMs = Math.max(500, remainingMs);
        throw buildStructuredError(
          "TEMPORARY_TPM_RATE_LIMIT",
          `Groq organization TPM capacity is temporarily exhausted. Retry in approximately ${Math.ceil(retryAfterMs / 1000)} seconds.`,
          429,
          "groq",
          getModelPolicy(request.task)[0]?.model || "",
          retryAfterMs,
        );
      }
    }

    const group = getRoutingGroupForTask(request.task);
    const modelPolicy = getModelPolicy(request.task);

    if (!modelPolicy.length) {
      throw buildStructuredError(
        "NO_MODEL_POLICY",
        `No model policy is configured for task '${request.task}'.`,
        500,
        "groq",
        "",
      );
    }

    // Exactly the 20 database-managed credential slots are the pool.
    // Task routing starts with dedicated slots and overflows to healthy pool keys.
    const credentialsForTask = await AICredentialService.getEnabledForTask(request.task);

    if (!credentialsForTask.length) {
      throw buildStructuredError(
        "NO_AI_CREDENTIALS_FOR_TASK",
        `No enabled Groq API credentials are available for workload '${group.label}'.`,
        503,
        "groq",
        modelPolicy[0]?.model || "",
      );
    }

    const orderedCredentials = rotateWithinGroup(credentialsForTask, group.id);

    let lastError: any = null;
    let attemptedRoutes = 0;

    for (const credential of orderedCredentials) {
      const secret = await AICredentialService.getSecret(credential.id);
      if (!secret?.apiKey) continue;

      // Predictable model behavior:
      // 1 primary model for a normal request.
      // Fallback to model #2/#3 when the specific model is unavailable or rate-limited.
      for (const modelEntry of modelPolicy) {
        if (isModelTemporarilyUnavailable(credential.id, modelEntry.model)) {
          continue;
        }

        attemptedRoutes++;
        try {
          const response = await executeGroq(
            credential,
            secret.apiKey,
            modelEntry,
            request,
          );

          await AICredentialService.record(
            credential.id,
            true,
            undefined,
            undefined,
          );

          return {
            ...response,
            credentialId: credential.id,
            task: request.task,
            provider: "groq",
          };
        } catch (error: any) {
          lastError = error;

          const failureType = classifyAIError(error);
          const errMsg = safeErrorMessage(error);
          const retryAfter = TokenBudgetEngine.extractRetryAfter(
            errMsg,
            error?.headers || error?.response?.headers,
          );
          const retryAfterMs = TokenBudgetEngine.parseDurationToMs(retryAfter);
          const isRateLimit = isRateLimitFailure(failureType);

          const cooldownMs = isRateLimit
            ? Math.max(10_000, retryAfterMs || 30_000)
            : cooldownFor(failureType, error);

          // Mark model temporarily unavailable so fallback models are used seamlessly
          if (failureType === "MODEL_UNAVAILABLE" || isRateLimit) {
            const ttl = isRateLimit
              ? Math.max(30_000, retryAfterMs || 60_000)
              : MODEL_UNAVAILABLE_TTL_MS;
            const isOrgOrModelLimit = isRateLimit && /model|tpd|tpm|organization|limit/i.test(errMsg);
            markModelUnavailable(
              credential.id,
              modelEntry.model,
              ttl,
              isOrgOrModelLimit,
            );
          }

          await AICredentialService.record(
            credential.id,
            false,
            failureType,
            cooldownMs,
          );

          // Authentication/billing failures invalidate this credential; move to next credential.
          if (isKeyTerminalFailure(failureType)) {
            break;
          }

          // For rate limits or model failures, continue inner loop to try fallback model (e.g. qwen/qwen3.6-27b or gpt-oss-20b)
        }
      }
    }

    if (lastError && isRateLimitFailure(classifyAIError(lastError))) {
      const retryAfter = TokenBudgetEngine.extractRetryAfter(
        safeErrorMessage(lastError),
        lastError?.headers || lastError?.response?.headers,
      );
      const retryAfterMs = TokenBudgetEngine.parseDurationToMs(retryAfter);
      groqGlobalCooldownUntil = Math.max(
        groqGlobalCooldownUntil,
        Date.now() + Math.max(1_000, retryAfterMs || 10_000),
      );
    }

    const code = classifyAIError(lastError);
    throw buildStructuredError(
      code,
      safeErrorMessage(lastError) || "All configured Groq routes failed.",
      Number(lastError?.status || lastError?.statusCode || 503),
      "groq",
      String(lastError?.model || modelPolicy[0]?.model || ""),
      Number(lastError?.retryAfterMs || 0),
    );
  }
}
