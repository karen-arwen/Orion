import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { createHabit, deleteHabit, getHabitSummary, toggleHabitLog } from "../../modules/habits.service.js";

export const habitsRouter: Router = Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  frequency: z.string().trim().min(1).max(80).default("daily"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().trim().min(1).max(4).optional(),
});

const toggleSchema = z.object({
  date: z.string().datetime().optional(),
});

habitsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await getHabitSummary(req.user.id) });
  } catch (err) {
    next(err);
  }
});

habitsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = createSchema.parse(req.body);
    res.json({ ok: true, data: await createHabit(req.user.id, body) });
  } catch (err) {
    next(err);
  }
});

habitsRouter.post("/:id/toggle", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    const body = toggleSchema.parse(req.body);
    res.json({ ok: true, data: await toggleHabitLog(req.user.id, id, body.date) });
  } catch (err) {
    next(err);
  }
});

habitsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    res.json({ ok: true, data: await deleteHabit(req.user.id, id) });
  } catch (err) {
    next(err);
  }
});
