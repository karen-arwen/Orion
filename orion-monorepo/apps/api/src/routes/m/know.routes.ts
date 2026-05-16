import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  ask,
  continueLesson,
  createLesson,
  deleteLesson,
  getLesson,
  isLessonRequest,
  listLessons,
} from "../../modules/know.service.js";

export const knowRouter: Router = Router();

const askSchema = z.object({
  question: z.string().min(1).max(2000),
  depth: z.enum(["rapido", "padrao", "fundo"]).optional(),
  context: z.string().max(2000).optional(),
});

/**
 * POST /v1/m/know/ask
 * - Detecta se é pedido de AULA → cria sessão estruturada
 * - Senão, retorna resposta livre
 */
knowRouter.post("/ask", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const input = askSchema.parse(req.body);

    if (isLessonRequest(input.question)) {
      const topic = input.question.trim();
      const lesson = await createLesson({ userId: req.user.id, topic });
      res.json({ ok: true, data: { kind: "lesson", lesson } });
      return;
    }

    const answer = await ask(input);
    res.json({ ok: true, data: { kind: "answer", answer } });
  } catch (err) {
    next(err);
  }
});

const lessonSchema = z.object({
  topic: z.string().min(3).max(200),
  level: z.enum(["iniciante", "intermediario", "avancado"]).optional(),
});

/** POST /v1/m/know/lessons — força criação de aula estruturada */
knowRouter.post("/lessons", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const input = lessonSchema.parse(req.body);
    const lesson = await createLesson({ userId: req.user.id, ...input });
    res.json({ ok: true, data: lesson });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/know/lessons — lista sessões */
knowRouter.get("/lessons", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await listLessons(req.user.id);
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/know/lessons/:id — sessão completa com material e histórico */
knowRouter.get("/lessons/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const lesson = await getLesson(req.user.id, id);
    if (!lesson) throw new ApiError(404, "NOT_FOUND", "Aula não encontrada.");
    res.json({ ok: true, data: lesson });
  } catch (err) {
    next(err);
  }
});

const continueSchema = z.object({ question: z.string().min(1).max(2000) });

/** POST /v1/m/know/lessons/:id/continue — pergunta sobre a aula */
knowRouter.post("/lessons/:id/continue", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const { question } = continueSchema.parse(req.body);
    const answer = await continueLesson(req.user.id, id, question);
    res.json({ ok: true, data: { answer } });
  } catch (err) {
    next(err);
  }
});

/** DELETE /v1/m/know/lessons/:id */
knowRouter.delete("/lessons/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    await deleteLesson(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});
