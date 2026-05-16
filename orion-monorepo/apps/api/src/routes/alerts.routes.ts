import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";

export const alertsRouter: Router = Router();

/** GET /v1/alerts — alertas ativos (não dismissados). */
alertsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await prisma.proactiveAlert.findMany({
      where: { userId: req.user.id, dismissed: false },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/alerts/:id/dismiss — ignora um alerta. */
alertsRouter.post("/:id/dismiss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const owned = await prisma.proactiveAlert.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Alerta não encontrado.");
    await prisma.proactiveAlert.update({ where: { id }, data: { dismissed: true } });
    res.json({ ok: true, data: { id, dismissed: true } });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/alerts/:id/approve — marca como aprovado (também marca dismissed). */
alertsRouter.post("/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const owned = await prisma.proactiveAlert.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Alerta não encontrado.");
    await prisma.proactiveAlert.update({ where: { id }, data: { dismissed: true } });
    res.json({ ok: true, data: { id, action: owned.action } });
  } catch (err) {
    next(err);
  }
});
