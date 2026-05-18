import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   HÁBITOS — CRUD + streak counter + recent logs (heatmap GitHub-style).

   - createHabit, listHabits, deleteHabit, archiveHabit
   - toggleToday: marca/desmarca hoje (atualiza streak)
   - recentLogs(habit, days): retorna map { date: true } pros últimos N dias
═══════════════════════════════════════════════════════════════════ */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Calcula streak atual contando dias consecutivos a partir de hoje. */
async function recalcStreak(habitId: string): Promise<{ streak: number; bestStreak: number }> {
  const logs = await prisma.habitLog.findMany({
    where: { habitId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const set = new Set(logs.map((l) => l.date));

  let streak = 0;
  let cursor = new Date();
  // Se não marcou hoje, streak começa a partir de ontem
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const current = await prisma.habit.findUnique({
    where: { id: habitId },
    select: { bestStreak: true },
  });
  const bestStreak = Math.max(current?.bestStreak ?? 0, streak);

  await prisma.habit.update({
    where: { id: habitId },
    data: { streak, bestStreak },
  });
  return { streak, bestStreak };
}

export async function listHabits(userId: string): Promise<Array<{
  id: string;
  name: string;
  frequency: string;
  color: string;
  icon: string;
  streak: number;
  bestStreak: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recentLogs: Record<string, boolean>;
}>> {
  const habits = await prisma.habit.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ streak: "desc" }, { createdAt: "desc" }],
  });

  // 30 dias de logs por hábito
  const since = isoDaysAgo(30);
  const habitIds = habits.map((h) => h.id);
  const logs = await prisma.habitLog.findMany({
    where: { habitId: { in: habitIds }, date: { gte: since } },
    select: { habitId: true, date: true },
  });
  const byHabit = new Map<string, Set<string>>();
  for (const l of logs) {
    const s = byHabit.get(l.habitId) ?? new Set<string>();
    s.add(l.date);
    byHabit.set(l.habitId, s);
  }

  return habits.map((h) => {
    const dates = byHabit.get(h.id) ?? new Set<string>();
    const recentLogs: Record<string, boolean> = {};
    for (let i = 0; i < 30; i++) {
      const date = isoDaysAgo(i);
      recentLogs[date] = dates.has(date);
    }
    return {
      id: h.id,
      name: h.name,
      frequency: h.frequency,
      color: h.color,
      icon: h.icon,
      streak: h.streak,
      bestStreak: h.bestStreak,
      archivedAt: h.archivedAt?.toISOString() ?? null,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
      recentLogs,
    };
  });
}

export async function createHabit(
  userId: string,
  input: { name: string; frequency?: string; color?: string; icon?: string },
): Promise<{ id: string }> {
  const h = await prisma.habit.create({
    data: {
      userId,
      name: input.name,
      frequency: input.frequency ?? "daily",
      color: input.color ?? "#00D4FF",
      icon: input.icon ?? "✓",
    },
    select: { id: true },
  });
  return h;
}

export async function deleteHabit(userId: string, id: string): Promise<void> {
  const owned = await prisma.habit.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Hábito não encontrado");
  await prisma.habit.delete({ where: { id } });
}

export async function toggleToday(
  userId: string,
  id: string,
): Promise<{ checked: boolean; streak: number; bestStreak: number }> {
  const owned = await prisma.habit.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Hábito não encontrado");

  const date = todayISO();
  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId: id, date } },
  });

  if (existing) {
    await prisma.habitLog.delete({ where: { id: existing.id } });
    const stats = await recalcStreak(id);
    return { checked: false, ...stats };
  }

  await prisma.habitLog.create({
    data: { habitId: id, date },
  });
  const stats = await recalcStreak(id);
  return { checked: true, ...stats };
}
