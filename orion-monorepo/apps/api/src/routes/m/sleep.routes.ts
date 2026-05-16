import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { createSleepLog, deleteSleepLog, getSleepSummary, importSleepSamples } from "../../modules/sleep.service.js";

export const sleepRouter: Router = Router();

const createSchema = z.object({
  bedTime: z.string().datetime(),
  wakeTime: z.string().datetime(),
  quality: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(500).optional(),
});

const importSchema = z.object({
  samples: z.array(
    z.object({
      provider: z.enum(["apple_health", "samsung_health", "health_connect", "manual_import"]),
      externalId: z.string().min(1).max(180),
      bedTime: z.string().datetime(),
      wakeTime: z.string().datetime(),
      quality: z.number().int().min(1).max(5).optional(),
      notes: z.string().max(500).optional(),
      deviceName: z.string().max(120).optional(),
    }),
  ).max(100),
});

sleepRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await getSleepSummary(req.user.id) });
  } catch (err) {
    next(err);
  }
});

sleepRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = createSchema.parse(req.body);
    res.json({ ok: true, data: await createSleepLog(req.user.id, body) });
  } catch (err) {
    next(err);
  }
});

sleepRouter.post("/import", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = importSchema.parse(req.body);
    res.json({ ok: true, data: await importSleepSamples(req.user.id, body.samples) });
  } catch (err) {
    next(err);
  }
});

sleepRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    res.json({ ok: true, data: await deleteSleepLog(req.user.id, id) });
  } catch (err) {
    next(err);
  }
});
