import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  addGame,
  deleteGame,
  listGames,
  searchRawg,
  updateGame,
} from "../../modules/gaming.service.js";

export const gamingRouter: Router = Router();

const statusEnum = z.enum(["wishlist", "playing", "finished", "dropped", "paused"]);
const addSchema = z.object({
  title: z.string().min(1).max(200),
  rawgId: z.number().int().optional(),
  platform: z.string().max(120).optional(),
  genre: z.string().max(120).optional(),
  status: statusEnum.optional(),
  coverUrl: z.string().max(500).optional(),
  releasedAt: z.string().max(40).optional(),
});

gamingRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const status = typeof req.query.status === "string" ? (req.query.status as never) : undefined;
    res.json({ ok: true, data: await listGames(req.user.id, status) });
  } catch (err) {
    next(err);
  }
});

gamingRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = addSchema.parse(req.body);
    res.json({ ok: true, data: await addGame(req.user.id, body) });
  } catch (err) {
    next(err);
  }
});

const patchSchema = addSchema.partial().extend({
  hoursPlayed: z.number().nonnegative().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
});

gamingRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const patch = patchSchema.parse(req.body);
    res.json({ ok: true, data: await updateGame(req.user.id, id, patch) });
  } catch (err) {
    next(err);
  }
});

gamingRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    await deleteGame(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

gamingRouter.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const q = z.string().min(1).parse(req.query.q);
    res.json({ ok: true, data: await searchRawg(q) });
  } catch (err) {
    next(err);
  }
});
