export interface ProviderAdapter {
  id: string;
  name: string;
  defaultModel: string;
  supportedModels: string[];
}

/** Legacy compatibility adapter. Production execution is server-side Groq routing. */
export class GroqAdapter implements ProviderAdapter {
  id = 'groq';
  name = 'Groq Intelligent Router';
  defaultModel = 'platform-router';
  supportedModels = [
    'openai/gpt-oss-120b',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-20b',
    'groq/compound',
  ];
}

export class OpenAIAdapter implements ProviderAdapter {
  id = 'openai';
  name = 'Legacy / Disabled';
  defaultModel = 'platform-router';
  supportedModels: string[] = [];
}

export class ProviderRegistry {
  private static adapters = new Map<string, ProviderAdapter>();
  static initialize() {
    if (this.adapters.size) return;
    this.adapters.set('groq', new GroqAdapter());
    this.adapters.set('openai', new OpenAIAdapter());
  }
  static getAdapter(id: string): ProviderAdapter {
    this.initialize();
    const key = (id || 'groq').toLowerCase().trim();
    const adapter = this.adapters.get(key);
    if (!adapter) throw new Error(`Unsupported provider: ${id}. AI Contracts uses the Groq Intelligent Router.`);
    return adapter;
  }
  static listAdapters(): ProviderAdapter[] { this.initialize(); return Array.from(this.adapters.values()); }
}
