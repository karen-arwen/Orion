import type { AlertPriority, Prisma } from "@prisma/client";
import type { InternalActionType } from "@orion/types";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { createDecision } from "./decision.service.js";
import { executeInternalAction, type ExecutionResult } from "./action-executor.js";

interface RouteActionInput {
  title: string;
  summary: string;
  proposedAction: string;
  priority: AlertPriority;
  actionType: InternalActionType;
  actionInput: Record<string, unknown>;
}

export type RouteActionResult =
  | { status: "executed"; moduleId: string; execution: ExecutionResult }
  | { status: "decision"; moduleId: string; decisionId: string; reason: string }
  | { status: "blocked"; moduleId: string; reason: string };

const ACTION_MODULE: Record<InternalActionType, string> = {
  "memory.create": "memory",
  "task.create": "life",
  "alert.create": "alerts",
  "project.create": "projects",
  "project.update": "projects",
  "social.contact.create": "social",
  "finance.transaction.create": "finance",
  "finance.subscription.create": "finance",
  "finance.goal.create": "finance",
  "shop.wishlist.create": "shop",
  "media.item.create": "media",
  "security.finding.create": "security",
  "habit.create": "habit",
};

const LOW_RISK_MODULES = new Set(["alerts", "memory", "media"]);
const AUTO_ESCALATE_THRESHOLD = 5;

function defaultPolicy(moduleId: string) {
  if (LOW_RISK_MODULES.has(moduleId)) {
    return {
      level: "execute" as const,
      requiresConfirmation: false,
      enabled: true,
      quietHoursStart: null as string | null,
      quietHoursEnd: null as string | null,
      maxDailyActions: 20,
    };
  }
  return {
    level: "confirm" as const,
    requiresConfirmation: true,
    enabled: true,
    quietHoursStart: null as string | null,
    quietHoursEnd: null as string | null,
    maxDailyActions: 10,
  };
}

async function checkLearntApproval(userId: string, moduleId: string, actionType: string): Promise<boolean> {
  const key = `approval_streak:${userId}:${moduleId}:${actionType}`;
  const streak = await redis.get(key);
  return streak !== null && parseInt(streak, 10) >= AUTO_ESCALATE_THRESHOLD;
}

export async function recordApproval(userId: string, moduleId: string, actionType: string): Promise<void> {
  const key = `approval_streak:${userId}:${moduleId}:${actionType}`;
  await redis.incr(key);
}

export async function recordRejection(userId: string, moduleId: string, actionType: string): Promise<void> {
  const key = `approval_streak:${userId}:${moduleId}:${actionType}`;
  await redis.del(key);
}

function isQuietHoursActive(now: Date, start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseHourMinute(start);
  const endMinutes = parseHourMinute(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) return current >= startMinutes && current < endMinutes;
  return current >= startMinutes || current < endMinutes;
}

function parseHourMinute(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export async function routeInternalAction(userId: string, input: RouteActionInput): Promise<RouteActionResult> {
  const moduleId = ACTION_MODULE[input.actionType] ?? "orion";

  const policy = await prisma.autonomyPolicy.findUnique({
    where: { userId_moduleId: { userId, moduleId } },
    select: {
      enabled: true,
      level: true,
      requiresConfirmation: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      maxDailyActions: true,
    },
  });
  const effective = policy ?? defaultPolicy(moduleId);

  async function logRoute(data: {
    status: "executed" | "decision" | "blocked";
    reason?: string;
    decisionId?: string;
    entityId?: string | null;
  }) {
    await prisma.autonomyActionLog.create({
      data: {
        userId,
        moduleId,
        actionType: input.actionType,
        title: input.title,
        status: data.status,
        reason: data.reason,
        decisionId: data.decisionId,
        entityId: data.entityId ?? null,
      },
    });
  }

  if (!effective.enabled) {
    const reason = `Autonomia do modulo ${moduleId} esta desligada.`;
    await logRoute({ status: "blocked", reason });
    return { status: "blocked", moduleId, reason };
  }

  if (effective.level === "observe") {
    const reason = `Modulo ${moduleId}: observe. Monitorando apenas.`;
    await logRoute({ status: "blocked", reason });
    return { status: "blocked", moduleId, reason };
  }

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const actionsToday = await prisma.autonomyActionLog.count({
    where: {
      userId,
      moduleId,
      status: { in: ["executed", "decision"] },
      createdAt: { gte: dayStart },
    },
  });
  if (actionsToday >= effective.maxDailyActions) {
    const reason = `Limite diario do modulo ${moduleId} atingido (${effective.maxDailyActions}).`;
    await logRoute({ status: "blocked", reason });
    return { status: "blocked", moduleId, reason };
  }

  const quietHoursActive = isQuietHoursActive(now, effective.quietHoursStart, effective.quietHoursEnd);

  const payload = {
    internalAction: { type: input.actionType, input: input.actionInput },
    autonomy: {
      moduleId,
      level: effective.level,
      requiresConfirmation: effective.requiresConfirmation,
      routedAt: new Date().toISOString(),
    },
  };

  const isAutonomous = effective.level === "execute" && effective.maxDailyActions >= 20;
  const isDirectExecute = effective.level === "execute" && !effective.requiresConfirmation && !quietHoursActive;
  const isLearntApproval = await checkLearntApproval(userId, moduleId, input.actionType);

  if (isAutonomous || isDirectExecute || isLearntApproval) {
    const execution = await executeInternalAction(userId, payload);
    if (!execution) {
      const reason = "Acao interna invalida ou sem executor.";
      await logRoute({ status: "blocked", reason });
      return { status: "blocked", moduleId, reason };
    }
    const reason = isLearntApproval
      ? `Executado automaticamente (ORION aprendeu que voce sempre aprova em ${moduleId}).`
      : execution.summary;
    await logRoute({ status: "executed", reason, entityId: execution.entityId });
    return { status: "executed", moduleId, execution };
  }

  const decision = await createDecision(userId, {
    source: "chat",
    title: input.title,
    summary: input.summary,
    proposedAction: input.proposedAction,
    priority: input.priority,
    dedupKey: `auto:${input.actionType}:${input.title.toLowerCase().slice(0, 80)}`,
    payload: payload as Prisma.JsonObject,
  });

  const reason = quietHoursActive
    ? `Horario silencioso ativo em ${moduleId}. Acao aguarda aprovacao.`
    : effective.requiresConfirmation
      ? `Politica de ${moduleId} exige aprovacao.`
      : `Nivel ${effective.level} prepara a acao antes de executar.`;

  await logRoute({ status: "decision", reason, decisionId: decision.id });
  return { status: "decision", moduleId, decisionId: decision.id, reason };
}
