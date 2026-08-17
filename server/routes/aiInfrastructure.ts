import { Router } from "express";
import { AICredentialService } from "../services/AICredentialService";
import { requireAdminUser } from "../services/FirebaseAdminAuth";
import { AI_TEMPERATURE, GLOBAL_MAX_OUTPUT_TOKENS, getPublicPolicy } from "../config/aiPolicy";

const router = Router();
router.use(requireAdminUser);

router.get("/credentials", async (_req, res) => {
  try { res.json({ success: true, credentials: await AICredentialService.list() }); }
  catch (error: any) { res.status(500).json({ success: false, error: error.message || String(error) }); }
});

router.post("/credentials", async (req, res) => {
  try {
    const { displayName, apiKey } = req.body || {};
    const credential = await AICredentialService.add(displayName, apiKey);
    res.status(201).json({ success: true, credential });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || String(error) });
  }
});

router.patch("/credentials/:id", async (req, res) => {
  try {
    const allowed = {
      enabled: typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined,
      priority: Number.isFinite(req.body?.priority) ? Math.max(1, Math.floor(req.body.priority)) : undefined,
      displayName: typeof req.body?.displayName === "string" ? req.body.displayName.trim() : undefined,
    };
    const clean = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
    const credential = await AICredentialService.update(req.params.id, clean as any);
    res.json({ success: true, credential });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message || String(error) }); }
});

router.delete("/credentials/:id", async (req, res) => {
  try { await AICredentialService.remove(req.params.id); res.json({ success: true }); }
  catch (error: any) { res.status(400).json({ success: false, error: error.message || String(error) }); }
});

router.post("/credentials/:id/test", async (req, res) => {
  try { res.json(await AICredentialService.test(req.params.id)); }
  catch (error: any) { res.status(400).json({ success: false, error: error.message || String(error) }); }
});

router.get("/policy", (_req, res) => {
  res.json({
    success: true,
    temperature: AI_TEMPERATURE,
    globalMaxOutputTokens: GLOBAL_MAX_OUTPUT_TOKENS,
    editable: false,
    policy: getPublicPolicy(),
  });
});

export default router;
