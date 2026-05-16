import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  createGameEntry,
  deleteGameEntry,
  getGamingSummary,
  listGames,
  searchGameCatalog,
  trendingGameCatalog,
  updateGameEntry,
} from "../../modules/gaming.service.js";

export const gamingRouter: Router = Router();

const statusSchema = z.enum(["want", "playing", "beaten", "dropped"]);

const createSchema = z.object({
  title: z.string().trim().min(1).max(140),
  platform: z.string().trim().min(1).max(80),
  status: statusSchema.optional(),
  genre: z.string().trim().max(80).optional(),
  hoursPlayed: z.number().min(0).max(10000).optional(),
  rating: z.number().int().min(1).max(10).optional(),
  coverUrl: z.string().url().optional(),
  rawgId: z.number().int().positive().optional(),
});

const updateSchema = createSchema.partial().extend({
  genre: z.union([z.string().trim().max(80), z.null()]).optional(),
  rating: z.union([z.number().int().min(1).max(10), z.null()]).optional(),
  dealActive: z.boolean().optional(),
  dealPrice: z.union([z.number().min(0), z.null()]).optional(),
  coverUrl: z.union([z.string().url(), z.null()]).optional(),
});

gamingRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await listGames(req.user.id) });
  } catch (err) {
    next(err);
  }
});

gamingRouter.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await getGamingSummary(req.user.id) });
  } catch (err) {
    next(err);
  }
});

gamingRouter.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = z.string().trim().min(1).max(120).parse(req.query.query);
    res.json({ ok: true, data: await searchGameCatalog(query) });
  } catch (err) {
    next(err);
  }
});

gamingRouter.get("/trending", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ ok: true, data: await trendingGameCatalog() });
  } catch (err) {
    next(err);
  }
});

gamingRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = createSchema.parse(req.body);
    res.json({ ok: true, data: await createGameEntry(req.user.id, body) });
  } catch (err) {
    next(err);
  }
});

gamingRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    const body = updateSchema.parse(req.body);
    res.json({ ok: true, data: await updateGameEntry(req.user.id, id, body) });
  } catch (err) {
    next(err);
  }
});

gamingRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    res.json({ ok: true, data: await deleteGameEntry(req.user.id, id) });
  } catch (err) {
    next(err);
  }
});
