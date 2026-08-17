import { prisma } from "../db/prisma.js";
import type { Prisma } from "@prisma/client";

// ── Types ──────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  date: Date;
  module: string | null;
  entityId: string | null;
  icon: string | null;
  color: string | null;
  metadata: Record<string, unknown> | null;
}

export interface TimelineFilters {
  type?: string;
  module?: string;
  from?: Date;
  to?: Date;
  search?: string;
}

export interface TimelineCreateInput {
  userId: string;
  type: string;
  title: string;
  detail?: string;
  date: Date;
  module?: string;
  entityId?: string;
  icon?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

// Categorias visuais para a timeline
const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  milestone: { icon: "◆", color: "#F59E0B" },
  decision: { icon: "⬡", color: "#8B5CF6" },
  achievement: { icon: "★", color: "#10B981" },
  event: { icon: "◫", color: "#00D4FF" },
  memory: { icon: "◉", color: "#EC4899" },
  health: { icon: "♥", color: "#EF4444" },
  career: { icon: "▲", color: "#6366F1" },
  finance: { icon: "◇", color: "#14B8A6" },
  social: { icon: "◎", color: "#F97316" },
  travel: { icon: "✈", color: "#0EA5E9" },
  learning: { icon: "◈", color: "#A855F7" },
};

// ── Service ────────────────────────────────────────────────────────

/** Lista eventos da timeline com filtros */
export async function listTimeline(
  userId: string,
  filters: TimelineFilters = {},
  limit = 100,
  offset = 0,
) {
  const where: Prisma.LifeTimelineEventWhereInput = {
    userId,
    ...(filters.type && { type: filters.type }),
    ...(filters.module && { module: filters.module }),
    ...(filters.from && filters.to && {
      date: { gte: filters.from, lte: filters.to },
    }),
    ...(filters.from && !filters.to && { date: { gte: filters.from } }),
    ...(!filters.from && filters.to && { date: { lte: filters.to } }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" as const } },
        { detail: { contains: filters.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.lifeTimelineEvent.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.lifeTimelineEvent.count({ where }),
  ]);

  return { items, total };
}

/** Criar evento na timeline */
export async function createTimelineEvent(data: TimelineCreateInput) {
  const defaults = TYPE_CONFIG[data.type] ?? { icon: "•", color: "#00D4FF" };
  return prisma.lifeTimelineEvent.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      detail: data.detail,
      date: data.date,
      module: data.module,
      entityId: data.entityId,
      icon: data.icon ?? defaults.icon,
      color: data.color ?? defaults.color,
      metadata: data.metadata ?? undefined,
    },
  });
}

/** Atualizar evento */
export async function updateTimelineEvent(userId: string, eventId: string, data: Partial<TimelineCreateInput>) {
  return prisma.lifeTimelineEvent.update({
    where: { id: eventId, userId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.detail !== undefined && { detail: data.detail }),
      ...(data.date && { date: data.date }),
      ...(data.type && { type: data.type }),
      ...(data.module && { module: data.module }),
      ...(data.icon && { icon: data.icon }),
      ...(data.color && { color: data.color }),
      ...(data.metadata && { metadata: data.metadata }),
    },
  });
}

/** Deletar evento */
export async function deleteTimelineEvent(userId: string, eventId: string) {
  return prisma.lifeTimelineEvent.delete({
    where: { id: eventId, userId },
  });
}

/** Stats da timeline — distribuição por tipo e por mês */
export async function getTimelineStats(userId: string) {
  const events = await prisma.lifeTimelineEvent.findMany({
    where: { userId },
    select: { type: true, date: true, module: true },
    orderBy: { date: "desc" },
  });

  const byType: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byModule: Record<string, number> = {};

  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    const month = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`;
    byMonth[month] = (byMonth[month] ?? 0) + 1;
    if (e.module) byModule[e.module] = (byModule[e.module] ?? 0) + 1;
  }

  return { total: events.length, byType, byMonth, byModule, types: TYPE_CONFIG };
}

/**
 * Auto-capture: transforma ações significativas em eventos de timeline.
 * Chamado pelo cognitive loop ou após ações importantes.
 */
export async function autoCapture(
  userId: string,
  event: { type: string; title: string; detail?: string; module?: string; entityId?: string; metadata?: Record<string, unknown> },
) {
  // Deduplica: não criar eventos idênticos no mesmo dia
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existing = await prisma.lifeTimelineEvent.findFirst({
    where: {
      userId,
      type: event.type,
      title: event.title,
      date: { gte: today, lt: tomorrow },
    },
  });

  if (existing) return existing;

  return createTimelineEvent({
    userId,
    ...event,
    date: new Date(),
  });
}
