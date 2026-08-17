import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { createMindsetCheckin } from "../../modules/mindset.service.js";

export const mindsetRouter: Router = Router();

const checkinSchema = z.object({
  mood: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10),
  stress: z.number().int().min(1).max(10),
  note: z.string().max(1200).optional(),
});

mindsetRouter.post("/checkin", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const data = await createMindsetCheckin(req.user.id, checkinSchema.parse(req.body));
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});
