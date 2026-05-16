import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { createEnergyLog, getEnergySummary } from "../../modules/health.service.js";

export const healthRouter: Router = Router();

const logSchema = z.object({
  value: z.number().int().min(1).max(10),
  note: z.string().max(500).optional(),
  createdAt: z.string().datetime().optional(),
});

healthRouter.get("/energy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const summary = await getEnergySummary(req.user.id, "America/Sao_Paulo");
    res.json({ ok: true, data: summary });
  } catch (err) {
    next(err);
  }
});

healthRouter.post("/energy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = logSchema.parse(req.body);
    const log = await createEnergyLog(req.user.id, body);
    res.json({ ok: true, data: log });
  } catch (err) {
    next(err);
  }
});
