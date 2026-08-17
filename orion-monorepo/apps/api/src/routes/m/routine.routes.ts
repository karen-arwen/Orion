import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  listRoutines, getRoutine, createRoutine, updateRoutine, deleteRoutine,
  startRoutine, completeStep, getTodayLog, getRoutineHistory, generateNudge,
} from "../../modules/routine.service.js";

export const routineRouter: Router = Router();

const stepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["task", "checkin", "timer", "note", "habit"]),
  durationMin: z.number().optional(),
  habitId: z.string().optional(),
  note: z.string().optional(),
});

const routineSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().min(1),
  description: z.string().optional(),
  frequency: z.enum(["daily", "weekdays", "weekends", "custom"]),
  customDays: z.array(z.number().min(0).max(6)).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  steps: z.array(stepSchema).min(1).max(20),
  active: z.boolean().default(true),
  totalXp: z.number().default(0),
});

/** GET /v1/m/routines */
routineRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const routines = await listRoutines(req.user.id);
    res.json({ ok: true, data: routines });
  } catch (err) { next(err); }
});

/** GET /v1/m/routines/:id */
routineRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const r = await getRoutine(req.user.id, req.params.id!);
    if (!r) throw new ApiError(404, "NOT_FOUND", "Rotina nao encontrada.");
    res.json({ ok: true, data: r });
  } catch (err) { next(err); }
});

/** POST /v1/m/routines */
routineRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const input = routineSchema.parse(req.body);
    const r = await createRoutine(req.user.id, input);
    res.status(201).json({ ok: true, data: r });
  } catch (err) { next(err); }
});

/** PATCH /v1/m/routines/:id */
routineRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const patch = routineSchema.partial().parse(req.body);
    const r = await updateRoutine(req.user.id, req.params.id!, patch);
    res.json({ ok: true, data: r });
  } catch (err) { next(err); }
});

/** DELETE /v1/m/routines/:id */
routineRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await deleteRoutine(req.user.id, req.params.id!);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/** POST /v1/m/routines/:id/start */
routineRouter.post("/:id/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const log = await startRoutine(req.user.id, req.params.id!);
    res.json({ ok: true, data: log });
  } catch (err) { next(err); }
});

/** POST /v1/m/routines/:id/step/:stepId */
routineRouter.post("/:id/step/:stepId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const log = await completeStep(req.user.id, req.params.id!, req.params.stepId!);
    res.json({ ok: true, data: log });
  } catch (err) { next(err); }
});

/** GET /v1/m/routines/:id/today */
routineRouter.get("/:id/today", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const log = await getTodayLog(req.user.id, req.params.id!);
    res.json({ ok: true, data: log });
  } catch (err) { next(err); }
});

/** GET /v1/m/routines/:id/history?days=30 */
routineRouter.get("/:id/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const days = Number(req.query.days ?? 30);
    const history = await getRoutineHistory(req.user.id, req.params.id!, days);
    res.json({ ok: true, data: history });
  } catch (err) { next(err); }
});

/** GET /v1/m/routines/:id/nudge */
routineRouter.get("/:id/nudge", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const nudge = await generateNudge(req.user.id, req.params.id!);
    res.json({ ok: true, data: { message: nudge } });
  } catch (err) { next(err); }
});
