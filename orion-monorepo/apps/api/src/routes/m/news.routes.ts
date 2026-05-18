import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { listSaved, markRead, removeItem, saveItem, searchNews } from "../../modules/news.service.js";

export const newsRouter: Router = Router();

const searchSchema = z.object({
  query: z.string().min(1).max(200),
  freshness: z.enum(["pd", "pw", "pm"]).default("pw"),
});

newsRouter.post("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { query, freshness } = searchSchema.parse(req.body);
    const results = await searchNews(query, freshness);
    res.json({ ok: true, data: results });
  } catch (err) {
    next(err);
  }
});

const saveSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  summary: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
  category: z.string().max(40).optional(),
});

newsRouter.post("/save", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = saveSchema.parse(req.body);
    res.json({ ok: true, data: await saveItem(req.user.id, body) });
  } catch (err) {
    next(err);
  }
});

newsRouter.get("/saved", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    res.json({ ok: true, data: await listSaved(req.user.id) });
  } catch (err) {
    next(err);
  }
});

newsRouter.post("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    await markRead(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

newsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    await removeItem(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});
