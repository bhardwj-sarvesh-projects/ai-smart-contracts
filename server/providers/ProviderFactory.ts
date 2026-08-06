import { AIProvider } from "./AIProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { GroqProvider } from "./GroqProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";
import { UserConfig } from "../services/SettingsService";

export function isDummyOrEmptyKey(key: string, provider: string): boolean {
  if (!key || key.trim() === "" || key.includes("••••••••") || key.includes("••")) return true;
  const k = key.trim();
  if (k.includes("MY_API_KEY") || k.includes("YOUR_API_KEY") || k.includes("placeholder")) return true;
  
  if (provider === "openai" || k.startsWith("sk-")) {
    if (k.startsWith("gsk_")) return true; // Groq key passed to OpenAI
    if (k.startsWith("sk-proj-_sQ6zTAKKrk31kui") || k.startsWith("sk-svcac") || k.startsWith("sk-svc") || k.startsWith("sk-dummy") || k.includes("svcac")) return true;
    if (k.length < 20) return true;
  }
  
  if (provider === "groq") {
    if (k.startsWith("sk-")) return true; // OpenAI key passed to Groq
    if (k.startsWith("gsk_qzxitXkT")) return true;
    if (k.length < 15) return true;
  }

  if (provider === "openrouter") {
    if (k.startsWith("gsk_")) return true;
  }

  return false;
}

export class ProviderFactory {
  static getProvider(settings: UserConfig): AIProvider {
    let providerType = settings.provider || "openrouter";
    let apiKey = settings.apiKey;
    let model = settings.defaultModel;

    const envOpenRouterKey = process.env.OPENROUTER_API_KEY && !isDummyOrEmptyKey(process.env.OPENROUTER_API_KEY, "openrouter") ? process.env.OPENROUTER_API_KEY : "";
    const envOpenAIKey = process.env.OPENAI_API_KEY && !isDummyOrEmptyKey(process.env.OPENAI_API_KEY, "openai") ? process.env.OPENAI_API_KEY : "";

    // Check if the chosen provider has a missing or dummy key
    if (isDummyOrEmptyKey(apiKey, providerType)) {
      console.warn(`[ProviderFactory] API key for "${providerType}" is missing or placeholder. Finding working server-side provider.`);
      
      // Priority 1: OpenRouter (since Google AI Studio / user config provides OpenRouter fallback)
      if (envOpenRouterKey) {
        providerType = "openrouter";
        apiKey = envOpenRouterKey;
        model = "google/gemini-2.5-pro";
      }
      // Priority 2: OpenAI (if valid non-dummy key exists in env)
      else if (envOpenAIKey) {
        providerType = "openai";
        apiKey = envOpenAIKey;
        model = model && model.startsWith("gpt") ? model : "gpt-4o-mini";
      }
    }

    // Double check: if chosen is openai but key is dummy/invalid, switch to OpenRouter if available
    if (providerType === "openai" && isDummyOrEmptyKey(apiKey, "openai")) {
      if (envOpenRouterKey) {
        console.warn(`[ProviderFactory] OpenAI key is dummy/invalid ("${apiKey.slice(0, 10)}..."). Switching to OpenRouter.`);
        providerType = "openrouter";
        apiKey = envOpenRouterKey;
        model = "google/gemini-2.5-pro";
      }
    }

    // Double check: if chosen is openrouter but no key available, fallback to openai if valid
    if (providerType === "openrouter" && isDummyOrEmptyKey(apiKey, "openrouter")) {
      if (envOpenRouterKey) {
        apiKey = envOpenRouterKey;
      } else if (envOpenAIKey) {
        console.warn(`[ProviderFactory] OpenRouter selected but no key. Falling back to OpenAI.`);
        providerType = "openai";
        apiKey = envOpenAIKey;
        model = "gpt-4o-mini";
      }
    }

    const config = {
      apiKey: apiKey,
      model: model || (providerType === "openrouter" ? "google/gemini-2.5-pro" : "gpt-4o-mini"),
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    };

    switch (providerType) {
      case "openai":
        return new OpenAIProvider(config);
      case "groq":
        return new GroqProvider(config);
      case "openrouter":
        return new OpenRouterProvider(config);
      default:
        console.warn(`[ProviderFactory] Unknown provider "${providerType}". Falling back to OpenRouterProvider.`);
        return new OpenRouterProvider({
          apiKey: envOpenRouterKey || process.env.OPENROUTER_API_KEY || "",
          model: "google/gemini-2.5-pro",
          temperature: settings.temperature,
          maxTokens: settings.maxTokens
        });
    }
  }
}
