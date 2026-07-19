import { Router } from "express";
import { SettingsService } from "../services/SettingsService";
import { AISettings } from "../types/AISettings";

const router = Router();

/**
 * GET current AI settings
 */
router.get("/", (_req, res) => {
  res.json(SettingsService.get());
});

/**
 * SAVE AI settings
 */
router.post("/", (req, res) => {
  const settings = req.body as AISettings;

  SettingsService.save(settings);

  res.json({
    success: true,
    message: "Settings saved successfully.",
  });
});

export default router;