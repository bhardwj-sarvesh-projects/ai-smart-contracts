export interface ProviderAdapter {
  id: string; name: string; defaultModel: string; supportedModels: string[];
}
export class OpenAIAdapter implements ProviderAdapter {
  id = 'openai'; name = 'OpenAI'; defaultModel = 'gpt-4o-mini'; supportedModels = ['gpt-4o-mini', 'gpt-4o', 'o3-mini'];
}
export class GroqAdapter implements ProviderAdapter {
  id = 'groq'; name = 'Groq Cloud'; defaultModel = 'llama-3.3-70b-versatile'; supportedModels = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768'];
}
export class ProviderRegistry {
  private static adapters = new Map<string, ProviderAdapter>();
  static initialize() { if (this.adapters.size) return; this.adapters.set('openai', new OpenAIAdapter()); this.adapters.set('groq', new GroqAdapter()); }
  static getAdapter(id: string): ProviderAdapter {
    this.initialize(); const key = (id || 'openai').toLowerCase().trim(); const adapter = this.adapters.get(key);
    if (!adapter) throw new Error(`Unsupported AI provider: ${id}. Active providers are OpenAI and Groq.`);
    return adapter;
  }
  static listAdapters(): ProviderAdapter[] { this.initialize(); return Array.from(this.adapters.values()); }
}
