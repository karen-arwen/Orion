import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { practiceLanguage } from "../../modules/language.service.js";

export const languageRouter: Router = Router();

const practiceSchema = z.object({
  language: z.string().min(2).max(40),
  level: z.enum(["iniciante", "intermediario", "avancado"]),
  mode: z.enum(["chat", "pronuncia", "entrevista", "viagem", "gramatica"]),
  message: z.string().min(1).max(2000),
  goal: z.string().max(300).optional(),
});

languageRouter.post("/practice", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    res.json({ ok: true, data: await practiceLanguage(req.user.id, practiceSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});
