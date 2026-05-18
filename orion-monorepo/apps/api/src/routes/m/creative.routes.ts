import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  createIdea,
  deleteIdea,
  generateIdeas,
  listIdeas,
  updateIdea,
} from "../../modules/creative.service.js";

export const creativeRouter: Router = Router();

const ideaSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(4000).optional(),
  niche: z.string().max(40).optional(),
  format: z.string().max(40).optional(),
  status: z.enum(["ideia", "rascunho", "agendado", "publicado", "arquivado"]).optional(),
  scheduledAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

creativeRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    res.json({ ok: true, data: await listIdeas(req.user.id) });
  } catch (err) {
    next(err);
  }
});

creativeRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = ideaSchema.parse(req.body);
    res.json({ ok: true, data: await createIdea(req.user.id, body) });
  } catch (err) {
    next(err);
  }
});

creativeRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const patch = ideaSchema.partial().parse(req.body);
    res.json({ ok: true, data: await updateIdea(req.user.id, id, patch) });
  } catch (err) {
    next(err);
  }
});

creativeRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    await deleteIdea(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

const genSchema = z.object({
  niche: z.string().max(40).optional(),
  audience: z.string().max(200).optional(),
  save: z.boolean().default(false),
});

creativeRouter.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = genSchema.parse(req.body);
    const ideas = await generateIdeas({ userId: req.user.id, ...body });
    res.json({ ok: true, data: ideas });
  } catch (err) {
    next(err);
  }
});
