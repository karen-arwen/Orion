import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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

const autonomyLevelSchema = z.enum(["observe", "suggest", "draft", "confirm", "execute"]);
const policySchema = z.object({
  level: autonomyLevelSchema.optional(),
  enabled: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  maxDailyActions: z.number().int().min(0).max(100).optional(),
  rules: z.array(z.string().min(2).max(180)).max(12).optional(),
});

const DEFAULT_AUTONOMY: Array<{
  moduleId: string;
  level: "observe" | "suggest" | "draft" | "confirm" | "execute";
  requiresConfirmation: boolean;
  rules: string[];
}> = [
  { moduleId: "comms", level: "draft", requiresConfirmation: true, rules: ["Pode resumir e rascunhar respostas.", "Nunca enviar mensagem sem aprovacao."] },
  { moduleId: "calendar", level: "confirm", requiresConfirmation: true, rules: ["Pode sugerir blocos de foco.", "Criar evento exige confirmacao de data e hora."] },
  { moduleId: "life", level: "confirm", requiresConfirmation: true, rules: ["Pode criar tarefas apos aprovacao.", "Pode priorizar com base em energia e prazo."] },
  { moduleId: "finance", level: "suggest", requiresConfirmation: true, rules: ["Pode registrar gastos apos aprovacao.", "Nunca iniciar pagamento ou compra."] },
  { moduleId: "shop", level: "suggest", requiresConfirmation: true, rules: ["Pode monitorar wishlist.", "Compra real sempre fora do escopo autonomo."] },
  { moduleId: "security", level: "observe", requiresConfirmation: true, rules: ["Pode apontar risco.", "Nao altera credenciais ou configuracoes externas."] },
  { moduleId: "media", level: "suggest", requiresConfirmation: false, rules: ["Pode sugerir e organizar watchlist.", "Nao afirma disponibilidade em streaming sem fonte."] },
  { moduleId: "habit", level: "confirm", requiresConfirmation: true, rules: ["Pode propor habitos.", "Criacao de habito exige aprovacao."] },
];

function toPolicy(row: {
  id: string;
  userId: string;
  moduleId: string;
  level: "observe" | "suggest" | "draft" | "confirm" | "execute";
  enabled: boolean;
  requiresConfirmation: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  maxDailyActions: number;
  rules: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAutonomyActionLog(row: {
  id: string;
  userId: string;
  moduleId: string;
  actionType: string;
  title: string;
  status: "executed" | "decision" | "blocked";
  reason: string | null;
  decisionId: string | null;
  entityId: string | null;
  createdAt: Date;
}) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

async function ensureAutonomyPolicies(userId: string) {
  await Promise.all(
    DEFAULT_AUTONOMY.map((policy) =>
      prisma.autonomyPolicy.upsert({
        where: { userId_moduleId: { userId, moduleId: policy.moduleId } },
        create: {
          userId,
          moduleId: policy.moduleId,
          level: policy.level,
          requiresConfirmation: policy.requiresConfirmation,
          rules: policy.rules,
        },
        update: {},
      }),
    ),
  );
}

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

automationsRouter.get("/overview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "SessÃ£o necessÃ¡ria.");
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const now = new Date();
    const [user, total, enabled, alerts, recentLogs, last24hRuns, failedLast24h] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id }, select: { mode: true } }),
      prisma.automation.count({ where: { userId: req.user.id } }),
      prisma.automation.count({ where: { userId: req.user.id, enabled: true } }),
      prisma.proactiveAlert.findMany({
        where: {
          userId: req.user.id,
          dismissed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { priority: true },
        take: 50,
      }),
      prisma.automationLog.findMany({
        where: { automation: { userId: req.user.id } },
        orderBy: { triggeredAt: "desc" },
        take: 8,
        include: { automation: { select: { name: true } } },
      }),
      prisma.automationLog.count({
        where: { automation: { userId: req.user.id }, triggeredAt: { gte: since } },
      }),
      prisma.automationLog.count({
        where: { automation: { userId: req.user.id }, triggeredAt: { gte: since }, status: "failed" },
      }),
    ]);
    const criticalAlerts = alerts.filter((a) => a.priority === "critical" || a.priority === "high").length;
    const enabledRatio = total > 0 ? enabled / total : 0;
    const alertPenalty = Math.min(25, alerts.length * 4 + criticalAlerts * 6);
    const failurePenalty = Math.min(25, failedLast24h * 8);
    const autonomyScore = Math.max(0, Math.min(100, Math.round(35 + enabledRatio * 55 - alertPenalty - failurePenalty)));
    res.json({
      ok: true,
      data: {
        total,
        enabled,
        pendingAlerts: alerts.length,
        criticalAlerts,
        last24hRuns,
        failedLast24h,
        autonomyScore,
        mode: user?.mode ?? "NORMAL",
        recent: recentLogs.map((log) => ({
          id: log.id,
          automationId: log.automationId,
          automationName: log.automation.name,
          status: log.status,
          triggeredAt: log.triggeredAt.toISOString(),
          executionMs: log.executionMs,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/automations/:id — detalhe + últimos 20 logs */
automationsRouter.get("/autonomy-core", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await ensureAutonomyPolicies(req.user.id);
    const rows = await prisma.autonomyPolicy.findMany({
      where: { userId: req.user.id },
      orderBy: [{ enabled: "desc" }, { moduleId: "asc" }],
    });
    const recentActions = await prisma.autonomyActionLog.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const policies = rows.map(toPolicy);
    res.json({
      ok: true,
      data: {
        policies,
        recentActions: recentActions.map(toAutonomyActionLog),
        modulesObserved: policies.filter((p) => p.enabled && p.level !== "observe").length,
        modulesExecutable: policies.filter((p) => p.enabled && p.level === "execute").length,
        confirmationRequired: policies.filter((p) => p.enabled && p.requiresConfirmation).length,
        lockedDown: policies.filter((p) => !p.enabled || p.level === "observe").length,
        recommended: [
          { moduleId: "life", level: "confirm", reason: "Tarefas internas sao reversiveis e ganham valor com aprovacao rapida." },
          { moduleId: "media", level: "suggest", reason: "Recomendacoes de gosto sao baixo risco e ajudam a calibrar preferencias." },
          { moduleId: "security", level: "observe", reason: "Seguranca deve observar e explicar antes de qualquer acao." },
        ],
      },
    });
  } catch (err) {
    next(err);
  }
});

automationsRouter.patch("/autonomy-core/:moduleId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const moduleId = z.string().min(1).max(40).parse(req.params.moduleId);
    const body = policySchema.parse(req.body);
    const row = await prisma.autonomyPolicy.upsert({
      where: { userId_moduleId: { userId: req.user.id, moduleId } },
      create: {
        userId: req.user.id,
        moduleId,
        level: body.level ?? "suggest",
        enabled: body.enabled ?? true,
        requiresConfirmation: body.requiresConfirmation ?? true,
        quietHoursStart: body.quietHoursStart ?? null,
        quietHoursEnd: body.quietHoursEnd ?? null,
        maxDailyActions: body.maxDailyActions ?? 3,
        rules: body.rules ?? [],
      },
      update: {
        ...(body.level !== undefined ? { level: body.level } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.requiresConfirmation !== undefined ? { requiresConfirmation: body.requiresConfirmation } : {}),
        ...(body.quietHoursStart !== undefined ? { quietHoursStart: body.quietHoursStart } : {}),
        ...(body.quietHoursEnd !== undefined ? { quietHoursEnd: body.quietHoursEnd } : {}),
        ...(body.maxDailyActions !== undefined ? { maxDailyActions: body.maxDailyActions } : {}),
        ...(body.rules !== undefined ? { rules: body.rules } : {}),
      },
    });
    res.json({ ok: true, data: toPolicy(row) });
  } catch (err) {
    next(err);
  }
});

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
        triggerConfig: body.triggerConfig as Prisma.InputJsonValue,
        conditions: (body.conditions ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        actions: body.actions as unknown as Prisma.InputJsonValue,
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
        ...(body.triggerConfig !== undefined && {
          triggerConfig: body.triggerConfig as Prisma.InputJsonValue,
        }),
        ...(body.conditions !== undefined && {
          conditions: (body.conditions ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        }),
        ...(body.actions !== undefined && {
          actions: body.actions as unknown as Prisma.InputJsonValue,
        }),
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
