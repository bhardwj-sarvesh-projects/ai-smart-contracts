import { AIProvider } from "./AIProvider";
import { GroqProvider } from "./GroqProvider";

export function isDummyOrEmptyKey(key: string, _provider?: string): boolean {
  if (!key) return true;
  const normalized = key.trim().toLowerCase();
  return normalized.includes("replace_with") || normalized.includes("your_api_key") || normalized === "dummy";
}

export class ProviderFactory {
  /**
   * Legacy compatibility only. New production execution goes through AIOrchestrator,
   * which owns credential and model routing.
   */
  static getProvider(settings: any): AIProvider {
    if (!settings?.apiKey) throw new Error("Direct provider access is disabled. Use AIOrchestrator.");
    return new GroqProvider({ apiKey: settings.apiKey, model: settings.defaultModel, temperature: 0.1, maxTokens: 65536 });
  }
}
