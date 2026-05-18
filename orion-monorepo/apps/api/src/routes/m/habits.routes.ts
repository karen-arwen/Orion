import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  createHabit,
  deleteHabit,
  listHabits,
  toggleToday,
} from "../../modules/habits.service.js";

export const habitsRouter: Router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(80),
  frequency: z.string().max(40).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(8).optional(),
});

/** GET /v1/m/habits */
habitsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await listHabits(req.user.id);
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/m/habits */
habitsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const input = createSchema.parse(req.body);
    const result = await createHabit(req.user.id, input);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/m/habits/:id/toggle — marca/desmarca hoje */
habitsRouter.post("/:id/toggle", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const result = await toggleToday(req.user.id, id);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** DELETE /v1/m/habits/:id */
habitsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    await deleteHabit(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});
