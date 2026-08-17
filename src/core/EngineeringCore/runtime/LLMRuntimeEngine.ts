import { ProjectFile } from "../../../types";
import { MarkdownFenceStripper } from "../parsers/MarkdownFenceStripper";
import { LanguageExtractor } from "../parsers/LanguageExtractor";
import { LanguageRepairEngine } from "../parsers/LanguageRepairEngine";
import { ResponseClassifier } from "../parsers/ResponseClassifier";
import { TokenBudgetEngine } from "./TokenBudgetEngine";

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
  groq: {
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsJSON: true,
    supportsToolCalling: true,
    recommendedOutputTokens: 2048,
  },
};

export function detectProvider(modelOrName?: string): string {
  if (!modelOrName) return "openai";
  const m = modelOrName.toLowerCase();
  if (m.includes("gpt") || m.includes("openai")) return "openai";
  if (m.includes("groq")) return "groq";
  return "openai";
}

export function calculateDynamicBudget(
  providerKey: string,
  promptLength: number,
  userLimit?: number,
  targetPath?: string
): { safeOutputTokens: number; promptTokens: number; remainingContext: number } {
  const provider = PROVIDER_CAPABILITIES[providerKey] || PROVIDER_CAPABILITIES.openai;
  
  // Estimate prompt tokens: 4 characters per token
  const promptTokens = Math.ceil(promptLength / 4);
  
  // Safety margin: 2000 tokens or 10% of context
  const reservedSafetyMargin = Math.min(2000, Math.ceil(provider.contextWindow * 0.1));
  
  const remainingContext = provider.contextWindow - promptTokens - reservedSafetyMargin;
  
  // Hard limit per file category
  const fileCategoryMax = TokenBudgetEngine.getFileTypeMaxTokens(targetPath);

  // Formula: safeOutput = min(provider.maxOutputTokens, remainingContext, targetUserLimit, fileCategoryMax)
  const targetUserLimit = userLimit ? Math.min(userLimit, fileCategoryMax) : fileCategoryMax;
  let safeOutputTokens = Math.min(provider.maxOutputTokens, remainingContext, targetUserLimit, fileCategoryMax);
  
  // Hard clamp to ensure config files never exceed hard limit
  safeOutputTokens = Math.min(safeOutputTokens, fileCategoryMax);
  
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
  // Configuration files get MINIMAL context (0 source files)
  if (TokenBudgetEngine.isConfigFile(targetPath)) {
    return [];
  }

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
  generatedFiles: ProjectFile[],
  projectProfile?: any
): string {
  if (TokenBudgetEngine.isConfigFile(targetPath)) {
    const eco = projectProfile?.blockchain || 'Ecosystem';
    const fw = projectProfile?.framework || 'Framework';
    const lang = projectProfile?.language || 'Language';
    const contractType = projectProfile?.contractType || 'Contract';
    return `Minimal Configuration Context:\nEcosystem: ${eco}\nFramework: ${fw}\nLanguage: ${lang}\nContract Type: ${contractType}`;
  }

  const pruned = pruneWorkspaceFiles(targetPath, generatedFiles);
  if (pruned.length === 0) return "(Minimal context)";
  
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
    aiExecutor: (systemInstruction: string, prompt: string, targetPath?: string, maxTokens?: number) => Promise<string>,
    systemInstruction: string,
    prompt: string,
    targetPath: string,
    generatedFiles: ProjectFile[],
    modelOrName?: string,
    validator?: (cleanedContent: string) => void,
    projectProfile?: any
  ): Promise<string> {
    const providerKey = detectProvider(modelOrName);
    const provider = PROVIDER_CAPABILITIES[providerKey] || PROVIDER_CAPABILITIES.openai;

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
      let fileMaxTokens = TokenBudgetEngine.getFileTypeMaxTokens(targetPath);
      let targetUserLimit = fileMaxTokens;

      if (attempts === 2) {
        let requiredSyntax = '';
        if (ext === 'sol') {
          requiredSyntax = '\nFirst line MUST be:\npragma solidity ^0.8.20;';
        } else if (ext === 'rs') {
          requiredSyntax = '\nMust contain anchor_lang or valid Rust definitions.';
        } else if (ext === 'move') {
          requiredSyntax = '\nFirst line MUST begin with module.';
        }

        retrySystemInstruction += `\nRETRY INSTRUCTION (Attempt 2): Generate ONLY ${targetPath}.\nReturn RAW source code only.\nNo markdown.\nNo explanations.${requiredSyntax}\n[CRITICAL SYSTEM RULE]: Return ONLY the raw, executable, un-wrapped file source content text. Do NOT use markdown code fences (\`\`\`). Do NOT include introductory greetings or conversational sign-offs. Start your response text directly with the code syntax.`;
        retryPromptText += `\n[PER-FILE RETRY MODE] Output pure source code for "${targetPath}" only.`;
      } else if (attempts === 3) {
        let requiredSyntax = '';
        if (ext === 'sol') {
          requiredSyntax = '\nFirst line MUST be:\npragma solidity ^0.8.20;';
        }

        retrySystemInstruction += `\nCRITICAL RETRY INSTRUCTION (Attempt 3): Pure code mode activated for ${targetPath}.\nGenerate ONLY ${targetPath}.\nReturn RAW source code only.\nNo markdown.\nNo explanations.${requiredSyntax}\n[CRITICAL SYSTEM RULE]: Return ONLY the raw, executable, un-wrapped file source content text. Do NOT use markdown code fences (\`\`\`). Do NOT include introductory greetings or conversational sign-offs. Start your response text directly with the code syntax.`;
        retryPromptText += `\n[STRICT PURE CODE MODE] Absolute raw code output required for ${targetPath}.`;
        targetUserLimit = Math.min(fileMaxTokens, Math.floor(provider.recommendedOutputTokens / 2));
      }

      const workspaceContextText = buildPrunedWorkspaceContext(targetPath, currentGeneratedFiles, projectProfile);
      const fullPromptText = `
Workspace Context:
${workspaceContextText}

Please generate "${targetPath}" now.
${retryPromptText}
`.trim();

      const { safeOutputTokens, promptTokens } = calculateDynamicBudget(
        providerKey,
        fullPromptText.length,
        targetUserLimit,
        targetPath
      );

      // Pre-request assertion for token budget safety
      TokenBudgetEngine.assertTokenBudget(targetPath, safeOutputTokens);

      // Internal diagnostic logging before LLM request
      console.log(`[LLM DIAGNOSTIC PRE-REQUEST]
Target File: "${targetPath}"
File Category: "${TokenBudgetEngine.getFileCategory(targetPath)}"
Provider: "${providerKey}" | Model: "${modelOrName || "default"}"
Requested Max Tokens: ${safeOutputTokens}
Estimated Input Tokens: ${promptTokens}
Estimated Output Tokens: ${safeOutputTokens}
Estimated Total Tokens: ${promptTokens + safeOutputTokens}`);

      try {
        const rawResponse = await aiExecutor(retrySystemInstruction, fullPromptText, targetPath, safeOutputTokens);
        const executionTime = Date.now() - startTime;
        const completionTokens = Math.ceil(rawResponse.length / 4);
        const firstFiveLines = rawResponse.split('\n').slice(0, 5).join('\n');

        // Detailed observability log BEFORE validation
        console.log(`[LLM RUNTIME OBSERVABILITY LOG]
Target File: "${targetPath}"
Language: "${ext}"
Provider: "${providerKey}"
Attempt: ${attempts}/3
Prompt Tokens: ${promptTokens}
Completion Tokens: ${completionTokens}
First 5 Lines:
${firstFiveLines}`);

        // Classify response before normalization or validation
        const classification = ResponseClassifier.classify(rawResponse, targetPath);
        if (classification === 'PROVIDER_ERROR' || classification === 'RATE_LIMIT_ERROR' || classification === 'CONTEXT_TOKEN_ERROR' || classification === 'EMPTY_RESPONSE') {
          throw new Error(`INVALID_AI_RESPONSE: Response classified as error state: ${classification}. Raw response starting with: ${firstFiveLines}`);
        }
        if (classification === 'STRUCTURED_JSON_METADATA' && !targetPath.toLowerCase().endsWith('.json')) {
          throw new Error(`INVALID_AI_RESPONSE: Received structured JSON metadata or schema instead of raw source code for non-JSON file ${targetPath}. Raw response starting with: ${firstFiveLines}`);
        }

        // Response Normalization & Language Repair
        const normalizedResponse = LanguageExtractor.extractAndNormalize(rawResponse, targetPath);
        const repairedResponse = LanguageRepairEngine.repair(targetPath, normalizedResponse);

        // Run validation
        let validationResult = 'PASS';
        if (validator) {
          try {
            validator(repairedResponse);
          } catch (valErr: any) {
            validationResult = `FAIL (${valErr.message || String(valErr)})`;
            throw valErr;
          }
        }

        console.log(`[LLM RUNTIME OBSERVABILITY LOG] Validation Result for "${targetPath}": ${validationResult}`);

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

        return repairedResponse;
      } catch (err: any) {
        lastError = err;
        const executionTime = Date.now() - startTime;

        const msg = (err.message || String(err)).toLowerCase();
        const isRateLimit = err.status === 429 || err.isTerminal || msg.includes("429") || msg.includes("rate limit") || msg.includes("rate exceeded") || msg.includes("rate_limit_exceeded") || msg.includes("too many requests") || msg.includes("tpd") || msg.includes("tpm") || msg.includes("rpm") || msg.includes("quota exceeded") || msg.includes("insufficient quota") || msg.includes("insufficient credits");
        const isAuth = err.status === 401 || err.status === 403 || err.status === 402 || msg.includes("401") || msg.includes("403") || msg.includes("402") || msg.includes("invalid_api_key") || msg.includes("unauthorized");

        if (isRateLimit || isAuth) {
          console.log(`[LLM RUNTIME] Terminal rate limit or auth error detected. Bypassing all retries and failing immediately.`);
          throw err;
        }
        
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

