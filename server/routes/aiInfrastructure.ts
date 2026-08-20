import { Router } from "express";
import { AICredentialService } from "../services/AICredentialService";
import { getSupabaseAuthDiagnostics, requireAdminUser } from "../services/SupabaseAdminAuth";
import {
  AI_TEMPERATURE,
  AI_DEFAULT_MAX_OUTPUT_TOKENS,
  GLOBAL_MAX_OUTPUT_TOKENS,
  getPublicPolicy,
  getPublicRoutingGroups
} from "../config/aiPolicy";
import { safeErrorMessage } from "../utils/secretRedaction";

const router = Router();

router.use((_req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

router.use(requireAdminUser);

// Single fast admin bootstrap endpoint. The UI should use this instead of
// making three parallel authenticated requests during every mount/reload.
router.get("/policy", (_req, res) => {
  return res.json({
    success: true,
    temperature: AI_TEMPERATURE,
    defaultMaxOutputTokens: AI_DEFAULT_MAX_OUTPUT_TOKENS,
    globalMaxOutputTokens: GLOBAL_MAX_OUTPUT_TOKENS,
    editable: false,
    policy: getPublicPolicy(),
    routingGroups: getPublicRoutingGroups(),
  });
});

router.get("/overview", async (_req, res) => {
  try {
    const credentials = await AICredentialService.list(Boolean((_req as any).query?.refresh));
    return res.json({
      success: true,
      storage: AICredentialService.getStorageMode(),
      storageDiagnostics: AICredentialService.getStorageDiagnostics(),
      credentials,
      policy: {
        success: true,
        temperature: AI_TEMPERATURE,
        globalMaxOutputTokens: GLOBAL_MAX_OUTPUT_TOKENS,
        editable: false,
        policy: getPublicPolicy(),
        routingGroups: getPublicRoutingGroups(),
      },
      diagnostics: getSupabaseAuthDiagnostics(),
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

function sendError(res: any, error: any) {
  const explicit = Number(error?.statusCode ?? error?.status);
  const status = [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504].includes(explicit)
    ? explicit
    : String(error?.code || "").startsWith("AI_CREDENTIAL_") || String(error?.code || "").startsWith("SUPABASE_")
      ? 503
      : 500;
  const message = safeErrorMessage(error) || "AI infrastructure request failed.";
  return res.status(status).json({
    success: false,
    code: error?.code || "AI_INFRASTRUCTURE_ERROR",
    error: message,
    details: {
      status,
      provider: "groq",
      operation: "ai-infrastructure",
    },
  });
}

router.get("/credentials", async (_req, res) => {
  try {
    const credentials = await AICredentialService.list();
    return res.json({
      success: true,
      storage: AICredentialService.getStorageMode(),
      storageDiagnostics: AICredentialService.getStorageDiagnostics(),
      credentials,
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.post("/credentials", async (req, res) => {
  try {
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName : "";
    const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey : "";
    // Provider, model, and endpoint are platform-controlled. The Admin Panel
    // only provisions Groq API keys; the server-side policy selects models per task.
    const credential = await AICredentialService.add(displayName, apiKey);
    return res.status(201).json({
      success: true,
      storage: AICredentialService.getStorageMode(),
      storageDiagnostics: AICredentialService.getStorageDiagnostics(),
      credential,
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.post("/storage/retry", async (_req, res) => {
  try {
    const diagnostics = await AICredentialService.retrySupabaseConnection();
    return res.json({
      success: true,
      storage: AICredentialService.getStorageMode(),
      storageDiagnostics: diagnostics,
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.get("/credentials/:id", async (req, res) => {
  try {
    const credential = await AICredentialService.verifyPersisted(req.params.id);
    return res.json({ success: true, storage: AICredentialService.getStorageMode(), credential });
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.patch("/credentials/:id", async (req, res) => {
  try {
    // Only operational metadata is mutable from the Admin Panel. Provider/model/
    // endpoint changes are intentionally ignored/rejected by the service boundary.
    const credential = await AICredentialService.update(req.params.id, req.body || {});
    return res.json({ success: true, storage: AICredentialService.getStorageMode(), credential });
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.delete("/credentials/:id", async (req, res) => {
  try {
    await AICredentialService.remove(req.params.id);
    return res.json({ success: true, storage: AICredentialService.getStorageMode(), removedId: req.params.id });
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.post("/credentials/:id/test", async (req, res) => {
  try {
    const result = await AICredentialService.test(req.params.id);
    return res.json({ success: Boolean(result.success), result });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
