import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  completeFocusSession,
  createFocusSession,
  getFocusSummary,
  interruptFocusSession,
} from "../../modules/focus.service.js";

export const focusRouter: Router = Router();

const startSchema = z.object({
  duration: z.number().int().min(5).max(240),
  breakMinutes: z.number().int().min(1).max(60).optional(),
});

focusRouter.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const summary = await getFocusSummary(req.user.id);
    res.json({ ok: true, data: summary });
  } catch (err) {
    next(err);
  }
});

focusRouter.post("/sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = startSchema.parse(req.body);
    const session = await createFocusSession(req.user.id, body);
    res.json({ ok: true, data: session });
  } catch (err) {
    next(err);
  }
});

focusRouter.patch("/sessions/:id/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    const session = await completeFocusSession(req.user.id, id);
    res.json({ ok: true, data: session });
  } catch (err) {
    next(err);
  }
});

focusRouter.patch("/sessions/:id/interrupt", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    const session = await interruptFocusSession(req.user.id, id);
    res.json({ ok: true, data: session });
  } catch (err) {
    next(err);
  }
});
