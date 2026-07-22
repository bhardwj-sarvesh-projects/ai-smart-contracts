import { AIProvider } from "./AIProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { GroqProvider } from "./GroqProvider";
import { GeminiProvider } from "./GeminiProvider";
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

  if (provider === "gemini") {
    if (k.startsWith("sk-") || k.startsWith("gsk_")) return true;
  }

  return false;
}

export class ProviderFactory {
  static getProvider(settings: UserConfig): AIProvider {
    let providerType = settings.provider || "gemini";
    let apiKey = settings.apiKey;
    let model = settings.defaultModel;

    const envGeminiKey = process.env.GEMINI_API_KEY && !isDummyOrEmptyKey(process.env.GEMINI_API_KEY, "gemini") ? process.env.GEMINI_API_KEY : "";
    const envOpenAIKey = process.env.OPENAI_API_KEY && !isDummyOrEmptyKey(process.env.OPENAI_API_KEY, "openai") ? process.env.OPENAI_API_KEY : "";

    // Check if the chosen provider has a missing or dummy key
    if (isDummyOrEmptyKey(apiKey, providerType)) {
      console.warn(`[ProviderFactory] API key for "${providerType}" is missing or placeholder. Finding working server-side provider.`);
      
      // Priority 1: Gemini (since Google AI Studio provides valid GEMINI_API_KEY)
      if (envGeminiKey) {
        providerType = "gemini";
        apiKey = envGeminiKey;
        model = "gemini-3.5-flash";
      }
      // Priority 2: OpenAI (if valid non-dummy key exists in env)
      else if (envOpenAIKey) {
        providerType = "openai";
        apiKey = envOpenAIKey;
        model = model && model.startsWith("gpt") ? model : "gpt-4o-mini";
      }
    }

    // Double check: if chosen is openai but key is dummy/invalid, switch to Gemini if available
    if (providerType === "openai" && isDummyOrEmptyKey(apiKey, "openai")) {
      if (envGeminiKey) {
        console.warn(`[ProviderFactory] OpenAI key is dummy/invalid ("${apiKey.slice(0, 10)}..."). Switching to Gemini.`);
        providerType = "gemini";
        apiKey = envGeminiKey;
        model = "gemini-3.5-flash";
      }
    }

    // Double check: if chosen is gemini but no key available, fallback to openai if valid
    if (providerType === "gemini" && isDummyOrEmptyKey(apiKey, "gemini")) {
      if (envGeminiKey) {
        apiKey = envGeminiKey;
      } else if (envOpenAIKey) {
        console.warn(`[ProviderFactory] Gemini selected but no key. Falling back to OpenAI.`);
        providerType = "openai";
        apiKey = envOpenAIKey;
        model = "gpt-4o-mini";
      }
    }

    const config = {
      apiKey: apiKey,
      model: model || (providerType === "gemini" ? "gemini-3.5-flash" : "gpt-4o-mini"),
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
          apiKey: envGeminiKey || process.env.GEMINI_API_KEY || "",
          model: "gemini-3.5-flash",
          temperature: settings.temperature,
          maxTokens: settings.maxTokens
        });
    }
  }
}
