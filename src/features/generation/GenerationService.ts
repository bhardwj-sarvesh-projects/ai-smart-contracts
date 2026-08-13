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
      maxTokens?: number
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
              provider: options.blockchain || 'openai',
              model: 'gpt-4o-mini',
              statusCode: res.status,
              message: text || 'AI generation failed',
              retryable: false
            }
          };
        }
        const errorObj = errData.error || errData;
        throw new Error(typeof errorObj === 'string' ? errorObj : JSON.stringify(errorObj));
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
    });
  }
}
