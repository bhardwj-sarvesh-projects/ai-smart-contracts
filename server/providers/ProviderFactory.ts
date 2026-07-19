import { OpenAIProvider } from "./OpenAIProvider";
// import { GroqProvider } from "./GroqProvider";

export class ProviderFactory {
  static getProvider() {
    // Temporary
    return new OpenAIProvider();
  }
}