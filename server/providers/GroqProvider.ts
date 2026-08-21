import OpenAI from "openai";
import { AIProvider, AIResponse, HealthResponse, RequestOptions } from "./AIProvider";
import { AI_TEMPERATURE, AI_DEFAULT_MAX_OUTPUT_TOKENS, GROQ_BASE_URL } from "../config/aiPolicy";
import { TokenBudgetEngine } from "../../src/core/EngineeringCore/runtime/TokenBudgetEngine";
import { safeErrorMessage } from "../utils/secretRedaction";

export class GroqProvider implements AIProvider {
  readonly name = "groq";
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: { apiKey: string; model?: string; temperature?: number; maxTokens?: number }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: GROQ_BASE_URL,
      timeout: 90_000,
      maxRetries: 0,
    });
    this.model = config.model || "openai/gpt-oss-120b";
    this.maxTokens = Math.min(
      config.maxTokens || AI_DEFAULT_MAX_OUTPUT_TOKENS,
      AI_DEFAULT_MAX_OUTPUT_TOKENS,
    );
  }

  private async execute(
    prompt: string,
    systemInstruction = "",
    responseMimeType = "text/plain",
    options?: RequestOptions,
  ): Promise<AIResponse> {
    let system = systemInstruction || "";
    if (responseMimeType === "application/json" && !/json/i.test(system)) {
      system = `${system}\nReturn only valid JSON. Do not use markdown fences.`.trim();
    }

    const targetPath = options?.targetPath;
    const promptLength = system.length + prompt.length;
    const requested = Math.min(
      options?.maxTokens || this.maxTokens,
      this.maxTokens,
      AI_DEFAULT_MAX_OUTPUT_TOKENS,
    );

    const budget = TokenBudgetEngine.getSafeRequestBudget(
      "groq",
      requested,
      promptLength,
      this.model,
    );

    if (budget.shouldCompact) {
      const error: any = new Error(
        "The request context is too large for the currently observed Groq provider budget.",
      );
      error.code = "PROVIDER_CONTEXT_BUDGET";
      error.status = 413;
      error.model = this.model;
      throw error;
    }

    if (budget.shouldWait && budget.retryAfterMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(budget.retryAfterMs + 250, 20_000)),
      );
    }

    const finalMaxTokens = Math.min(
      Math.max(256, budget.safeOutputTokens),
      requested,
      AI_DEFAULT_MAX_OUTPUT_TOKENS,
    );

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    const started = Date.now();

    try {
      const result: any = await (this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: AI_TEMPERATURE,
        max_completion_tokens: finalMaxTokens,
        response_format:
          responseMimeType === "application/json"
            ? { type: "json_object" }
            : undefined,
        ...(this.model.startsWith("openai/gpt-oss-")
          ? { include_reasoning: false }
          : {}),
      } as any) as any).withResponse();

      if (result.response?.headers) {
        TokenBudgetEngine.updateFromHeaders("groq", result.response.headers, this.model);
      }

      const response = result.data;
      const text = String(response.choices?.[0]?.message?.content || "").trim();

      if (!text) {
        throw new Error("The selected Groq model returned an empty response.");
      }

      if (responseMimeType === "application/json") {
        JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim());
      }

      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || 0;

      if (totalTokens) {
        TokenBudgetEngine.updateTPMUsageSuccess("groq", totalTokens);
      }

      return {
        text,
        model: this.model,
        durationMs: Date.now() - started,
        usage: response.usage
          ? { promptTokens, completionTokens, totalTokens }
          : undefined,
      };
    } catch (error: any) {
      TokenBudgetEngine.updateTPMUsageFromError("groq", safeErrorMessage(error));

      const structured: any = new Error(
        JSON.stringify({
          code:
            Number(error?.status) === 429
              ? "TEMPORARY_TPM_RATE_LIMIT"
              : Number(error?.status) === 404
                ? "MODEL_UNAVAILABLE"
                : Number(error?.status) === 401 || Number(error?.status) === 403
                  ? "AUTH_ERROR"
                  : "PROVIDER_ERROR",
          provider: "groq",
          model: this.model,
          statusCode: Number(error?.status || 500),
          message: safeErrorMessage(error),
          retryAfterMs: TokenBudgetEngine.parseDurationToMs(
            TokenBudgetEngine.extractRetryAfter(
              safeErrorMessage(error),
              error?.headers || error?.response?.headers,
            ),
          ),
          retryable: Number(error?.status) >= 500 || Number(error?.status) === 429,
        }),
      );

      structured.status = Number(error?.status || 500);
      structured.model = this.model;
      throw structured;
    }
  }

  async generate(prompt: string, systemInstruction?: string, responseMimeType?: string, options?: RequestOptions) {
    return this.execute(prompt, systemInstruction, responseMimeType || "text/plain", options);
  }

  async edit(prompt: string, systemInstruction?: string, options?: RequestOptions) {
    return this.execute(prompt, systemInstruction, "application/json", options);
  }

  async audit(prompt: string, systemInstruction?: string, options?: RequestOptions) {
    return this.execute(prompt, systemInstruction, "application/json", options);
  }

  async plan(prompt: string, systemInstruction?: string, options?: RequestOptions) {
    return this.execute(prompt, systemInstruction, "application/json", options);
  }

  async compileAnalysis(prompt: string, systemInstruction?: string, options?: RequestOptions) {
    return this.execute(prompt, systemInstruction, "application/json", options);
  }

  async healthCheck(): Promise<HealthResponse> {
    const started = Date.now();
    try {
      // models.list is used instead of a completion ping so health checks do not
      // consume generation TPM.
      await this.client.models.list();
      return {
        success: true,
        latencyMs: Date.now() - started,
        modelUsed: this.model,
      };
    } catch (error: any) {
      return {
        success: false,
        latencyMs: Date.now() - started,
        modelUsed: this.model,
        error: safeErrorMessage(error),
      };
    }
  }

  async testConnection(): Promise<any> {
    return this.healthCheck();
  }
}
