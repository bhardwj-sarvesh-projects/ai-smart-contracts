import { AISettings } from "../types/AISettings";

export class SettingsService {
  private static settings: AISettings = {
    provider: "groq",
    apiKey: "",
    model: "",
    temperature: 0.7,
    maxTokens: 8192,
    stream: false,
  };

  static get(): AISettings {
    return this.settings;
  }

  static save(settings: AISettings): void {
    this.settings = settings;
  }
}