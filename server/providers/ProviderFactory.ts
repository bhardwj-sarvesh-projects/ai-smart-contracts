import { AIProvider } from "./AIProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { GroqProvider } from "./GroqProvider";
import { GeminiProvider } from "./GeminiProvider";
import { UserConfig } from "../services/SettingsService";

function isDummyOrEmptyKey(key: string, provider: string): boolean {
  if (!key || key.trim() === "") return true;
  if (provider === "openai" && (key.startsWith("sk-proj-_sQ6zTAKKrk31kui") || key.includes("••••••••"))) return true;
  if (provider === "groq" && (key.startsWith("gsk_qzxitXkT") || key.includes("••••••••"))) return true;
  return false;
}

export class ProviderFactory {
  static getProvider(settings: UserConfig): AIProvider {
    let providerType = settings.provider || (process.env.GEMINI_API_KEY ? "gemini" : "openai");
    let apiKey = settings.apiKey;
    let model = settings.defaultModel;

    // Check if the chosen provider has a missing or dummy key
    if (providerType !== "gemini" && isDummyOrEmptyKey(apiKey, providerType)) {
      if (process.env.GEMINI_API_KEY) {
        console.warn(`[ProviderFactory] API key for "${providerType}" is missing or a default placeholder. Falling back to Gemini.`);
        providerType = "gemini";
        apiKey = process.env.GEMINI_API_KEY;
        model = "gemini-3.5-flash";
      }
    }

    // Double check: if provider is gemini and there's no settings.apiKey, use process.env.GEMINI_API_KEY
    if (providerType === "gemini" && (!apiKey || apiKey.trim() === "" || apiKey === "••••••••")) {
      apiKey = process.env.GEMINI_API_KEY || "";
      if (!model || model.trim() === "") {
        model = "gemini-3.5-flash";
      }
    }

    const config = {
      apiKey: apiKey,
      model: model,
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
        console.warn(`[ProviderFactory] Unknown provider "${providerType}". Falling back to GeminiProvider.`);
        return new GeminiProvider({
          apiKey: process.env.GEMINI_API_KEY || "",
          model: "gemini-3.5-flash",
          temperature: settings.temperature,
          maxTokens: settings.maxTokens
        });
    }
  }
}
