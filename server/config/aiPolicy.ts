/**
 * AI Contracts — authoritative Groq policy.
 *
 * Design goals:
 * - exactly 20 platform-managed Groq credential slots
 * - three locked models per workload group
 * - deterministic credential rotation inside each workload group
 * - predictable default output budget of 2,000 tokens
 * - no user/admin model selection
 */
export const AI_TEMPERATURE = 0.1 as const;

const ENV_DEFAULT = Number(process.env.AI_DEFAULT_MAX_OUTPUT_TOKENS || 2000);
export const AI_DEFAULT_MAX_OUTPUT_TOKENS = Number.isFinite(ENV_DEFAULT)
  ? Math.max(256, Math.min(Math.floor(ENV_DEFAULT), 2000))
  : 2000;

export const GLOBAL_MAX_OUTPUT_TOKENS = AI_DEFAULT_MAX_OUTPUT_TOKENS;
export const AI_MAX_GENERATION_TOKENS = AI_DEFAULT_MAX_OUTPUT_TOKENS;

export const GROQ_MAX_CREDENTIALS = Math.max(
  1,
  Math.min(Number(process.env.GROQ_MAX_CREDENTIALS || 20), 20),
);

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

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
  | "research"
  | "ARCHITECTURE_PLANNING"
  | "SMART_CONTRACT_GENERATION"
  | "CODE_EDITING"
  | "COMPILER_REPAIR"
  | "TEST_GENERATION"
  | "TEST_ANALYSIS"
  | "SECURITY_ANALYSIS"
  | "SECURITY_REMEDIATION"
  | "DOCUMENTATION"
  | "CODE_EXPLANATION"
  | "REPOSITORY_ANALYSIS"
  | "EXTERNAL_RESEARCH"
  | "GENERAL_COPILOT";

export interface ModelPolicyEntry {
  model: string;
  maxOutputTokens: number;
}

export interface AIRoutingGroup {
  id: string;
  label: string;
  slots: readonly number[];
  tasks: readonly AITask[];
  models: readonly ModelPolicyEntry[];
}

const MODEL_LIMITS: Record<string, number> = Object.freeze({
  "openai/gpt-oss-120b": 65_536,
  "openai/gpt-oss-20b": 65_536,
  "qwen/qwen3.6-27b": 65_536,
  "groq/compound": 8_192,
  "llama-3.1-8b-instant": 131_072,
});

const model = (id: string): ModelPolicyEntry => ({
  model: id,
  maxOutputTokens: Math.min(
    GLOBAL_MAX_OUTPUT_TOKENS,
    MODEL_LIMITS[id] ?? GLOBAL_MAX_OUTPUT_TOKENS,
  ),
});

/**
 * Three locked model choices per workload group.
 * The first model is the deterministic primary.
 * Fallbacks are only used for model-access failures, not to spam a
 * provider that is already organization-rate-limited.
 */
const ROUTING_GROUPS: readonly AIRoutingGroup[] = Object.freeze([
  {
    id: "architecture",
    label: "Architecture & Repository Analysis",
    slots: [1, 2, 3],
    tasks: ["architecture", "ARCHITECTURE_PLANNING", "REPOSITORY_ANALYSIS"],
    models: Object.freeze([
      model("openai/gpt-oss-120b"),
      model("qwen/qwen3.6-27b"),
      model("openai/gpt-oss-20b"),
    ]),
  },
  {
    id: "generation",
    label: "Smart Contract Generation",
    slots: [4, 5, 6],
    tasks: ["generation", "SMART_CONTRACT_GENERATION"],
    models: Object.freeze([
      model("openai/gpt-oss-120b"),
      model("openai/gpt-oss-20b"),
      model("qwen/qwen3.6-27b"),
    ]),
  },
  {
    id: "editing-repair",
    label: "Code Editing & Repair",
    slots: [7, 8, 9],
    tasks: ["edit", "repair", "CODE_EDITING", "COMPILER_REPAIR"],
    models: Object.freeze([
      model("openai/gpt-oss-120b"),
      model("openai/gpt-oss-20b"),
      model("qwen/qwen3.6-27b"),
    ]),
  },
  {
    id: "testing",
    label: "Testing & Test Analysis",
    slots: [10, 11, 12],
    tasks: ["testing", "test_analysis", "TEST_GENERATION", "TEST_ANALYSIS"],
    models: Object.freeze([
      model("openai/gpt-oss-20b"),
      model("openai/gpt-oss-120b"),
      model("qwen/qwen3.6-27b"),
    ]),
  },
  {
    id: "security",
    label: "Security Audit & Remediation",
    slots: [13, 14, 15],
    tasks: ["security", "security_remediation", "SECURITY_ANALYSIS", "SECURITY_REMEDIATION"],
    models: Object.freeze([
      model("openai/gpt-oss-120b"),
      model("qwen/qwen3.6-27b"),
      model("openai/gpt-oss-20b"),
    ]),
  },
  {
    id: "documentation-copilot",
    label: "Documentation & Copilot",
    slots: [16, 17, 18],
    tasks: ["documentation", "copilot", "DOCUMENTATION", "CODE_EXPLANATION", "GENERAL_COPILOT"],
    models: Object.freeze([
      model("openai/gpt-oss-20b"),
      model("qwen/qwen3.6-27b"),
      model("openai/gpt-oss-120b"),
    ]),
  },
  {
    id: "research-compile",
    label: "Research & Compilation Analysis",
    slots: [19, 20],
    tasks: ["research", "EXTERNAL_RESEARCH"],
    models: Object.freeze([
      model("groq/compound"),
      model("openai/gpt-oss-120b"),
      model("qwen/qwen3.6-27b"),
    ]),
  },
]);

const NORMALIZED_TASK_TO_GROUP: Record<string, string> = Object.freeze(
  Object.fromEntries(
    ROUTING_GROUPS.flatMap((group) => group.tasks.map((task) => [String(task).toLowerCase(), group.id])),
  ),
);

export const AI_ROUTING_GROUPS = ROUTING_GROUPS;

function normalizeTask(task: AITask): string {
  return String(task || "").trim().toLowerCase();
}

export function getRoutingGroupForTask(task: AITask): AIRoutingGroup {
  const groupId = NORMALIZED_TASK_TO_GROUP[normalizeTask(task)] || "documentation-copilot";
  return ROUTING_GROUPS.find((group) => group.id === groupId) || ROUTING_GROUPS[5];
}

export function getRoutingGroupForSlot(slot: number): AIRoutingGroup {
  const normalized = Math.max(1, Math.floor(Number(slot) || 1));
  return ROUTING_GROUPS.find((group) => group.slots.includes(normalized)) || ROUTING_GROUPS[0];
}

export function getRoutingGroupIdForSlot(slot: number): string {
  return getRoutingGroupForSlot(slot).id;
}

export function getModelPolicy(task: AITask): readonly ModelPolicyEntry[] {
  return getRoutingGroupForTask(task).models;
}

export function getModelMaxOutputTokens(modelId: string): number {
  return MODEL_LIMITS[modelId] ?? GLOBAL_MAX_OUTPUT_TOKENS;
}

export function getEffectiveMaxOutputTokens(modelId: string, requested?: number): number {
  const ceiling = getModelMaxOutputTokens(modelId);
  if (!requested || !Number.isFinite(requested)) return Math.min(ceiling, GLOBAL_MAX_OUTPUT_TOKENS);
  return Math.max(
    256,
    Math.min(Math.floor(requested), ceiling, GLOBAL_MAX_OUTPUT_TOKENS),
  );
}

export function isPlatformManagedModel(modelId: string): boolean {
  return Object.prototype.hasOwnProperty.call(MODEL_LIMITS, modelId);
}

export const AI_MODEL_POLICY: Readonly<Record<string, readonly ModelPolicyEntry[]>> = Object.freeze(
  Object.fromEntries(
    ROUTING_GROUPS.flatMap((group) => group.tasks.map((task) => [task, group.models])),
  ),
);

export function getPublicPolicy() {
  return Object.fromEntries(
    Object.entries(
      Object.fromEntries(
        ROUTING_GROUPS.flatMap((group) => group.tasks.map((task) => [task, group.models])),
      ),
    ).map(([task, entries]) => [
      task,
      (entries as readonly ModelPolicyEntry[]).map((entry) => ({ ...entry })),
    ]),
  );
}

export function getPublicRoutingGroups() {
  return ROUTING_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    slots: [...group.slots],
    tasks: [...group.tasks],
    models: group.models.map((entry) => ({ ...entry })),
  }));
}
