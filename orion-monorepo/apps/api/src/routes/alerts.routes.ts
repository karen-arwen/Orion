import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";
import { isFocusActive } from "../modules/focus.service.js";

export const alertsRouter: Router = Router();

const priorityScore = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const;

function minPriorityForMode(mode: "SILENCIOSO" | "NORMAL" | "STARK"): number {
  if (mode === "SILENCIOSO") return 3;
  if (mode === "NORMAL") return 2;
  return 1;
}

/** GET /v1/alerts — alertas ativos (não dismissados). */
alertsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mode: true },
    });
    const list = await prisma.proactiveAlert.findMany({
      where: {
        userId: req.user.id,
        dismissed: false,
        approved: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const focusActive = await isFocusActive(req.user.id);
    const minPriority = Math.max(minPriorityForMode(user?.mode ?? "NORMAL"), focusActive ? 3 : 1);
    const filtered = list.filter((alert) => priorityScore[alert.priority] >= minPriority).slice(0, 5);
    res.json({ ok: true, data: filtered });
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
    await prisma.$transaction([
      prisma.proactiveAlert.update({ where: { id }, data: { dismissed: true } }),
      prisma.userPreference.upsert({
        where: {
          userId_key_layer: {
            userId: req.user.id,
            key: `alert:${owned.module}:${owned.title}`,
            layer: "current",
          },
        },
        create: {
          userId: req.user.id,
          key: `alert:${owned.module}:${owned.title}`,
          value: "dismissed",
          layer: "current",
          confidence: 0.4,
        },
        update: { value: "dismissed", confidence: { decrement: 0.1 } },
      }),
    ]);
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
    await prisma.$transaction([
      prisma.proactiveAlert.update({ where: { id }, data: { dismissed: true, approved: true } }),
      prisma.userPreference.upsert({
        where: {
          userId_key_layer: {
            userId: req.user.id,
            key: `alert:${owned.module}:${owned.title}`,
            layer: "current",
          },
        },
        create: {
          userId: req.user.id,
          key: `alert:${owned.module}:${owned.title}`,
          value: "approved",
          layer: "current",
          confidence: 0.7,
        },
        update: { value: "approved", confidence: { increment: 0.2 } },
      }),
    ]);
    res.json({ ok: true, data: { id, action: owned.action } });
  } catch (err) {
    next(err);
  }
});
