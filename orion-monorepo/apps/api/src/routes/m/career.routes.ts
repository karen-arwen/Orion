import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { coach } from "../../modules/career.service.js";

export const careerRouter: Router = Router();

const coachSchema = z.object({
  prompt: z.string().min(1).max(3000),
  mode: z.enum(["portfolio", "entrevista", "plano_90", "review", "livre"]).optional(),
});

/** POST /v1/m/career/coach */
careerRouter.post("/coach", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const input = coachSchema.parse(req.body);
    const answer = await coach(req.user.id, input);
    res.json({ ok: true, data: { answer } });
  } catch (err) {
    next(err);
  }
});
