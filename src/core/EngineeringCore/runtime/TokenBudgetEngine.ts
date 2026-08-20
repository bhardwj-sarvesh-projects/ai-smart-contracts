/**
 * Provider-aware token/rate budget manager.
 *
 * Important:
 * - No arbitrary Groq 8k TPM limit is invented here.
 * - Until Groq reports its real organization limit, the TPM ceiling is unknown.
 * - Once headers/errors reveal the real limit, the engine uses it for preflight.
 * - The platform's deterministic generation ceiling is handled by aiPolicy.ts.
 */
export interface TPMTracker {
  tpmLimit: number;
  recentTokensUsed: number;
  lastResetTime: number;
  remainingTokens?: number;
  resetMs?: number;
}

const trackers: Record<string, TPMTracker> = {
  groq: {
    tpmLimit: Number.POSITIVE_INFINITY,
    recentTokensUsed: 0,
    lastResetTime: Date.now(),
    remainingTokens: Number.POSITIVE_INFINITY,
    resetMs: 0,
  },
};

const FILE_LIMITS: Record<string, number> = {
  ".sol": 2000,
  ".rs": 2000,
  ".move": 2000,
  ".ts": 2000,
  ".tsx": 2000,
  ".js": 2000,
  ".jsx": 2000,
  ".json": 2000,
  ".toml": 2000,
  ".md": 2000,
  ".txt": 2000,
  ".env": 2000,
  ".html": 2000,
  ".css": 2000,
};

const CONFIG_EXTENSIONS = new Set([".toml", ".json", ".env", ".yml", ".yaml"]);

function normalizeHeaders(headers: any): Record<string, string> {
  if (!headers) return {};
  if (typeof headers === "object" && typeof headers.entries === "function") {
    return Object.fromEntries(headers.entries());
  }
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    output[String(key).toLowerCase()] = String(value);
  }
  return output;
}

function parseResetDuration(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value * 1000);
  }

  const text = String(value ?? "").trim();
  if (!text) return 0;

  const seconds = text.match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
  if (seconds) return Math.ceil(Number(seconds[1]) * 1000);

  const minutes = text.match(/^([0-9]+(?:\.[0-9]+)?)m$/i);
  if (minutes) return Math.ceil(Number(minutes[1]) * 60_000);

  const numeric = Number(text);
  return Number.isFinite(numeric) ? Math.max(0, Math.ceil(numeric * 1000)) : 0;
}

export class TokenBudgetEngine {
  static estimateTokens(textOrLength: string | number): number {
    const chars = typeof textOrLength === "number" ? textOrLength : String(textOrLength || "").length;
    return Math.max(0, Math.ceil(chars / 4));
  }

  static getFileTypeMaxTokens(targetPath?: string): number {
    if (!targetPath) return 2000;
    const lower = targetPath.toLowerCase();
    const dot = lower.lastIndexOf(".");
    const ext = dot >= 0 ? lower.slice(dot) : "";
    return FILE_LIMITS[ext] ?? 2000;
  }

  static isConfigFile(targetPath?: string): boolean {
    if (!targetPath) return false;
    const lower = targetPath.toLowerCase();
    const dot = lower.lastIndexOf(".");
    return CONFIG_EXTENSIONS.has(dot >= 0 ? lower.slice(dot) : "");
  }

  static getFileCategory(targetPath?: string): string {
    if (!targetPath) return "Generic Code";
    const pathLower = targetPath.toLowerCase();
    const filename = pathLower.split("/").pop() || "";

    if (this.isConfigFile(targetPath)) return "Configuration";
    if (
      filename === "readme.md" ||
      pathLower.endsWith(".md") ||
      pathLower.endsWith(".txt")
    )
      return "Documentation";
    if (
      pathLower.includes(".test.") ||
      pathLower.includes(".spec.") ||
      pathLower.includes("/test/") ||
      pathLower.includes("/tests/")
    )
      return "Tests";
    if (
      pathLower.includes("deploy") ||
      pathLower.includes("migration") ||
      pathLower.includes("script")
    )
      return "Deployment";
    if (pathLower.endsWith(".sol")) return "Solidity Contract";
    if (pathLower.endsWith(".rs")) return "Rust Program";
    if (pathLower.endsWith(".move")) return "Move Module";
    return "Source Code";
  }

  static assertTokenBudget(targetPath: string | undefined, tokens: number): void {
    const limit = this.getFileTypeMaxTokens(targetPath);
    if (tokens > limit) {
      throw new Error(`TOKEN_BUDGET_EXCEEDED: ${tokens} exceeds ${limit} for ${targetPath || "file"}`);
    }
  }

  static getTPMSnapshot(providerKey: string): TPMTracker | null {
    const tracker = trackers[String(providerKey || "").toLowerCase()];
    return tracker ? { ...tracker } : null;
  }

  static parseDurationToMs(value: unknown): number {
    return parseResetDuration(value);
  }

  static extractRetryAfter(errMessage: string, headers?: any): string | number | null {
    const normalized = normalizeHeaders(headers);
    const header = normalized["retry-after"]
      || normalized["x-ratelimit-reset-tokens"]
      || normalized["x-ratelimit-reset-requests"];
    if (header) return header;

    const text = String(errMessage || "");
    const match = text.match(/try again in\s+([0-9]+(?:\.[0-9]+)?s?)/i)
      || text.match(/in\s+([0-9]+(?:\.[0-9]+)?s)/i);
    return match?.[1] || null;
  }

  static updateFromHeaders(providerKey: string, headers: any, _model?: string): void {
    const key = String(providerKey || "").toLowerCase();
    const tracker = trackers[key];
    if (!tracker) return;

    const normalized = normalizeHeaders(headers);

    const limit = Number(
      normalized["x-ratelimit-limit-tokens"]
      || normalized["x-ratelimit-limit-tpm"]
      || normalized["x-ratelimit-limit-token"],
    );

    const remaining = Number(normalized["x-ratelimit-remaining-tokens"]);
    const resetRaw = normalized["x-ratelimit-reset-tokens"] || normalized["retry-after"];
    const resetMs = parseResetDuration(resetRaw);

    if (Number.isFinite(limit) && limit > 0) {
      tracker.tpmLimit = limit;
    }

    if (Number.isFinite(remaining) && remaining >= 0) {
      tracker.remainingTokens = remaining;
      if (Number.isFinite(tracker.tpmLimit)) {
        tracker.recentTokensUsed = Math.max(0, tracker.tpmLimit - remaining);
      }
    }

    if (resetMs > 0) {
      tracker.resetMs = resetMs;
      tracker.lastResetTime = Date.now();
    }
  }

  static updateTPMUsageFromError(providerKey: string, errMessage: string): void {
    const key = String(providerKey || "").toLowerCase();
    const tracker = trackers[key];
    if (!tracker) return;

    const limitMatch = String(errMessage || "").match(/Limit\s+([0-9]+)/i);
    const usedMatch = String(errMessage || "").match(/Used\s+([0-9]+)/i);
    const retryMatch = String(errMessage || "").match(/try again in\s+([0-9]+(?:\.[0-9]+)?s?)/i);

    if (limitMatch) {
      tracker.tpmLimit = Number(limitMatch[1]);
    }

    if (usedMatch) {
      tracker.recentTokensUsed = Number(usedMatch[1]);
      tracker.remainingTokens = Number.isFinite(tracker.tpmLimit)
        ? Math.max(0, tracker.tpmLimit - tracker.recentTokensUsed)
        : Number.POSITIVE_INFINITY;
    }

    if (retryMatch) {
      tracker.resetMs = parseResetDuration(retryMatch[1]);
      tracker.lastResetTime = Date.now();
    }
  }

  static updateTPMUsageSuccess(providerKey: string, tokensUsed: number): void {
    const tracker = trackers[String(providerKey || "").toLowerCase()];
    if (!tracker) return;

    const now = Date.now();
    const resetWindowExpired =
      Number.isFinite(tracker.tpmLimit) &&
      (tracker.resetMs > 0
        ? now - tracker.lastResetTime >= tracker.resetMs
        : now - tracker.lastResetTime >= 60_000);

    if (resetWindowExpired) {
      tracker.recentTokensUsed = Math.max(0, tokensUsed);
      tracker.lastResetTime = now;
    } else {
      tracker.recentTokensUsed += Math.max(0, tokensUsed);
    }

    tracker.remainingTokens = Number.isFinite(tracker.tpmLimit)
      ? Math.max(0, tracker.tpmLimit - tracker.recentTokensUsed)
      : Number.POSITIVE_INFINITY;
  }

  static logTPMGuard(providerKey: string, model: string, requestedTokens: number, promptLength: number): void {
    const snapshot = this.getTPMSnapshot(providerKey);
    if (!snapshot) return;

    console.log(
      `[TPM GUARD] provider=${providerKey} model=${model} prompt≈${this.estimateTokens(promptLength)} ` +
      `requestedOutput=${requestedTokens} limit=${snapshot.tpmLimit} used=${snapshot.recentTokensUsed} ` +
      `remaining=${snapshot.remainingTokens}`,
    );
  }

  static getSafeRequestBudget(
    providerKey: string,
    requestedOutputTokens: number,
    promptLength: number,
    _model?: string,
  ): {
    safeOutputTokens: number;
    promptTokens: number;
    tpmLimit: number;
    remainingTokens: number;
    shouldCompact: boolean;
    shouldWait: boolean;
    retryAfterMs: number;
  } {
    const tracker = trackers[String(providerKey || "").toLowerCase()];
    const promptTokens = this.estimateTokens(promptLength);

    if (!tracker || !Number.isFinite(tracker.tpmLimit)) {
      return {
        safeOutputTokens: Math.max(256, requestedOutputTokens),
        promptTokens,
        tpmLimit: Number.POSITIVE_INFINITY,
        remainingTokens: Number.POSITIVE_INFINITY,
        shouldCompact: false,
        shouldWait: false,
        retryAfterMs: 0,
      };
    }

    const now = Date.now();
    const elapsed = now - tracker.lastResetTime;
    const resetWindow = tracker.resetMs > 0 ? tracker.resetMs : 60_000;

    if (elapsed >= resetWindow) {
      tracker.recentTokensUsed = 0;
      tracker.remainingTokens = tracker.tpmLimit;
      tracker.resetMs = 0;
      tracker.lastResetTime = now;
    }

    const remainingTokens = Math.max(
      0,
      Number.isFinite(tracker.remainingTokens)
        ? tracker.remainingTokens
        : tracker.tpmLimit - tracker.recentTokensUsed,
    );

    const safetyReserve = Math.min(
      256,
      Math.max(64, Math.floor(tracker.tpmLimit * 0.05)),
    );

    const usable = Math.max(0, remainingTokens - safetyReserve);
    const requested = Math.max(256, requestedOutputTokens);

    // If the entire prompt fits but current window is occupied, waiting is better
    // than silently shrinking a deterministic 2,000-token generation.
    const totalRequested = promptTokens + requested;
    const shouldWait = totalRequested > usable && promptTokens < Math.max(256, tracker.tpmLimit - safetyReserve);

    // If the prompt itself cannot fit after reset, compaction is required.
    const shouldCompact = promptTokens >= Math.max(256, tracker.tpmLimit - safetyReserve);

    const safeOutputTokens = shouldWait
      ? requested
      : Math.max(256, Math.min(requested, usable - promptTokens));

    const retryAfterMs = shouldWait
      ? Math.max(1000, tracker.resetMs || 10_000)
      : 0;

    return {
      safeOutputTokens,
      promptTokens,
      tpmLimit: tracker.tpmLimit,
      remainingTokens,
      shouldCompact,
      shouldWait,
      retryAfterMs,
    };
  }

  static checkAndClampTPMBudget(
    providerKey: string,
    targetPath: string,
    requestedMaxTokens: number,
    promptLength: number,
  ): {
    safeMaxTokens: number;
    shouldFailFast: boolean;
    shouldWait: boolean;
    retryAfterMs: number;
    reason?: string;
  } {
    const requested = Math.min(requestedMaxTokens, this.getFileTypeMaxTokens(targetPath));
    const budget = this.getSafeRequestBudget(providerKey, requested, promptLength);

    if (budget.shouldCompact) {
      return {
        safeMaxTokens: Math.max(256, Math.min(requested, 512)),
        shouldFailFast: true,
        shouldWait: false,
        retryAfterMs: 0,
        reason: `REQUEST_CONTEXT_TOO_LARGE: estimated input ${budget.promptTokens} tokens exceeds the current observed provider window.`,
      };
    }

    return {
      safeMaxTokens: budget.safeOutputTokens,
      shouldFailFast: false,
      shouldWait: budget.shouldWait,
      retryAfterMs: budget.retryAfterMs,
    };
  }
}
