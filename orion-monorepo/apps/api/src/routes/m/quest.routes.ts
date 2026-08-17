import { Router, type Request, type Response, type NextFunction } from "express";
import { ApiError } from "../../middleware/error.js";
import { getProfile, awardXp, updateQuestProgress } from "../../modules/quest.service.js";

export const questRouter: Router = Router();

/** GET /v1/m/quest/profile */
questRouter.get("/profile", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const profile = await getProfile(req.user.id);
    res.json({ ok: true, data: profile });
  } catch (err) { next(err); }
});

/** POST /v1/m/quest/award — interno, chamado por outros serviços
 *  body: { action, xp, module? } */
questRouter.post("/award", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { action, xp, module: mod } = req.body as { action: string; xp: number; module?: string };
    if (!action || typeof xp !== "number") throw new ApiError(400, "INVALID", "action e xp obrigatórios.");
    const result = await awardXp(req.user.id, action, xp, mod);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

/** POST /v1/m/quest/progress — atualiza progresso de uma quest ativa
 *  body: { questId, increment? } */
questRouter.post("/progress", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { questId, increment = 1 } = req.body as { questId: string; increment?: number };
    if (!questId) throw new ApiError(400, "INVALID", "questId obrigatório.");
    await updateQuestProgress(req.user.id, questId, increment);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
