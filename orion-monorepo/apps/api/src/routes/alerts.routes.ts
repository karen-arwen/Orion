import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";
import { detectForUser } from "../alerts/detector.js";
import { runProactivePulseForUser } from "../proactive/pulse.js";

export const alertsRouter: Router = Router();

/** Filtragem por modo: SILENCIOSO=só high, NORMAL=med+high, STARK=todos */
const PRIORITY_BY_MODE: Record<string, Array<"low" | "medium" | "high" | "critical">> = {
  SILENCIOSO: ["high", "critical"],
  NORMAL: ["medium", "high", "critical"],
  STARK: ["low", "medium", "high", "critical"],
};

const MAX_VISIBLE = 5;

/** GET /v1/alerts — alertas ativos filtrados por modo + cap em 5. */
alertsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mode: true },
    });
    const mode = user?.mode ?? "NORMAL";
    const allowedPriorities = PRIORITY_BY_MODE[mode] ?? PRIORITY_BY_MODE.NORMAL ?? [];

    const all = await prisma.proactiveAlert.findMany({
      where: {
        userId: req.user.id,
        dismissed: false,
        priority: { in: allowedPriorities },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [
        // Pri high primeiro, depois mais recentes
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      take: MAX_VISIBLE,
    });

    res.json({ ok: true, data: all });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/alerts/all — sem filtragem (debug / overview) */
alertsRouter.get("/all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await prisma.proactiveAlert.findMany({
      where: { userId: req.user.id, dismissed: false },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/alerts/:id/dismiss — ignora (feedback negativo implícito). */
alertsRouter.post("/scan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "SessÃ£o necessÃ¡ria.");
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mode: true, profile: { select: { timezone: true } } },
    });
    const detection = await detectForUser({
      userId: req.user.id,
      mode: user?.mode ?? "NORMAL",
      timezone: user?.profile?.timezone ?? "America/Sao_Paulo",
    });
    const pulse = await runProactivePulseForUser({
      userId: req.user.id,
      timezone: user?.profile?.timezone ?? "America/Sao_Paulo",
    });
    res.json({ ok: true, data: { detection, pulse } });
  } catch (err) {
    next(err);
  }
});

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

/** POST /v1/alerts/:id/approve — marca aprovado + retorna action pra mandar no chat. */
alertsRouter.post("/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const owned = await prisma.proactiveAlert.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Alerta não encontrado.");
    await prisma.proactiveAlert.update({
      where: { id },
      data: { dismissed: true, approved: true },
    });
    res.json({ ok: true, data: { id, action: owned.action } });
  } catch (err) {
    next(err);
  }
});
