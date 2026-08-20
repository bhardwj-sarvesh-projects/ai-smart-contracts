import { Router, Request, Response } from "express";
import { requireAuthenticatedUser } from "../services/SupabaseAdminAuth";
import { AI_TEMPERATURE, GLOBAL_MAX_OUTPUT_TOKENS, getPublicPolicy } from "../config/aiPolicy";

const router = Router();

export interface AuthenticatedRequest extends Request {
  user?: any;
  supabaseUser?: any;
}

/** User settings are now informational. AI credentials/models are platform managed. */
router.get("/", requireAuthenticatedUser, (req: AuthenticatedRequest, res: Response) => {
  const u = req.user || req.supabaseUser;
  res.json({
    userId: u?.id || u?.uid || "",
    email: u?.email || "",
    displayName: u?.name || u?.email?.split("@")[0] || "",
    provider: "groq",
    apiKey: "",
    defaultModel: "Intelligent Router",
    temperature: AI_TEMPERATURE,
    maxTokens: GLOBAL_MAX_OUTPUT_TOKENS,
    aiManagedByPlatform: true,
  });
});

router.post("/", requireAuthenticatedUser, (_req: AuthenticatedRequest, res: Response) => {
  res.status(403).json({
    success: false,
    error: "AI configuration is platform-managed. Users cannot change provider, model, API credentials, temperature, or token limits.",
  });
});

router.post("/models", requireAuthenticatedUser, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, source: "platform-policy", models: [], policy: getPublicPolicy() });
});

router.post("/test", requireAuthenticatedUser, (_req: AuthenticatedRequest, res: Response) => {
  res.status(403).json({ success: false, connected: false, error: "Individual user AI credentials are not supported. AI infrastructure is managed by the platform." });
});

export default router;
