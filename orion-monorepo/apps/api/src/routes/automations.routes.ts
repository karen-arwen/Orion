import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";
import { runMorningBriefFor } from "../automations/morning-brief.js";

export const automationsRouter: Router = Router();

/**
 * POST /v1/automations/morning-brief/now
 * Dispara o briefing matinal imediatamente para o usuário autenticado.
 * Útil pra testar / pedir "me dá o resumo agora".
 */
automationsRouter.post(
  "/morning-brief/now",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
      await runMorningBriefFor(req.user.id);
      res.json({ ok: true, data: { triggered: true } });
    } catch (err) {
      next(err);
    }
  },
);

const triggerEnum = z.enum(["temporal", "event", "behavioral", "contextual", "manual"]);

const createSchema = z.object({
  name: z.string().min(1),
  triggerType: triggerEnum,
  triggerConfig: z.record(z.unknown()).default({}),
  actions: z.array(z.object({ type: z.string(), config: z.record(z.unknown()).default({}) })),
  enabled: z.boolean().default(true),
});

/** GET /v1/automations — todas as automações do usuário. */
automationsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await prisma.automation.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/automations — cria nova automação. */
automationsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = createSchema.parse(req.body);
    const auto = await prisma.automation.create({
      data: {
        userId: req.user.id,
        name: body.name,
        triggerType: body.triggerType,
        triggerConfig: body.triggerConfig,
        actions: body.actions,
        enabled: body.enabled,
      },
    });
    res.json({ ok: true, data: auto });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/automations/:id — edita uma automação. */
automationsRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const owned = await prisma.automation.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Automação não encontrada.");
    const partial = createSchema.partial().parse(req.body);
    const updated = await prisma.automation.update({
      where: { id },
      data: partial,
    });
    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/** DELETE /v1/automations/:id */
automationsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const owned = await prisma.automation.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Automação não encontrada.");
    await prisma.automation.delete({ where: { id } });
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/automations/:id/trigger — dispara manualmente. */
automationsRouter.post("/:id/trigger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const auto = await prisma.automation.findFirst({ where: { id, userId: req.user.id } });
    if (!auto) throw new ApiError(404, "NOT_FOUND", "Automação não encontrada.");
    const log = await prisma.automationLog.create({
      data: { automationId: id, status: "pending", result: { trigger: "manual" } },
    });
    res.json({ ok: true, data: { logId: log.id, automation: auto.name } });
  } catch (err) {
    next(err);
  }
});
