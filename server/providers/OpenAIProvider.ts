import OpenAI from "openai";
import { AIProvider, AIResponse, HealthResponse, RequestOptions } from "./AIProvider";
import { TokenBudgetEngine } from "../../src/core/EngineeringCore/runtime/TokenBudgetEngine";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: { apiKey: string; model?: string; temperature?: number; maxTokens?: number }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: 60000,
    });
    this.model = config.model || "gpt-4o-mini";
    this.temperature = typeof config.temperature === "number" ? config.temperature : 0.2;
    this.maxTokens = typeof config.maxTokens === "number" ? config.maxTokens : 2000;
    console.log(`[OPENAI PROVIDER] Initialized dynamically with model: ${this.model}`);
  }

  private async executeWithRetry(
    prompt: string,
    systemInstruction: string = "",
    responseMimeType: string = "text/plain",
    route: string = "unknown",
    retries: number = 2,
    baseDelayMs: number = 500,
    options?: RequestOptions
  ): Promise<AIResponse> {
    const startTime = Date.now();
    let lastError: any = null;

    let sys = systemInstruction || "";
    if (responseMimeType === "application/json" && !sys.toLowerCase().includes("json") && !prompt.toLowerCase().includes("json")) {
      sys = sys ? `${sys}\nYou MUST respond with valid JSON.` : "You MUST respond with valid JSON.";
    }

    const targetPath = options?.targetPath;
    const fileLimit = targetPath ? TokenBudgetEngine.getFileTypeMaxTokens(targetPath) : 2000;
    const requestedTokens = typeof options?.maxTokens === 'number' ? options.maxTokens : this.maxTokens;
    let finalMaxTokens = Math.min(requestedTokens, fileLimit);

    if (targetPath) {
      TokenBudgetEngine.assertTokenBudget(targetPath, finalMaxTokens);
    }

    const tpmCheck = TokenBudgetEngine.checkAndClampTPMBudget(
      "openai",
      targetPath || '',
      finalMaxTokens,
      prompt.length + sys.length
    );

    finalMaxTokens = tpmCheck.safeMaxTokens;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log("--------------------------------");
        console.log("OPENAI REQUEST");
        console.log(`Model: ${this.model}`);
        console.log(`Route: ${route}`);
        console.log(`Target File: ${targetPath || "N/A"}`);
        console.log(`Max Tokens: ${finalMaxTokens}`);
        console.log(`Prompt Length: ${prompt.length + sys.length}`);
        console.log("--------------------------------");

        let response;
        try {
          response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
              ...(sys ? [{ role: "system" as const, content: sys }] : []),
              { role: "user" as const, content: prompt }
            ],
            response_format: responseMimeType === "application/json" ? { type: "json_object" } : undefined,
            temperature: this.temperature,
            max_tokens: finalMaxTokens,
          });
        } catch (rfErr: any) {
          if (responseMimeType === "application/json" && (rfErr.status === 400 || (rfErr.message && rfErr.message.toLowerCase().includes("response_format")))) {
            console.warn(`[OPENAI PROVIDER] Model rejected response_format json_object. Retrying without response_format constraint...`);
            response = await this.client.chat.completions.create({
              model: this.model,
              messages: [
                ...(sys ? [{ role: "system" as const, content: sys }] : []),
                { role: "user" as const, content: prompt }
              ],
              temperature: this.temperature,
              max_tokens: finalMaxTokens,
            });
          } else {
            throw rfErr;
          }
        }

        const text = response.choices[0]?.message?.content || "";
        const durationMs = Date.now() - startTime;

        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;
        const totalTokens = response.usage?.total_tokens ?? 0;

        TokenBudgetEngine.updateTPMUsageSuccess("openai", totalTokens);

        console.log(`Prompt Tokens: ${promptTokens}`);
        console.log(`Completion Tokens: ${completionTokens}`);
        console.log(`Total Tokens: ${totalTokens}`);
        console.log(`Latency: ${durationMs}ms`);

        return {
          text,
          model: this.model,
          durationMs,
          usage: response.usage ? {
            promptTokens,
            completionTokens,
            totalTokens
          } : undefined
        };
      } catch (err: any) {
        lastError = err;

        console.error("--------------------------------");
        console.error("OPENAI FAILURE DETAILS");
        console.error("Full OpenAI error:", err);
        console.error("HTTP status:", err.status || "N/A");
        console.error("Error code:", err.code || "N/A");
        console.error("--------------------------------");

        const msg = (err.message || String(err)).toLowerCase();
        const isRateLimit = err.status === 429 || msg.includes("429") || msg.includes("rate limit") || msg.includes("rate exceeded") || msg.includes("rate_limit_exceeded") || msg.includes("too many requests") || msg.includes("tpd") || msg.includes("tpm") || msg.includes("rpm") || msg.includes("quota exceeded") || msg.includes("insufficient quota") || msg.includes("insufficient credits");
        const isAuth = err.status === 401 || err.status === 403 || err.status === 402 || msg.includes("401") || msg.includes("403") || msg.includes("402") || msg.includes("invalid_api_key") || msg.includes("unauthorized");

        if (isRateLimit || isAuth) {
          if (isRateLimit) {
            TokenBudgetEngine.updateTPMUsageFromError("openai", err.message || String(err));
          }
          const parsedRetryAfter = TokenBudgetEngine.extractRetryAfter(err.message || String(err), err.headers);
          const code = isRateLimit ? "RATE_LIMIT_ERROR" : "AUTH_ERROR";
          const status = err.status || (isRateLimit ? 429 : 401);
          const structuredErr = new Error(JSON.stringify({
            code,
            errorCode: code,
            stage: "AI Generation",
            engine: "OpenAIProvider",
            provider: "openai",
            model: this.model,
            statusCode: status,
            message: err.message || String(err),
            retryable: false,
            retryAfter: parsedRetryAfter
          }));
          (structuredErr as any).isTerminal = true;
          (structuredErr as any).code = code;
          (structuredErr as any).status = status;
          (structuredErr as any).isAuthError = isAuth;
          throw structuredErr;
        }

        if (attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async generate(prompt: string, systemInstruction?: string, responseMimeType?: string, options?: RequestOptions): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, responseMimeType || "text/plain", "/api/generate", 2, 500, options);
  }

  async edit(prompt: string, systemInstruction?: string, options?: RequestOptions): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json", "/api/edit", 2, 500, options);
  }

  async audit(prompt: string, systemInstruction?: string, options?: RequestOptions): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json", "/api/audit", 2, 500, options);
  }

  async plan(prompt: string, systemInstruction?: string, options?: RequestOptions): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json", "/api/generate-plan", 2, 500, options);
  }

  async compileAnalysis(prompt: string, systemInstruction?: string, options?: RequestOptions): Promise<AIResponse> {
    return this.executeWithRetry(prompt, systemInstruction, "application/json", "/api/compile", 2, 500, options);
  }

  async healthCheck(): Promise<HealthResponse> {
    const startTime = Date.now();
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user" as const, content: "ping" }],
        max_tokens: 5
      });
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        modelUsed: this.model
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        modelUsed: this.model,
        error: err.message || "Failed to call chat.completions."
      };
    }
  }

  async testConnection(): Promise<any> {
    return this.healthCheck();
  }
}
