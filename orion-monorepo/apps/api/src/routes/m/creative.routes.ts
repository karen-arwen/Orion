import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  createContentIdea,
  deleteContentIdea,
  generateContentIdeas,
  listContentIdeas,
  updateContentIdeaStatus,
} from "../../modules/creative.service.js";

export const creativeRouter: Router = Router();

const ideaSchema = z.object({
  title: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(3000),
  niche: z.string().trim().min(1).max(80),
  format: z.string().trim().min(1).max(40),
  status: z.enum(["idea", "draft", "scheduled", "published"]).optional(),
  scheduledAt: z.string().datetime().optional(),
});

const generateSchema = z.object({
  niche: z.string().trim().min(1).max(80),
  format: z.string().trim().max(40).optional(),
  theme: z.string().trim().max(120).optional(),
  count: z.number().int().min(1).max(6).optional(),
});

const statusSchema = z.object({
  status: z.enum(["idea", "draft", "scheduled", "published"]),
  scheduledAt: z.string().datetime().optional(),
});

creativeRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await listContentIdeas(req.user.id) });
  } catch (err) {
    next(err);
  }
});

creativeRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = ideaSchema.parse(req.body);
    res.json({ ok: true, data: await createContentIdea(req.user.id, body) });
  } catch (err) {
    next(err);
  }
});

creativeRouter.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = generateSchema.parse(req.body);
    res.json({ ok: true, data: await generateContentIdeas(req.user.id, body) });
  } catch (err) {
    next(err);
  }
});

creativeRouter.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    const body = statusSchema.parse(req.body);
    res.json({ ok: true, data: await updateContentIdeaStatus(req.user.id, id, body) });
  } catch (err) {
    next(err);
  }
});

creativeRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    res.json({ ok: true, data: await deleteContentIdea(req.user.id, id) });
  } catch (err) {
    next(err);
  }
});
