/**
 * AUTHORITATIVE AI POLICY
 *
 * This file is intentionally code-controlled. Do not expose these values through
 * user settings or the Admin Panel. Administrators manage credentials only.
 */
export const AI_TEMPERATURE = 0.1 as const;
export const GLOBAL_MAX_OUTPUT_TOKENS = 65536 as const;

export type AITask =
  | "architecture"
  | "generation"
  | "edit"
  | "repair"
  | "testing"
  | "test_analysis"
  | "security"
  | "security_remediation"
  | "documentation"
  | "copilot"
  | "repository_analysis"
  | "research";

export interface ModelPolicyEntry {
  model: string;
  maxOutputTokens: number;
}

const PRODUCTION_MODELS = {
  GPT_OSS_120B: "openai/gpt-oss-120b",
  GPT_OSS_20B: "openai/gpt-oss-20b",
  QWEN_3_6_27B: "qwen/qwen3.6-27b",
  COMPOUND: "groq/compound",
} as const;

/**
 * Model order is deliberately hardcoded. Credentials are supplied separately
 * by the Admin-controlled credential pool.
 */
export const AI_MODEL_POLICY: Readonly<Record<AITask, readonly ModelPolicyEntry[]>> = Object.freeze({
  architecture: [
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
  ],
  generation: [
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
  ],
  edit: [
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
  ],
  repair: [
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
  ],
  testing: [
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
  ],
  test_analysis: [
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
  ],
  security: [
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
  ],
  security_remediation: [
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
  ],
  documentation: [
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
  ],
  copilot: [
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
  ],
  repository_analysis: [
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
    { model: PRODUCTION_MODELS.GPT_OSS_20B, maxOutputTokens: 65536 },
  ],
  research: [
    { model: PRODUCTION_MODELS.COMPOUND, maxOutputTokens: 8192 },
    { model: PRODUCTION_MODELS.GPT_OSS_120B, maxOutputTokens: 65536 },
    { model: PRODUCTION_MODELS.QWEN_3_6_27B, maxOutputTokens: 16384 },
  ],
});

export const MODEL_CONTEXT_LIMITS: Readonly<Record<string, number>> = Object.freeze({
  [PRODUCTION_MODELS.GPT_OSS_120B]: 131072,
  [PRODUCTION_MODELS.GPT_OSS_20B]: 131072,
  [PRODUCTION_MODELS.QWEN_3_6_27B]: 131072,
  [PRODUCTION_MODELS.COMPOUND]: 131072,
});

export function getModelPolicy(task: AITask): readonly ModelPolicyEntry[] {
  return AI_MODEL_POLICY[task] || AI_MODEL_POLICY.copilot;
}

export function getEffectiveMaxOutputTokens(model: string, requested?: number): number {
  const modelLimit = AI_MODEL_POLICY
    ? Object.values(AI_MODEL_POLICY).flat().find(entry => entry.model === model)?.maxOutputTokens
    : undefined;
  const hardLimit = modelLimit || GLOBAL_MAX_OUTPUT_TOKENS;
  if (!requested || !Number.isFinite(requested)) return hardLimit;
  return Math.max(256, Math.min(Math.floor(requested), hardLimit));
}

export function getPublicPolicy() {
  return Object.fromEntries(
    Object.entries(AI_MODEL_POLICY).map(([task, entries]) => [
      task,
      entries.map(entry => ({ model: entry.model, maxOutputTokens: entry.maxOutputTokens }))
    ])
  );
}
