import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  completeSession,
  interruptSession,
  listToday,
  startSession,
  weeklyStats,
} from "../../modules/focus.service.js";

export const focusRouter: Router = Router();

const startSchema = z.object({
  duration: z.number().int().min(5).max(180).default(25),
  note: z.string().max(200).optional(),
});

/** POST /v1/m/focus/start — inicia sessão */
focusRouter.post("/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { duration, note } = startSchema.parse(req.body);
    const result = await startSession(req.user.id, duration, note);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/m/focus/:id/complete — marca completa */
focusRouter.post("/:id/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const result = await completeSession(req.user.id, id);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/m/focus/:id/interrupt — marca interrompida */
focusRouter.post("/:id/interrupt", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const result = await interruptSession(req.user.id, id);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/focus/today */
focusRouter.get("/today", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await listToday(req.user.id);
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/focus/weekly */
focusRouter.get("/weekly", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const stats = await weeklyStats(req.user.id);
    res.json({ ok: true, data: stats });
  } catch (err) {
    next(err);
  }
});
