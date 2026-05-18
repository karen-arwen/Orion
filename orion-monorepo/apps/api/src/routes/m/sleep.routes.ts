import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { logSleep, recentLogs, stats } from "../../modules/sleep.service.js";

export const sleepRouter: Router = Router();

const logSchema = z.object({
  bedTime: z.string().datetime(),
  wakeTime: z.string().datetime(),
  quality: z.number().int().min(1).max(5),
  notes: z.string().max(500).optional(),
});

sleepRouter.post("/log", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = logSchema.parse(req.body);
    res.json({ ok: true, data: await logSleep({ userId: req.user.id, ...body }) });
  } catch (err) {
    next(err);
  }
});

sleepRouter.get("/recent", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    res.json({ ok: true, data: await recentLogs(req.user.id, 14) });
  } catch (err) {
    next(err);
  }
});

sleepRouter.get("/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    res.json({ ok: true, data: await stats(req.user.id) });
  } catch (err) {
    next(err);
  }
});
