import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { planTrip } from "../../modules/travel.service.js";

export const travelRouter: Router = Router();

const planSchema = z.object({
  destination: z.string().min(2).max(120),
  origin: z.string().max(120).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  days: z.number().int().min(1).max(30),
  budget: z.enum(["baixo", "medio", "alto"]),
  pace: z.enum(["leve", "equilibrado", "intenso"]),
  interests: z.array(z.string().min(1).max(40)).max(12),
  constraints: z.string().max(1000).optional(),
});

travelRouter.post("/plan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    res.json({ ok: true, data: await planTrip(req.user.id, planSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});
