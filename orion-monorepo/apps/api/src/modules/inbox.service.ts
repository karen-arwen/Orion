import { prisma } from "../db/prisma.js";
import type { Prisma } from "@prisma/client";

// ── Tipos ──────────────────────────────────────────────────────────

export interface InboxFilters {
  status?: string;
  source?: string;
  urgency?: string;
  category?: string;
  search?: string;
}

export interface InboxStats {
  total: number;
  unread: number;
  critical: number;
  actionable: number;
  bySource: Record<string, number>;
}

type InboxCreateInput = {
  userId: string;
  source: string;
  sourceId?: string;
  type: string;
  title: string;
  preview?: string;
  sender?: string;
  urgency?: string;
  category?: string;
  actionable?: boolean;
  metadata?: Record<string, unknown>;
};

// ── Urgency weights para ordenação inteligente ─────────────────────

const URGENCY_WEIGHT: Record<string, number> = {
  critical: 4,
  urgent: 3,
  normal: 2,
  low: 1,
};

// ── Service ────────────────────────────────────────────────────────

/** Lista inbox items com filtros, ordenação por urgência + recência */
export async function listInboxItems(
  userId: string,
  filters: InboxFilters = {},
  limit = 50,
  offset = 0,
) {
  const where: Prisma.UniversalInboxItemWhereInput = {
    userId,
    ...(filters.status && { status: filters.status }),
    ...(filters.source && { source: filters.source }),
    ...(filters.urgency && { urgency: filters.urgency }),
    ...(filters.category && { category: filters.category }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" as const } },
        { preview: { contains: filters.search, mode: "insensitive" as const } },
        { sender: { contains: filters.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.universalInboxItem.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.universalInboxItem.count({ where }),
  ]);

  // Sort client-side por urgência + recência (Prisma não suporta custom sort)
  const sorted = items.sort((a, b) => {
    const urgA = URGENCY_WEIGHT[a.urgency] ?? 2;
    const urgB = URGENCY_WEIGHT[b.urgency] ?? 2;
    if (urgA !== urgB) return urgB - urgA;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return { items: sorted, total };
}

/** Stats do inbox — contadores rápidos para o dashboard */
export async function getInboxStats(userId: string): Promise<InboxStats> {
  const all = await prisma.universalInboxItem.findMany({
    where: { userId, status: { not: "archived" } },
    select: { source: true, urgency: true, status: true, actionable: true },
  });

  const bySource: Record<string, number> = {};
  let unread = 0;
  let critical = 0;
  let actionable = 0;

  for (const item of all) {
    bySource[item.source] = (bySource[item.source] ?? 0) + 1;
    if (item.status === "unread") unread++;
    if (item.urgency === "critical" || item.urgency === "urgent") critical++;
    if (item.actionable) actionable++;
  }

  return { total: all.length, unread, critical, actionable, bySource };
}

/** Cria um item no inbox */
export async function createInboxItem(data: InboxCreateInput) {
  return prisma.universalInboxItem.create({
    data: {
      userId: data.userId,
      source: data.source,
      sourceId: data.sourceId,
      type: data.type,
      title: data.title,
      preview: data.preview,
      sender: data.sender,
      urgency: data.urgency ?? "normal",
      category: data.category ?? "uncategorized",
      actionable: data.actionable ?? false,
      metadata: data.metadata ?? undefined,
    },
  });
}

/** Batch ingest — recebe múltiplos itens de uma fonte */
export async function batchIngest(userId: string, items: Omit<InboxCreateInput, "userId">[]) {
  const data = items.map((item) => ({
    userId,
    source: item.source,
    sourceId: item.sourceId,
    type: item.type,
    title: item.title,
    preview: item.preview,
    sender: item.sender,
    urgency: item.urgency ?? "normal",
    category: item.category ?? "uncategorized",
    actionable: item.actionable ?? false,
    metadata: item.metadata ?? undefined,
  }));

  // Deduplica por sourceId se fornecido
  const existingIds = new Set<string>();
  if (data.some((d) => d.sourceId)) {
    const existing = await prisma.universalInboxItem.findMany({
      where: {
        userId,
        sourceId: { in: data.filter((d) => d.sourceId).map((d) => d.sourceId!) },
      },
      select: { sourceId: true },
    });
    for (const e of existing) if (e.sourceId) existingIds.add(e.sourceId);
  }

  const newItems = data.filter((d) => !d.sourceId || !existingIds.has(d.sourceId));
  if (newItems.length === 0) return { created: 0 };

  const result = await prisma.universalInboxItem.createMany({ data: newItems });
  return { created: result.count };
}

/** Marcar como lido */
export async function markRead(userId: string, itemId: string) {
  return prisma.universalInboxItem.update({
    where: { id: itemId, userId },
    data: { status: "read", readAt: new Date() },
  });
}

/** Marcar como lido em batch */
export async function markAllRead(userId: string, source?: string) {
  return prisma.universalInboxItem.updateMany({
    where: { userId, status: "unread", ...(source && { source }) },
    data: { status: "read", readAt: new Date() },
  });
}

/** Marcar como "acted" (ação tomada) */
export async function markActed(userId: string, itemId: string) {
  return prisma.universalInboxItem.update({
    where: { id: itemId, userId },
    data: { status: "acted" },
  });
}

/** Arquivar item */
export async function archiveItem(userId: string, itemId: string) {
  return prisma.universalInboxItem.update({
    where: { id: itemId, userId },
    data: { status: "archived", archivedAt: new Date() },
  });
}

/** Arquivar tudo que já foi lido */
export async function archiveRead(userId: string) {
  return prisma.universalInboxItem.updateMany({
    where: { userId, status: "read" },
    data: { status: "archived", archivedAt: new Date() },
  });
}

/** Sync automático — puxa emails, notificações de integrações e transforma em inbox items */
export async function syncFromIntegrations(userId: string) {
  // Buscar integrações ativas do usuário
  const integrations = await prisma.integration.findMany({
    where: { userId, status: "active" },
    select: { provider: true, metadata: true },
  });

  const results: Record<string, number> = {};

  for (const integration of integrations) {
    try {
      switch (integration.provider) {
        case "google": {
          // Puxar alertas proativos recentes e transformar em inbox items
          const alerts = await prisma.proactiveAlert.findMany({
            where: { userId, status: "pending" },
            take: 20,
            orderBy: { createdAt: "desc" },
          });
          const alertItems = alerts.map((a) => ({
            source: "system" as const,
            sourceId: `alert_${a.id}`,
            type: "notification" as const,
            title: a.title,
            preview: a.body ?? undefined,
            urgency: a.priority === "HIGH" ? "urgent" : "normal",
            category: a.module ?? "system",
            actionable: true,
            metadata: { alertId: a.id, module: a.module },
          }));
          const r = await batchIngest(userId, alertItems);
          results.alerts = r.created;
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error(`[Inbox] Sync failed for ${integration.provider}:`, err);
    }
  }

  // Sempre sync decisions pendentes
  const decisions = await prisma.decisionItem.findMany({
    where: { userId, status: "PENDING" },
    take: 20,
    orderBy: { createdAt: "desc" },
  });
  const decisionItems = decisions.map((d) => ({
    source: "system" as const,
    sourceId: `decision_${d.id}`,
    type: "notification" as const,
    title: `Decisão: ${d.title}`,
    preview: d.description ?? undefined,
    urgency: d.riskLevel === "HIGH" ? "urgent" : "normal",
    category: "decisions",
    actionable: true,
    metadata: { decisionId: d.id },
  }));
  const dr = await batchIngest(userId, decisionItems);
  results.decisions = dr.created;

  return results;
}
