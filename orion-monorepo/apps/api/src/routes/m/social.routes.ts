import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { createContact, getNudges, listContacts } from "../../modules/social.service.js";

export const socialRouter: Router = Router();

const contactSchema = z.object({
  name: z.string().min(2).max(120),
  context: z.string().max(1200).optional(),
  lastInteraction: z.string().max(120).optional(),
  nextStep: z.string().max(400).optional(),
  importance: z.number().int().min(1).max(10).optional(),
});

socialRouter.get("/contacts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await listContacts(req.user.id) });
  } catch (err) {
    next(err);
  }
});

socialRouter.post("/contacts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await createContact(req.user.id, contactSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});

socialRouter.get("/nudges", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await getNudges(req.user.id) });
  } catch (err) {
    next(err);
  }
});
