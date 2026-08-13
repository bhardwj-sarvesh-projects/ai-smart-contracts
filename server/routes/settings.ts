import { Router, Request, Response, NextFunction } from "express";
import { SettingsService, UserConfig } from "../services/SettingsService";
import { ProviderFactory } from "../providers/ProviderFactory";
import OpenAI from "openai";

const router = Router();

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.headers["x-user-id"] as string;
  const email = req.headers["x-user-email"] as string;
  const displayName = req.headers["x-user-name"] as string;
  const photoURL = req.headers["x-user-photo"] as string;

  if (!userId || !email) {
    return res.status(401).json({ error: "Unauthorized. Missing user authentication headers." });
  }

  req.user = {
    uid: userId,
    email,
    displayName,
    photoURL,
  };

  next();
}

/**
 * GET current saved AI settings for user
 */
router.get("/", authMiddleware, (req: AuthenticatedRequest, res) => {
  const user = SettingsService.get(req.user!.uid);
  if (!user) {
    // Default config if none saved yet
    return res.json({
      userId: req.user!.uid,
      email: req.user!.email,
      displayName: req.user!.displayName || "",
      photo: req.user!.photoURL || "",
      provider: "openai",
      apiKey: "",
      defaultModel: "gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 2000,
    });
  }

  // Mask API key before sending to UI
  res.json({
    ...user,
    apiKey: user.apiKey ? "••••••••" : "",
  });
});

/**
 * SAVE AI settings
 */
router.post("/", authMiddleware, (req: AuthenticatedRequest, res) => {
  const settings = req.body;
  const saved = SettingsService.save(req.user!.uid, {
    ...settings,
    email: req.user!.email,
    displayName: req.user!.displayName,
    photo: req.user!.photoURL,
  });

  res.json({
    success: true,
    message: "Settings saved successfully.",
    settings: {
      ...saved,
      apiKey: saved.apiKey ? "••••••••" : "",
    },
  });
});

/**
 * FETCH models dynamically from provider
 */
router.post("/models", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { provider, apiKey } = req.body;
    let resolvedKey = apiKey;

    if (!resolvedKey || resolvedKey === "••••••••" || resolvedKey.includes("••")) {
      const savedUser = SettingsService.getDecrypted(req.user!.uid);
      if (savedUser && savedUser.provider === provider) {
        resolvedKey = savedUser.apiKey;
      } else {
        resolvedKey = "";
      }
    }

    if (!resolvedKey) {
      // Return default fallback models list if API key is not provided yet for this provider
      const fallbackList = getFallbackModels(provider);
      return res.json({
        success: true,
        source: "local-fallback",
        models: fallbackList
      });
    }

    // Check key format compatibility before making outbound API calls
    const isGroqKey = resolvedKey.startsWith("gsk_");
    const isOpenAIKey = resolvedKey.startsWith("sk-");

    if ((provider === "openai" && isGroqKey) || (provider === "groq" && isOpenAIKey)) {
      return res.json({
        success: true,
        source: "local-fallback",
        models: getFallbackModels(provider)
      });
    }

    try {
      let modelsList: string[] = [];
      if (provider === "openai") {
        const client = new OpenAI({ apiKey: resolvedKey, timeout: 5000 });
        const list = await client.models.list();
        modelsList = list.data
          .filter(m => m.id.startsWith("gpt-") || m.id.startsWith("o1-") || m.id.startsWith("o3-"))
          .map(m => m.id)
          .sort();
      } else if (provider === "groq") {
        const client = new OpenAI({ apiKey: resolvedKey, baseURL: "https://api.groq.com/openai/v1", timeout: 5000 });
        const list = await client.models.list();
        modelsList = list.data
          .map(m => m.id)
          .sort();
      } else {
        modelsList = getFallbackModels(provider);
      }

      if (modelsList.length === 0) {
        modelsList = getFallbackModels(provider);
      }

      return res.json({
        success: true,
        source: "provider-api",
        models: modelsList
      });
    } catch (apiErr: any) {
      console.warn(`[SETTINGS ROUTE] Failed to list models from ${provider} API, using curated fallback:`, apiErr.message);
      return res.json({
        success: true,
        source: "local-fallback",
        models: getFallbackModels(provider)
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || String(err)
    });
  }
});

/**
 * TEST Connection
 */
router.post("/test", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const testSettings = req.body;
    let apiKey = testSettings.apiKey;

    if (!apiKey || apiKey === "••••••••" || apiKey.includes("••")) {
      const savedUser = SettingsService.getDecrypted(req.user!.uid);
      if (savedUser && savedUser.provider === testSettings.provider) {
        apiKey = savedUser.apiKey;
      } else {
        apiKey = "";
      }
    }

    if (!apiKey) {
      return res.json({
        success: false,
        connected: false,
        error: "An API key is required to test the connection."
      });
    }

    const tempUserConfig: UserConfig = {
      userId: req.user!.uid,
      email: req.user!.email,
      displayName: req.user!.displayName || "",
      photo: req.user!.photoURL || "",
      provider: testSettings.provider,
      apiKey: apiKey,
      defaultModel: testSettings.defaultModel || testSettings.model,
      temperature: testSettings.temperature ?? 0.2,
      maxTokens: testSettings.maxTokens ?? 2000,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };

    const startTime = Date.now();
    const providerInstance = ProviderFactory.getProvider(tempUserConfig);
    const health = await providerInstance.healthCheck();

    if (health.success) {
      return res.json({
        success: true,
        connected: true,
        model: health.modelUsed,
        latency: health.latencyMs || (Date.now() - startTime),
        message: "Connection verified successfully!"
      });
    } else {
      return res.json({
        success: false,
        connected: false,
        error: health.error || "Failed to verify connection."
      });
    }
  } catch (err: any) {
    return res.json({
      success: false,
      connected: false,
      error: err.message || String(err)
    });
  }
});

function getFallbackModels(provider: string): string[] {
  switch (provider) {
    case "openai":
      return ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o1-mini", "o3-mini"];
    case "groq":
      return ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"];
    case "anthropic":
      return ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"];
    default:
      return ["gpt-4o-mini"];
  }
}

export default router;
