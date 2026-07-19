import { AIProvider } from "./AIProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { GroqProvider } from "./GroqProvider";
import { GeminiProvider } from "./GeminiProvider";
import { UserConfig } from "../services/SettingsService";

export class ProviderFactory {
  static getProvider(settings: UserConfig): AIProvider {
    const providerType = settings.provider || "openai";

    const config = {
      apiKey: settings.apiKey,
      model: settings.defaultModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    };

    switch (providerType) {
      case "openai":
        return new OpenAIProvider(config);
      case "groq":
        return new GroqProvider(config);
      case "gemini":
        return new GeminiProvider(config);
      default:
        console.warn(`[ProviderFactory] Unknown provider "${providerType}". Falling back to OpenAIProvider.`);
        return new OpenAIProvider(config);
    }
  }
}
