import { EngineeringCore } from '../../core/EngineeringCore';
import { StructuredProjectOutput } from '../../core/EngineeringCore/types';

export interface GenerationOptions {
  prompt: string;
  blockchain?: string;
  language?: string;
  framework?: string;
  authedFetch: (url: string, options?: any) => Promise<any>;
}

export class GenerationService {
  static async generate(options: GenerationOptions): Promise<StructuredProjectOutput> {
    const aiExecutor = async (
      systemInstruction: string,
      promptText: string,
      targetPath?: string,
      maxTokens?: number,
      routeAttempt?: number
    ): Promise<string> => {
      const res = await options.authedFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          blockchain: options.blockchain || 'ethereum',
          language: options.language || 'solidity',
          framework: options.framework || 'foundry',
          systemInstruction,
          targetPath,
          maxTokens,
          routeAttempt,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let errData;
        try {
          errData = JSON.parse(text);
        } catch {
          errData = {
            success: false,
            error: {
              code: "API_ERROR",
              errorCode: "API_ERROR",
              stage: "AI Generation",
              engine: "AIService",
              provider: 'platform-router',
              model: 'platform-router',
              statusCode: res.status,
              message: text || 'AI generation failed',
              retryable: false
            }
          };
        }
        const errorObj = errData.error || errData;
        const errorMessage = typeof errorObj === 'string'
          ? errorObj
          : String(errorObj?.message || errData?.message || 'AI generation failed');

        // Preserve structured server metadata so the client runtime can make
        // the same terminal/non-terminal decision as the server orchestrator.
        // The previous JSON-string-only error erased status/code and caused
        // model-unavailable/rate-limit failures to be retried as if they were
        // ordinary validation failures.
        const structuredError: any = new Error(errorMessage);
        if (errorObj && typeof errorObj === 'object') {
          Object.assign(structuredError, {
            code: errorObj.code || errorObj.errorCode,
            errorCode: errorObj.errorCode || errorObj.code,
            status: errorObj.statusCode || res.status,
            statusCode: errorObj.statusCode || res.status,
            retryable: errorObj.retryable,
            retryAfter: errorObj.retryAfter,
            retryAfterMs: errorObj.retryAfterMs,
            provider: errorObj.provider,
            model: errorObj.model,
            stage: errorObj.stage,
            engine: errorObj.engine,
          });
        } else {
          structuredError.status = res.status;
          structuredError.statusCode = res.status;
        }
        throw structuredError;
      }

      const json = await res.json();
      return typeof json.data === 'string' ? json.data : JSON.stringify(json.data || json);
    };

    return EngineeringCore.generateProject({
      userPrompt: options.prompt,
      blockchain: options.blockchain,
      language: options.language,
      framework: options.framework,
      aiExecutor,
      authedFetch: options.authedFetch,
    });
  }
}
