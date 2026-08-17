import type { Prisma } from "@prisma/client";
import type { DecisionApproveResult, DecisionCreateInput, DecisionItem, DecisionQueueSummary } from "@orion/types";
import { prisma } from "../db/prisma.js";
import { executeInternalAction } from "./action-executor.js";
import { executeExternalAction } from "./external-action-executor.js";
import { scheduleRetry } from "./retry-engine.js";

function toDecision(item: {
  id: string;
  userId: string;
  source: string;
  sourceId: string | null;
  title: string;
  summary: string;
  proposedAction: string;
  payload: Prisma.JsonValue;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "dismissed" | "executed";
  dedupKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  decidedAt: Date | null;
}): DecisionItem {
  return {
    ...item,
    payload: (item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
      ? item.payload
      : {}) as Record<string, unknown>,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    decidedAt: item.decidedAt?.toISOString() ?? null,
  };
}

export async function listDecisions(userId: string, status = "pending"): Promise<DecisionItem[]> {
  const items = await prisma.decisionItem.findMany({
    where: { userId, status: status as "pending" | "approved" | "dismissed" | "executed" },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 30,
  });
  return items.map(toDecision);
}

export async function getDecisionQueueSummary(userId: string): Promise<DecisionQueueSummary> {
  const [pending, approved, executed, dismissed, criticalPending, recent] = await Promise.all([
    prisma.decisionItem.count({ where: { userId, status: "pending" } }),
    prisma.decisionItem.count({ where: { userId, status: "approved" } }),
    prisma.decisionItem.count({ where: { userId, status: "executed" } }),
    prisma.decisionItem.count({ where: { userId, status: "dismissed" } }),
    prisma.decisionItem.count({ where: { userId, status: "pending", priority: { in: ["critical", "high"] } } }),
    prisma.decisionItem.findMany({
      where: { userId, status: "pending" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]);
  return {
    pending,
    approved,
    executed,
    dismissed,
    criticalPending,
    recent: recent.map(toDecision),
  };
}

export async function createDecision(userId: string, input: DecisionCreateInput): Promise<DecisionItem> {
  const data = {
    userId,
    source: input.source,
    sourceId: input.sourceId ?? null,
    title: input.title,
    summary: input.summary,
    proposedAction: input.proposedAction,
    payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    priority: input.priority ?? "medium",
    dedupKey: input.dedupKey ?? `${input.source}:${Date.now()}`,
  };
  const item = await prisma.decisionItem.upsert({
    where: { userId_dedupKey: { userId, dedupKey: data.dedupKey } },
    create: data,
    update: {
      title: data.title,
      summary: data.summary,
      proposedAction: data.proposedAction,
      payload: data.payload,
      priority: data.priority,
      status: "pending",
      decidedAt: null,
    },
  });
  return toDecision(item);
}

export async function syncDecisionsFromAlerts(userId: string): Promise<{ created: number; pending: number }> {
  const alerts = await prisma.proactiveAlert.findMany({
    where: {
      userId,
      dismissed: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 30,
  });
  let created = 0;
  for (const alert of alerts) {
    const before = await prisma.decisionItem.findUnique({
      where: { userId_dedupKey: { userId, dedupKey: `alert:${alert.id}` } },
      select: { id: true },
    });
    await createDecision(userId, {
      source: "alert",
      sourceId: alert.id,
      title: alert.title,
      summary: alert.text,
      proposedAction: alert.action,
      priority: alert.priority,
      dedupKey: `alert:${alert.id}`,
      payload: {
        module: alert.module,
        icon: alert.icon,
        color: alert.color,
        alertId: alert.id,
      },
    });
    if (!before) created++;
  }
  const pending = await prisma.decisionItem.count({ where: { userId, status: "pending" } });
  return { created, pending };
}

export async function approveDecision(userId: string, id: string): Promise<DecisionApproveResult> {
  const owned = await prisma.decisionItem.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("DECISION_NOT_FOUND");
  const payload =
    owned.payload && typeof owned.payload === "object" && !Array.isArray(owned.payload)
      ? (owned.payload as Record<string, unknown>)
      : {};
  let execution: Record<string, unknown> | null = null;
  try {
    const internalResult = await executeInternalAction(userId, payload);
    const externalResult = !internalResult ? await executeExternalAction(payload) : null;
    execution = (internalResult ?? externalResult) as Record<string, unknown> | null;
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.warn("[decision] execution failed, scheduling retry:", errorMsg);
    await scheduleRetry(id, userId, errorMsg, payload);
    return { id, status: "retry_scheduled", error: errorMsg } as unknown as DecisionApproveResult;
  }
  await prisma.decisionItem.update({
    where: { id },
    data: {
      status: execution ? "executed" : "approved",
      decidedAt: new Date(),
      payload: {
        ...payload,
        ...(execution
          ? {
              execution: {
                ...execution,
                executedAt: new Date().toISOString(),
              },
            }
          : {}),
      } as Prisma.InputJsonValue,
    },
  });
  if (owned.source === "alert" && owned.sourceId) {
    await prisma.proactiveAlert.updateMany({
      where: { id: owned.sourceId, userId },
      data: { dismissed: true, approved: true },
    });
  }
  return {
    id,
    action: owned.proposedAction,
    executed: Boolean(execution),
    ...(execution ? { execution: execution as DecisionApproveResult["execution"] } : {}),
  };
}

export async function dismissDecision(userId: string, id: string): Promise<{ id: string }> {
  const owned = await prisma.decisionItem.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("DECISION_NOT_FOUND");
  await prisma.decisionItem.update({
    where: { id },
    data: { status: "dismissed", decidedAt: new Date() },
  });
  return { id };
}
