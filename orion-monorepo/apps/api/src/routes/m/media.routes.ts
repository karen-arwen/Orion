import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  createMediaItem,
  deleteMediaItem,
  getMediaHub,
  recommendMedia,
  updateMediaItem,
} from "../../modules/media.service.js";

export const mediaRouter: Router = Router();

const kindEnum = z.enum(["movie", "series", "anime", "documentary", "other"]);
const statusEnum = z.enum(["wishlist", "watching", "finished", "dropped", "paused"]);
const layerEnum = z.enum(["current", "nostalgia", "exploration"]);

const itemSchema = z.object({
  title: z.string().min(1).max(200),
  kind: kindEnum.optional(),
  status: statusEnum.optional(),
  genres: z.array(z.string().min(1).max(60)).max(8).optional(),
  mood: z.string().max(80).optional(),
  platform: z.string().max(120).optional(),
  releaseYear: z.number().int().min(1888).max(2100).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).optional(),
  coverUrl: z.string().max(800).nullable().optional(),
  tasteLayer: layerEnum.optional(),
});

const recommendationSchema = z.object({
  mood: z.string().max(80).optional(),
  availableTime: z.number().int().min(10).max(600).optional(),
  intent: z.enum(["current", "nostalgia", "exploration", "balanced"]).optional(),
  includeAnime: z.boolean().optional(),
});

mediaRouter.get("/hub", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await getMediaHub(req.user.id) });
  } catch (err) {
    next(err);
  }
});

mediaRouter.post("/items", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await createMediaItem(req.user.id, itemSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});

mediaRouter.patch("/items/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    res.json({ ok: true, data: await updateMediaItem(req.user.id, id, itemSchema.partial().parse(req.body)) });
  } catch (err) {
    if ((err as Error).message === "MEDIA_ITEM_NOT_FOUND") {
      next(new ApiError(404, "NOT_FOUND", "Item de midia nao encontrado."));
      return;
    }
    next(err);
  }
});

mediaRouter.delete("/items/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    await deleteMediaItem(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    if ((err as Error).message === "MEDIA_ITEM_NOT_FOUND") {
      next(new ApiError(404, "NOT_FOUND", "Item de midia nao encontrado."));
      return;
    }
    next(err);
  }
});

mediaRouter.post("/recommend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await recommendMedia(req.user.id, recommendationSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});
