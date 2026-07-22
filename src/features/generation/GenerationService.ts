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
    const aiExecutor = async (systemInstruction: string, promptText: string): Promise<string> => {
      const res = await options.authedFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          blockchain: options.blockchain || 'ethereum',
          language: options.language || 'solidity',
          framework: options.framework || 'foundry',
          systemInstruction,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'AI generation failed');
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
