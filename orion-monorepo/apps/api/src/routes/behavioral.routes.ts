import { Router, type Request, type Response, type NextFunction } from "express";
import { analyzeBehavioralProfile, getBehavioralProfile } from "../modules/behavioral-profile.service.js";

import { aiHeavyRateLimit } from "../middleware/rate-limit.js";

export const behavioralRouter = Router();

// GET /v1/behavioral/profile — retorna o perfil atual (salvo nas preferences)
behavioralRouter.get("/profile", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) { res.status(401).json({ ok: false }); return; }
    const profile = await getBehavioralProfile(req.user.id);
    res.json({ ok: true, data: profile });
  } catch (err) { next(err); }
});

// POST /v1/behavioral/analyze — dispara análise do histórico de conversas
behavioralRouter.post("/analyze", aiHeavyRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) { res.status(401).json({ ok: false }); return; }
    const result = await analyzeBehavioralProfile(req.user.id);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});
