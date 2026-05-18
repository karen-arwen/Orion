import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   FOCO — Sessões Pomodoro.

   - start(duration): abre sessão
   - complete(id): marca como completa, registra actualMinutes
   - interrupt(id): marca interrompida com timestamp
   - listToday: sessões de hoje
   - weeklyStats: total de minutos focados por dia (7d)
═══════════════════════════════════════════════════════════════════ */

export async function startSession(userId: string, duration = 25, note?: string): Promise<{
  id: string;
  duration: number;
  startedAt: string;
}> {
  if (duration < 5 || duration > 180) throw new Error("Duração deve ser 5-180 min");
  const s = await prisma.focusSession.create({
    data: { userId, duration, note: note ?? null },
    select: { id: true, duration: true, startedAt: true },
  });
  return {
    id: s.id,
    duration: s.duration,
    startedAt: s.startedAt.toISOString(),
  };
}

export async function completeSession(
  userId: string,
  id: string,
): Promise<{ id: string; actualMinutes: number }> {
  const owned = await prisma.focusSession.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Sessão não encontrada");
  if (owned.endedAt) throw new Error("Sessão já encerrada");

  const now = new Date();
  const actualMinutes = Math.round((now.getTime() - owned.startedAt.getTime()) / 60_000);
  await prisma.focusSession.update({
    where: { id },
    data: { completed: true, actualMinutes, endedAt: now },
  });
  return { id, actualMinutes };
}

export async function interruptSession(
  userId: string,
  id: string,
): Promise<{ id: string; actualMinutes: number }> {
  const owned = await prisma.focusSession.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Sessão não encontrada");
  if (owned.endedAt) throw new Error("Sessão já encerrada");

  const now = new Date();
  const actualMinutes = Math.round((now.getTime() - owned.startedAt.getTime()) / 60_000);
  await prisma.focusSession.update({
    where: { id },
    data: { interruptedAt: now, actualMinutes, endedAt: now },
  });
  return { id, actualMinutes };
}

export async function listToday(userId: string): Promise<Array<{
  id: string;
  duration: number;
  actualMinutes: number | null;
  completed: boolean;
  interruptedAt: string | null;
  startedAt: string;
  endedAt: string | null;
}>> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await prisma.focusSession.findMany({
    where: { userId, startedAt: { gte: start } },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      duration: true,
      actualMinutes: true,
      completed: true,
      interruptedAt: true,
      startedAt: true,
      endedAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    duration: r.duration,
    actualMinutes: r.actualMinutes,
    completed: r.completed,
    interruptedAt: r.interruptedAt?.toISOString() ?? null,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
  }));
}

export async function weeklyStats(userId: string): Promise<Array<{ date: string; minutes: number }>> {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const rows = await prisma.focusSession.findMany({
    where: { userId, startedAt: { gte: start }, actualMinutes: { not: null } },
    select: { startedAt: true, actualMinutes: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const key = r.startedAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + (r.actualMinutes ?? 0));
  }
  return Array.from(buckets.entries()).map(([date, minutes]) => ({ date, minutes }));
}
