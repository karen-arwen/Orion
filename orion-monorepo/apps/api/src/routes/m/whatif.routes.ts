import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { simulateScenario } from "../../modules/whatif.service.js";

export const whatIfRouter: Router = Router();

const scenarioSchema = z.object({
  question: z.string().min(4).max(1200),
  horizon: z.enum(["7d", "30d", "90d", "1y"]),
  constraints: z.string().max(1200).optional(),
});

whatIfRouter.post("/scenario", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const data = await simulateScenario(req.user.id, scenarioSchema.parse(req.body));
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});
