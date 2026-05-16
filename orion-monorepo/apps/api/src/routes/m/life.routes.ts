import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  createTask,
  deleteTask,
  listAllTasks,
  listTasks,
  suggestNext,
  updateTask,
} from "../../modules/life.service.js";

export const lifeRouter: Router = Router();

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
});

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

/** GET /v1/m/life — tarefas ativas (todo + doing) */
lifeRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const tasks = await listTasks(req.user.id);
    res.json({ ok: true, data: tasks });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/life/all — todas as tarefas (inclusive arquivadas) */
lifeRouter.get("/all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const tasks = await listAllTasks(req.user.id);
    res.json({ ok: true, data: tasks });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/m/life — cria task */
lifeRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const input = createSchema.parse(req.body);
    const t = await createTask(req.user.id, input);
    res.json({ ok: true, data: t });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/m/life/:id */
lifeRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const input = updateSchema.parse({ ...req.body, id });
    const t = await updateTask(req.user.id, input);
    res.json({ ok: true, data: t });
  } catch (err) {
    next(err);
  }
});

/** DELETE /v1/m/life/:id */
lifeRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    await deleteTask(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
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
  } catch (err) {
    next(err);
  }
});
