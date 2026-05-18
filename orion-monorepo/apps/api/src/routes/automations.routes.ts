import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";
import { runMorningBriefFor } from "../automations/morning-brief.js";
import { runAutomation } from "../automations/engine.js";
import { automationQueue, JOB_NAMES } from "../queues/index.js";
import { seedDefaultAutomations } from "../automations/templates.js";

export const automationsRouter: Router = Router();

const triggerEnum = z.enum(["cron", "event", "behavioral", "contextual", "manual"]);

const actionSchema = z.object({
  type: z.string().min(1),
  config: z.record(z.unknown()).default({}),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  triggerType: triggerEnum,
  triggerConfig: z.record(z.unknown()).default({}),
  conditions: z.record(z.unknown()).nullable().optional(),
  actions: z.array(actionSchema).default([]),
  requiresConfirmation: z.boolean().default(false),
  confirmationTimeout: z.number().int().positive().max(1440).default(240),
  enabled: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

/** GET /v1/automations — todas do usuário com último log. */
automationsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await prisma.automation.findMany({
      where: { userId: req.user.id },
      orderBy: [{ enabled: "desc" }, { createdAt: "desc" }],
      include: {
        logs: { orderBy: { triggeredAt: "desc" }, take: 1 },
      },
    });
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/automations/:id — detalhe + últimos 20 logs */
automationsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const auto = await prisma.automation.findFirst({
      where: { id, userId: req.user.id },
      include: { logs: { orderBy: { triggeredAt: "desc" }, take: 20 } },
    });
    if (!auto) throw new ApiError(404, "NOT_FOUND", "Automação não encontrada.");
    res.json({ ok: true, data: auto });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/automations — cria custom (não vinculada a template). */
automationsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = createSchema.parse(req.body);
    const auto = await prisma.automation.create({
      data: {
        userId: req.user.id,
        name: body.name,
        description: body.description ?? null,
        triggerType: body.triggerType,
        triggerConfig: body.triggerConfig,
        conditions: (body.conditions ?? null) as object | null,
        actions: body.actions as unknown as object,
        requiresConfirmation: body.requiresConfirmation,
        confirmationTimeout: body.confirmationTimeout,
        enabled: body.enabled,
      },
    });

    // Se for cron, registra repeating job
    if (auto.triggerType === "cron" && auto.enabled) {
      const cfg = auto.triggerConfig as { cron?: string; tz?: string };
      if (cfg.cron) {
        await automationQueue.add(
          JOB_NAMES.RUN_AUTOMATION,
          { automationId: auto.id },
          {
            repeat: { pattern: cfg.cron, tz: cfg.tz ?? "America/Sao_Paulo" },
            jobId: `automation:${auto.id}`,
          },
        );
      }
    }

    res.json({ ok: true, data: auto });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/automations/:id — edita. */
automationsRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const owned = await prisma.automation.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Automação não encontrada.");

    const body = updateSchema.parse(req.body);
    const updated = await prisma.automation.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.triggerType !== undefined && { triggerType: body.triggerType }),
        ...(body.triggerConfig !== undefined && { triggerConfig: body.triggerConfig }),
        ...(body.conditions !== undefined && { conditions: body.conditions as object | null }),
        ...(body.actions !== undefined && { actions: body.actions as unknown as object }),
        ...(body.requiresConfirmation !== undefined && {
          requiresConfirmation: body.requiresConfirmation,
        }),
        ...(body.confirmationTimeout !== undefined && {
          confirmationTimeout: body.confirmationTimeout,
        }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });

    // Toggle enabled afeta o repeating job
    if (body.enabled !== undefined || body.triggerConfig !== undefined) {
      const cfg = updated.triggerConfig as { cron?: string; tz?: string };
      if (updated.triggerType === "cron" && cfg.cron) {
        // Remove repeating antigo + adiciona novo (idempotente)
        const repeats = await automationQueue.getRepeatableJobs();
        const old = repeats.find((r) => r.id === `automation:${updated.id}`);
        if (old) await automationQueue.removeRepeatableByKey(old.key);
        if (updated.enabled) {
          await automationQueue.add(
            JOB_NAMES.RUN_AUTOMATION,
            { automationId: updated.id },
            {
              repeat: { pattern: cfg.cron, tz: cfg.tz ?? "America/Sao_Paulo" },
              jobId: `automation:${updated.id}`,
            },
          );
        }
      }
    }

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

    // Remove repeating job se existir
    const repeats = await automationQueue.getRepeatableJobs();
    const old = repeats.find((r) => r.id === `automation:${id}`);
    if (old) await automationQueue.removeRepeatableByKey(old.key);

    await prisma.automation.delete({ where: { id } });
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/automations/:id/trigger — dispara manualmente (síncrono). */
automationsRouter.post("/:id/trigger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const auto = await prisma.automation.findFirst({ where: { id, userId: req.user.id } });
    if (!auto) throw new ApiError(404, "NOT_FOUND", "Automação não encontrada.");

    const log = await runAutomation(id, { manual: true, confirmed: true });
    res.json({ ok: true, data: { logId: log.id, status: log.status, executionMs: log.executionMs } });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/automations/seed-defaults — re-aplica seed (útil pra usuários antigos). */
automationsRouter.post("/seed-defaults", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    await seedDefaultAutomations(req.user.id);
    const list = await prisma.automation.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/automations/morning-brief/now — atalho histórico (Fase 1) */
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
