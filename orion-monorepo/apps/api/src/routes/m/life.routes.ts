import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import type { EnergyLevel, Priority, TaskCreateInput, TaskUpdateInput } from "@orion/types";
import {
  createTask,
  deleteTask,
  listAllTasks,
  listTasks,
  listTasksByDate,
  listOverdueTasks,
  suggestNext,
  updateTask,
  completeRecurring,
} from "../../modules/life.service.js";

export const lifeRouter: Router = Router();

const recurrenceEnum = z.enum(["daily", "weekly", "monthly", "weekdays"]).optional();

const createSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  status: z.enum(["todo", "doing", "done", "archived"]).optional(),
  energy: z.number().int().min(1).max(3).optional(),
  priority: z.number().int().min(1).max(3).optional(),
  scheduledFor: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  estMinutes: z.number().int().positive().optional(),
  projectId: z.string().optional(),
  parentId: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: recurrenceEnum,
});

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

/** GET /v1/m/life — tarefas ativas (todo + doing), top-level com subtasks */
lifeRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const tasks = await listTasks(req.user.id);
    res.json({ ok: true, data: tasks });
  } catch (err) { next(err); }
});

/** GET /v1/m/life/all — todas as tarefas */
lifeRouter.get("/all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const tasks = await listAllTasks(req.user.id);
    res.json({ ok: true, data: tasks });
  } catch (err) { next(err); }
});

/** GET /v1/m/life/by-date?date=YYYY-MM-DD */
lifeRouter.get("/by-date", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date);
    const tasks = await listTasksByDate(req.user.id, date);
    res.json({ ok: true, data: tasks });
  } catch (err) { next(err); }
});

/** GET /v1/m/life/overdue */
lifeRouter.get("/overdue", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const tasks = await listOverdueTasks(req.user.id);
    res.json({ ok: true, data: tasks });
  } catch (err) { next(err); }
});

/** POST /v1/m/life — cria task */
lifeRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const parsed = createSchema.parse(req.body);
    const input: TaskCreateInput = {
      ...parsed,
      energy: parsed.energy as EnergyLevel | undefined,
      priority: parsed.priority as Priority | undefined,
    };
    const t = await createTask(req.user.id, input);
    res.json({ ok: true, data: t });
  } catch (err) { next(err); }
});

/** PATCH /v1/m/life/:id */
lifeRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const parsed = updateSchema.parse({ ...req.body, id });
    const input: TaskUpdateInput = {
      ...parsed,
      energy: parsed.energy as EnergyLevel | undefined,
      priority: parsed.priority as Priority | undefined,
    };
    const t = await updateTask(req.user.id, input);
    res.json({ ok: true, data: t });
  } catch (err) { next(err); }
});

/** POST /v1/m/life/:id/complete-recurring — conclui e spawna próxima */
lifeRouter.post("/:id/complete-recurring", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const next = await completeRecurring(req.user.id, id);
    res.json({ ok: true, data: next });
  } catch (err) { next(err); }
});

/** DELETE /v1/m/life/:id */
lifeRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    await deleteTask(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) { next(err); }
});

const suggestSchema = z.object({
  currentEnergy: z.number().int().min(1).max(3).default(2),
});

/** POST /v1/m/life/suggest-next */
lifeRouter.post("/suggest-next", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { currentEnergy } = suggestSchema.parse(req.body);
    const text = await suggestNext(req.user.id, {
      currentEnergy: currentEnergy as 1 | 2 | 3,
      timezone: "America/Sao_Paulo",
    });
    res.json({ ok: true, data: { suggestion: text } });
  } catch (err) { next(err); }
});
