import { ProjectFile } from "../../../types";
import { MarkdownFenceStripper } from "../parsers/MarkdownFenceStripper";

export interface ProviderCapabilities {
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsJSON: boolean;
  supportsToolCalling: boolean;
  recommendedOutputTokens: number;
}

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  openai: {
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsJSON: true,
    supportsToolCalling: true,
    recommendedOutputTokens: 4096,
  },
  claude: {
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsJSON: true,
    supportsToolCalling: true,
    recommendedOutputTokens: 4096,
  },
  openrouter: {
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsJSON: true,
    supportsToolCalling: false,
    recommendedOutputTokens: 4096,
  },
  groq: {
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsJSON: true,
    supportsToolCalling: true,
    recommendedOutputTokens: 2048,
  },
  gemini: {
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsJSON: true,
    supportsToolCalling: true,
    recommendedOutputTokens: 8192,
  },
  bedrock: {
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsJSON: true,
    supportsToolCalling: true,
    recommendedOutputTokens: 4096,
  }
};

export function detectProvider(modelOrName?: string): string {
  if (!modelOrName) return "gemini";
  const m = modelOrName.toLowerCase();
  if (m.includes("gemini")) return "gemini";
  if (m.includes("gpt") || m.includes("openai")) return "openai";
  if (m.includes("claude") || m.includes("anthropic")) return "claude";
  if (m.includes("groq")) return "groq";
  if (m.includes("bedrock")) return "bedrock";
  if (m.includes("openrouter")) return "openrouter";
  return "gemini"; // default fallback
}

export function calculateDynamicBudget(
  providerKey: string,
  promptLength: number,
  userLimit?: number
): { safeOutputTokens: number; promptTokens: number; remainingContext: number } {
  const provider = PROVIDER_CAPABILITIES[providerKey] || PROVIDER_CAPABILITIES.gemini;
  
  // Estimate prompt tokens: 4 characters per token
  const promptTokens = Math.ceil(promptLength / 4);
  
  // Safety margin: 2000 tokens or 10% of context
  const reservedSafetyMargin = Math.min(2000, Math.ceil(provider.contextWindow * 0.1));
  
  const remainingContext = provider.contextWindow - promptTokens - reservedSafetyMargin;
  
  // Formula: safeOutput = min(provider.maxOutputTokens, remainingContext, userLimit)
  const targetUserLimit = userLimit || provider.recommendedOutputTokens;
  let safeOutputTokens = Math.min(provider.maxOutputTokens, remainingContext, targetUserLimit);
  
  // Clamp between minimum 256 and maximum provider capability
  safeOutputTokens = Math.max(256, Math.min(safeOutputTokens, provider.maxOutputTokens));
  
  return {
    safeOutputTokens,
    promptTokens,
    remainingContext,
  };
}

export function pruneWorkspaceFiles(
  targetPath: string,
  generatedFiles: ProjectFile[]
): ProjectFile[] {
  const excludedKeywords = [
    "readme",
    "report",
    "checksum",
    "certification",
    "audit",
    "manifest",
    "delivery_summary",
    "package-lock.json",
    "yarn.lock"
  ];

  const isExcluded = (path: string): boolean => {
    const lower = path.toLowerCase();
    return excludedKeywords.some(kw => lower.includes(kw)) || lower.endsWith(".md");
  };

  // Only consider code files
  const cleanFiles = generatedFiles.filter(gf => !isExcluded(gf.path));

  // Determine what is relevant to the targetPath
  const targetFilename = targetPath.split("/").pop() || "";
  const targetBaseName = targetFilename.split(".").shift() || "";

  return cleanFiles.filter(gf => {
    const filename = gf.path.split("/").pop() || "";
    const baseName = filename.split(".").shift() || "";

    // 1. Always keep dependency interfaces and base libraries/utils
    if (
      gf.path.toLowerCase().includes("interface") ||
      filename.startsWith("I") ||
      gf.path.toLowerCase().includes("lib") ||
      gf.path.toLowerCase().includes("util")
    ) {
      return true;
    }

    // 2. Keep if name matches or is referenced
    if (targetPath.toLowerCase().includes(baseName.toLowerCase()) || baseName.toLowerCase().includes(targetBaseName.toLowerCase())) {
      return true;
    }

    // 3. Keep previously generated files only if they are imported / referenced
    const isTargetTest = targetPath.toLowerCase().includes("test");
    const isGfTest = gf.path.toLowerCase().includes("test");
    if (isTargetTest === isGfTest) {
      if (isTargetTest) {
        return true; // Keep code files for testing context
      }
    }

    return false;
  });
}

export function buildPrunedWorkspaceContext(
  targetPath: string,
  generatedFiles: ProjectFile[]
): string {
  const pruned = pruneWorkspaceFiles(targetPath, generatedFiles);
  if (pruned.length === 0) return "(None yet)";
  
  return pruned
    .map(gf => `File: ${gf.path}\n\`\`\`${gf.language}\n${gf.content}\n\`\`\``)
    .join("\n\n");
}

export interface ObservabilityLog {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  maxTokensRequested: number;
  maxTokensAllowed: number;
  retryCount: number;
  promptSize: number;
  contextSize: number;
  executionTime: number;
  failureReason?: string;
}

export class LLMRuntimeEngine {
  private static logs: ObservabilityLog[] = [];

  public static getLogs(): ObservabilityLog[] {
    return this.logs;
  }

  public static logRequest(log: ObservabilityLog) {
    this.logs.push(log);
    console.log(`[LLM RUNTIME OBSERVE] ---------------------------------------------`);
    console.log(`[LLM RUNTIME OBSERVE] Provider: ${log.provider} | Model: ${log.model}`);
    console.log(`[LLM RUNTIME OBSERVE] Prompt Tokens: ${log.promptTokens} | Completion Tokens: ${log.completionTokens}`);
    console.log(`[LLM RUNTIME OBSERVE] Requested Max: ${log.maxTokensRequested} | Allowed Max: ${log.maxTokensAllowed}`);
    console.log(`[LLM RUNTIME OBSERVE] Prompt Size: ${log.promptSize} chars | Context Size: ${log.contextSize} chars`);
    console.log(`[LLM RUNTIME OBSERVE] Retries: ${log.retryCount} | Execution Time: ${log.executionTime}ms`);
    if (log.failureReason) {
      console.log(`[LLM RUNTIME OBSERVE] Failure Reason: ${log.failureReason}`);
    }
    console.log(`[LLM RUNTIME OBSERVE] ---------------------------------------------`);
  }

  public static async executeWithAdaptiveRetry(
    aiExecutor: (systemInstruction: string, prompt: string) => Promise<string>,
    systemInstruction: string,
    prompt: string,
    targetPath: string,
    generatedFiles: ProjectFile[],
    modelOrName?: string,
    validator?: (cleanedContent: string) => void
  ): Promise<string> {
    const providerKey = detectProvider(modelOrName);
    const provider = PROVIDER_CAPABILITIES[providerKey] || PROVIDER_CAPABILITIES.gemini;

    let currentGeneratedFiles = [...generatedFiles];
    let attempts = 0;
    const maxRetries = 3;
    let lastError: any = null;
    const ext = targetPath.split('.').pop()?.toLowerCase() || '';

    while (attempts < maxRetries) {
      attempts++;
      const startTime = Date.now();

      let retrySystemInstruction = systemInstruction;
      let retryPromptText = prompt;
      let targetUserLimit = provider.recommendedOutputTokens;

      if (attempts === 2) {
        let requiredSyntax = '';
        if (ext === 'sol') {
          requiredSyntax = '\nFirst line MUST be:\npragma solidity ^0.8.20;';
        } else if (ext === 'rs') {
          requiredSyntax = '\nMust contain anchor_lang or valid Rust definitions.';
        } else if (ext === 'move') {
          requiredSyntax = '\nFirst line MUST begin with module.';
        }

        retrySystemInstruction += `\nRETRY INSTRUCTION (Attempt 2): Generate ONLY ${targetPath}.\nReturn RAW source code only.\nNo markdown.\nNo explanations.${requiredSyntax}`;
        retryPromptText += `\n[PER-FILE RETRY MODE] Output pure source code for "${targetPath}" only.`;
      } else if (attempts === 3) {
        let requiredSyntax = '';
        if (ext === 'sol') {
          requiredSyntax = '\nFirst line MUST be:\npragma solidity ^0.8.20;';
        }

        retrySystemInstruction += `\nCRITICAL RETRY INSTRUCTION (Attempt 3): Pure code mode activated for ${targetPath}.\nGenerate ONLY ${targetPath}.\nReturn RAW source code only.\nNo markdown.\nNo explanations.${requiredSyntax}`;
        retryPromptText += `\n[STRICT PURE CODE MODE] Absolute raw code output required for ${targetPath}.`;
        targetUserLimit = Math.floor(provider.recommendedOutputTokens / 2);
      }

      const workspaceContextText = buildPrunedWorkspaceContext(targetPath, currentGeneratedFiles);
      const fullPromptText = `
Workspace Context:
${workspaceContextText}

Please generate "${targetPath}" now.
${retryPromptText}
`.trim();

      const { safeOutputTokens, promptTokens } = calculateDynamicBudget(
        providerKey,
        fullPromptText.length,
        targetUserLimit
      );

      try {
        const rawResponse = await aiExecutor(retrySystemInstruction, fullPromptText);
        const executionTime = Date.now() - startTime;
        
        // Response Cleanup before validation
        const cleanedResponse = MarkdownFenceStripper.strip(rawResponse, targetPath);

        // Run validation inside retry loop
        if (validator) {
          validator(cleanedResponse);
        }

        const completionTokens = Math.ceil(cleanedResponse.length / 4);

        this.logRequest({
          provider: providerKey,
          model: modelOrName || "default",
          promptTokens,
          completionTokens,
          maxTokensRequested: safeOutputTokens,
          maxTokensAllowed: provider.maxOutputTokens,
          retryCount: attempts - 1,
          promptSize: fullPromptText.length,
          contextSize: workspaceContextText.length,
          executionTime,
        });

        return cleanedResponse;
      } catch (err: any) {
        lastError = err;
        const executionTime = Date.now() - startTime;
        
        console.log(`[RETRY ENGINE LOG] file: "${targetPath}" | attempt: ${attempts}/3 | validation stage: "LLM_VALIDATION" | provider: "${providerKey}" | promptTokens: ${promptTokens} | completionTokens: 0 | failure reason: "${err.message || String(err)}" | retry duration: ${executionTime}ms`);

        this.logRequest({
          provider: providerKey,
          model: modelOrName || "default",
          promptTokens,
          completionTokens: 0,
          maxTokensRequested: safeOutputTokens,
          maxTokensAllowed: provider.maxOutputTokens,
          retryCount: attempts,
          promptSize: fullPromptText.length,
          contextSize: workspaceContextText.length,
          executionTime,
          failureReason: err.message || String(err),
        });

        if (attempts >= maxRetries) {
          break;
        }

        // Adaptive failure recovery: Reduce workspace context for next retry
        if (currentGeneratedFiles.length > 0) {
          currentGeneratedFiles = currentGeneratedFiles.slice(Math.ceil(currentGeneratedFiles.length / 2));
        }
        
        // Fast retry start delay (<200ms target)
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    throw new Error(`FAST_FAIL: LLM Runtime failed for file "${targetPath}" after ${maxRetries} retries. Last error: ${lastError?.message || String(lastError)}`);
  }
}

