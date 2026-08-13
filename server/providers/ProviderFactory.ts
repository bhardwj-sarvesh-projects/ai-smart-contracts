import { AIProvider } from "./AIProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { GroqProvider } from "./GroqProvider";
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

  return false;
}

export class ProviderFactory {
  static getProvider(settings: UserConfig): AIProvider {
    const providerType = (settings.provider || "openai").toLowerCase() as "openai" | "groq";
    let apiKey = settings.apiKey;
    let model = settings.defaultModel;

    const envOpenAIKey = process.env.OPENAI_API_KEY && !isDummyOrEmptyKey(process.env.OPENAI_API_KEY, "openai") ? process.env.OPENAI_API_KEY : "";
    const envGroqKey = process.env.GROQ_API_KEY && !isDummyOrEmptyKey(process.env.GROQ_API_KEY, "groq") ? process.env.GROQ_API_KEY : "";

    // Resolve key for the requested provider strictly without cross-provider fallback
    if (providerType === "groq") {
      if (isDummyOrEmptyKey(apiKey, "groq") && envGroqKey) {
        apiKey = envGroqKey;
      }
      model = model || "llama-3.3-70b-versatile";
    } else {
      if (isDummyOrEmptyKey(apiKey, "openai") && envOpenAIKey) {
        apiKey = envOpenAIKey;
      }
      model = model || "gpt-4o-mini";
    }

    const config = {
      apiKey: apiKey || "",
      model: model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    };

    switch (providerType) {
      case "groq":
        return new GroqProvider(config);
      case "openai":
      default:
        return new OpenAIProvider(config);
    }
  }
}
