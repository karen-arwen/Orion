import { Router, type Request, type Response, type NextFunction } from "express";
import { ApiError } from "../../middleware/error.js";
import { getTwinProfile, updateTwinProfile, analyzeTwinPatterns } from "../../modules/digital-twin.service.js";

export const twinRouter: Router = Router();

/** GET /v1/m/twin — perfil do Digital Twin */
twinRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const profile = await getTwinProfile(req.user.id);
    res.json({ ok: true, data: profile });
  } catch (err) { next(err); }
});

/** PATCH /v1/m/twin — atualizar perfil */
twinRouter.patch("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const profile = await updateTwinProfile(req.user.id, req.body);
    res.json({ ok: true, data: profile });
  } catch (err) { next(err); }
});

/** POST /v1/m/twin/analyze — rodar análise de padrões */
twinRouter.post("/analyze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const result = await analyzeTwinPatterns(req.user.id);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});
