import { prisma } from "../db/prisma.js";

/**
 * Smart Notifications — priorização, agrupamento e delivery inteligente.
 * Agrupa notificações similares, prioriza por contexto, respeita DND.
 */

interface NotificationInput {
  userId: string;
  title: string;
  body?: string;
  type: string;      // alert, reminder, insight, action, social
  channel: string;   // push, inbox, email, sms
  priority: number;  // 1-10
  module?: string;
  entityId?: string;
  actionUrl?: string;
  groupKey?: string;  // para agrupar notificações similares
  metadata?: Record<string, unknown>;
  scheduledFor?: Date;
}

/** Criar smart notification com agrupamento */
export async function createSmartNotification(input: NotificationInput) {
  // Se tem groupKey, verificar se já existe grupo recente
  if (input.groupKey) {
    const recent = await prisma.smartNotification.findFirst({
      where: {
        userId: input.userId,
        groupKey: input.groupKey,
        status: "pending",
        createdAt: { gte: new Date(Date.now() - 3600000) }, // última hora
      },
    });

    if (recent) {
      // Incrementar contador do grupo em vez de criar nova
      const currentMeta = (recent.metadata as Record<string, unknown>) ?? {};
      const groupCount = ((currentMeta.groupCount as number) ?? 1) + 1;
      return prisma.smartNotification.update({
        where: { id: recent.id },
        data: {
          title: `${input.title} (+${groupCount - 1})`,
          priority: Math.max(recent.priority, input.priority),
          metadata: { ...currentMeta, groupCount, lastItem: input.metadata },
        },
      });
    }
  }

  return prisma.smartNotification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      channel: input.channel,
      priority: input.priority,
      module: input.module,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
      groupKey: input.groupKey,
      metadata: input.metadata ?? {},
      scheduledFor: input.scheduledFor,
      status: input.scheduledFor ? "scheduled" : "pending",
    },
  });
}

/** Listar notificações pendentes, priorizadas */
export async function listPendingNotifications(userId: string, limit = 30) {
  return prisma.smartNotification.findMany({
    where: {
      userId,
      status: { in: ["pending", "scheduled"] },
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: new Date() } },
      ],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

/** Marcar como entregue */
export async function markDelivered(userId: string, id: string) {
  return prisma.smartNotification.update({
    where: { id, userId },
    data: { status: "delivered", deliveredAt: new Date() },
  });
}

/** Marcar como lida */
export async function markNotifRead(userId: string, id: string) {
  return prisma.smartNotification.update({
    where: { id, userId },
    data: { status: "read", readAt: new Date() },
  });
}

/** Dismiss notification */
export async function dismissNotif(userId: string, id: string) {
  return prisma.smartNotification.update({
    where: { id, userId },
    data: { status: "dismissed" },
  });
}

/** Stats rápidos */
export async function getNotifStats(userId: string) {
  const [pending, delivered, today] = await Promise.all([
    prisma.smartNotification.count({ where: { userId, status: "pending" } }),
    prisma.smartNotification.count({ where: { userId, status: "delivered" } }),
    prisma.smartNotification.count({
      where: {
        userId,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);
  return { pending, delivered, today };
}

/** Bulk dismiss old notifications */
export async function cleanOldNotifications(userId: string, daysOld = 7) {
  const cutoff = new Date(Date.now() - daysOld * 86400000);
  return prisma.smartNotification.updateMany({
    where: { userId, status: { in: ["pending", "delivered"] }, createdAt: { lt: cutoff } },
    data: { status: "dismissed" },
  });
}
