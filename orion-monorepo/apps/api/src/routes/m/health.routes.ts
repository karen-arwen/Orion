import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  detectLowEnergyHour,
  getEnergyDay,
  getWeekHeatmap,
  logEnergy,
} from "../../modules/health.service.js";

export const healthRouter: Router = Router();

const logSchema = z.object({
  value: z.number().int().min(1).max(10),
  note: z.string().max(200).optional(),
});

/** POST /v1/m/health/energy — registra ponto */
healthRouter.post("/energy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { value, note } = logSchema.parse(req.body);
    const result = await logEnergy(req.user.id, value, note);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/health/today — pontos de hoje */
healthRouter.get("/today", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await getEnergyDay(req.user.id);
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/health/heatmap — heatmap dos últimos 7 dias */
healthRouter.get("/heatmap", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const cells = await getWeekHeatmap(req.user.id);
    const lowHour = await detectLowEnergyHour(req.user.id);
    res.json({ ok: true, data: { cells, lowEnergyHour: lowHour } });
  } catch (err) {
    next(err);
  }
});
