import { AIProvider } from "./AIProvider";

export function isDummyOrEmptyKey(key: string, _provider?: string): boolean {
  if (!key) return true;
  const normalized = key.trim().toLowerCase();
  return normalized.includes("replace_with") || normalized.includes("your_api_key") || normalized === "dummy";
}

export class ProviderFactory {
  /**
   * Legacy compatibility guard.
   *
   * Direct provider construction is intentionally disabled. API credentials and
   * model selection are owned by AIOrchestrator and must never be supplied by a
   * user-controlled settings object.
   */
  static getProvider(_settings?: unknown): AIProvider {
    throw new Error("Direct provider access is disabled. All AI execution must use AIOrchestrator.");
  }
}
