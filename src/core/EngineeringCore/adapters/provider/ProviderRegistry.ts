export interface ProviderAdapter {
  id: string;
  name: string;
  defaultModel: string;
  supportedModels: string[];
}

/**
 * Informational registry only.
 * Runtime selection is authoritative in server/config/aiPolicy.ts.
 */
export class OpenAIAdapter implements ProviderAdapter {
  id = "openai";
  name = "OpenAI (legacy adapter)";
  defaultModel = "server-managed";
  supportedModels = [];
}

export class GroqAdapter implements ProviderAdapter {
  id = "groq";
  name = "Groq Cloud";
  defaultModel = "openai/gpt-oss-120b";
  supportedModels = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "groq/compound",
  ];
}

export class ProviderRegistry {
  private static adapters = new Map<string, ProviderAdapter>();

  static initialize() {
    if (this.adapters.size) return;
    this.adapters.set("openai", new OpenAIAdapter());
    this.adapters.set("groq", new GroqAdapter());
  }

  static getAdapter(id: string): ProviderAdapter {
    this.initialize();
    const key = String(id || "groq").toLowerCase().trim();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new Error(`Unsupported AI provider: ${id}. Production execution is Groq-managed.`);
    }
    return adapter;
  }

  static listAdapters(): ProviderAdapter[] {
    this.initialize();
    return Array.from(this.adapters.values());
  }
}
