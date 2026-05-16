import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";

export const userRouter: Router = Router();

/** GET /v1/user/profile — perfil completo do operador autenticado. */
userRouter.get("/profile", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        projects: true,
        modules: true,
        integrations: { select: { provider: true, status: true } },
      },
    });
    res.json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/user/mode — troca de modo (STARK/NORMAL/SILENCIOSO). */
const modeSchema = z.object({
  mode: z.enum(["SILENCIOSO", "NORMAL", "STARK"]),
});
userRouter.patch("/mode", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { mode } = modeSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { mode },
      select: { id: true, mode: true },
    });
    res.json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/user/preferences — atualiza/insere uma preferência. */
const prefSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  layer: z.enum(["current", "nostalgia", "exploration"]).default("current"),
  confidence: z.number().min(0).max(1).default(0.5),
});
userRouter.patch("/preferences", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const data = prefSchema.parse(req.body);
    const pref = await prisma.userPreference.upsert({
      where: { userId_key_layer: { userId: req.user.id, key: data.key, layer: data.layer } },
      create: { ...data, userId: req.user.id },
      update: { value: data.value, confidence: data.confidence },
    });
    res.json({ ok: true, data: pref });
  } catch (err) {
    next(err);
  }
});
