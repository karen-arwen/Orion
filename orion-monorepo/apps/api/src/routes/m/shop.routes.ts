import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  createWishlistItem,
  deleteWishlistItem,
  listWishlist,
  updateWishlistItem,
} from "../../modules/shop.service.js";

export const shopRouter: Router = Router();

const itemSchema = z.object({
  name: z.string().min(1).max(160),
  url: z.string().url(),
  targetPrice: z.number().positive().optional(),
  currentPrice: z.number().positive().optional(),
  alertAtPct: z.number().int().min(1).max(90).optional(),
  notes: z.string().max(800).optional(),
});

shopRouter.get("/wishlist", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    res.json({ ok: true, data: await listWishlist(req.user.id) });
  } catch (err) {
    next(err);
  }
});

shopRouter.post("/wishlist", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    res.json({ ok: true, data: await createWishlistItem(req.user.id, itemSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});

shopRouter.patch("/wishlist/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const body = itemSchema.partial().parse(req.body);
    res.json({ ok: true, data: await updateWishlistItem(req.user.id, { id, ...body }) });
  } catch (err) {
    next(err);
  }
});

shopRouter.delete("/wishlist/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    await deleteWishlistItem(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});
