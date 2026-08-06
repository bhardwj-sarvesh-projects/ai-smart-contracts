export interface ProviderAdapter {
  id: string;
  name: string;
  defaultModel: string;
  supportedModels: string[];
}

export class OpenAIAdapter implements ProviderAdapter {
  id = 'openai';
  name = 'OpenAI';
  defaultModel = 'gpt-4o';
  supportedModels = ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini'];
}

export class OpenRouterAdapter implements ProviderAdapter {
  id = 'openrouter';
  name = 'OpenRouter';
  defaultModel = 'google/gemini-2.5-pro';
  supportedModels = [
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4.1',
    'openai/gpt-5',
    'openai/gpt-5-mini',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-r1',
    'deepseek/deepseek-v3',
    'meta-llama/llama-4-maverick',
    'qwen/qwen3-coder',
    'mistralai/mistral-large',
    'x-ai/grok-4'
  ];
}

export class GroqAdapter implements ProviderAdapter {
  id = 'groq';
  name = 'Groq Cloud';
  defaultModel = 'llama-3.3-70b-versatile';
  supportedModels = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768'];
}

export class AnthropicAdapter implements ProviderAdapter {
  id = 'anthropic';
  name = 'Anthropic Claude';
  defaultModel = 'claude-3-5-sonnet';
  supportedModels = ['claude-3-5-sonnet', 'claude-3-haiku'];
}

export class ProviderRegistry {
  private static adapters: Map<string, ProviderAdapter> = new Map();

  static initialize() {
    if (this.adapters.size > 0) return;
    this.adapters.set('openai', new OpenAIAdapter());
    this.adapters.set('openrouter', new OpenRouterAdapter());
    this.adapters.set('groq', new GroqAdapter());
    this.adapters.set('anthropic', new AnthropicAdapter());
  }

  static getAdapter(id: string): ProviderAdapter {
    this.initialize();
    const normalized = (id || 'openrouter').toLowerCase().trim();
    return this.adapters.get(normalized) || this.adapters.get('openrouter')!;
  }
}
