import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";

/* ═══════════════════════════════════════════════════════════════════
   DAILY MOMENTUM SCORE — um numero que resume seu dia.

   Combina 5 dimensoes (0-20 cada, total 0-100):
   - Sono: qualidade e duracao da ultima noite
   - Foco: minutos focados vs meta diaria
   - Habitos: % de habitos completos hoje
   - Humor: ultimo check-in de mindset
   - Produtividade: tarefas concluidas vs criadas hoje

   Cache em Redis por 5 min — recalcula sob demanda.
═══════════════════════════════════════════════════════════════════ */

export interface MomentumBreakdown {
  score: number;           // 0-100
  sleep: number;           // 0-20
  focus: number;           // 0-20
  habits: number;          // 0-20
  mood: number;            // 0-20
  productivity: number;    // 0-20
  trend: "rising" | "stable" | "falling";
  insight: string;         // frase curta explicando o score
}

export async function getMomentumScore(userId: string): Promise<MomentumBreakdown> {
  const cacheKey = `momentum:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return JSON.parse(cached) as MomentumBreakdown;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);

  const [lastSleep, focusSessions, habits, habitLogs, lastMood, tasksDoneToday, tasksCreatedToday, yesterdayScore] = await Promise.all([
    prisma.sleepLog.findFirst({
      where: { userId, bedTime: { gte: yesterdayStart } },
      orderBy: { bedTime: "desc" },
    }),
    prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: todayStart } },
    }),
    prisma.habit.findMany({
      where: { userId, archivedAt: null },
    }),
    prisma.habitLog.findMany({
      where: { habit: { userId }, createdAt: { gte: todayStart } },
    }),
    prisma.mindsetCheckin.findFirst({
      where: { userId, createdAt: { gte: yesterdayStart } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.count({
      where: { userId, status: "done", updatedAt: { gte: todayStart } },
    }),
    prisma.task.count({
      where: { userId, createdAt: { gte: todayStart } },
    }),
    redis.get(`momentum:${userId}:${yesterdayStart.toISOString().slice(0, 10)}`).catch(() => null),
  ]);

  // ── Sono (0-20) ──
  let sleep = 10; // default meio
  if (lastSleep?.wakeTime && lastSleep?.bedTime) {
    const hours = (lastSleep.wakeTime.getTime() - lastSleep.bedTime.getTime()) / 3600000;
    const quality = lastSleep.quality ?? 3;
    const hoursScore = hours >= 7 && hours <= 9 ? 10 : hours >= 6 ? 7 : hours >= 5 ? 4 : 2;
    const qualityScore = Math.round((quality / 5) * 10);
    sleep = Math.min(20, hoursScore + qualityScore);
  }

  // ── Foco (0-20) ──
  const focusMinutes = focusSessions.reduce((s, f) => s + (f.actualMinutes ?? f.duration), 0);
  const focusGoal = 120; // 2h meta diaria
  const focus = Math.min(20, Math.round((focusMinutes / focusGoal) * 20));

  // ── Habitos (0-20) ──
  const totalHabits = habits.length || 1;
  const doneHabits = habitLogs.length;
  const habitsScore = Math.min(20, Math.round((doneHabits / totalHabits) * 20));

  // ── Humor (0-20) ──
  let mood = 10;
  if (lastMood) {
    const moodVal = lastMood.mood ?? 3;
    const energyVal = lastMood.energy ?? 3;
    mood = Math.min(20, Math.round(((moodVal + energyVal) / 10) * 20));
  }

  // ── Produtividade (0-20) ──
  const taskRatio = tasksCreatedToday > 0 ? tasksDoneToday / tasksCreatedToday : (tasksDoneToday > 0 ? 1 : 0.5);
  const productivity = Math.min(20, Math.round(taskRatio * 12) + Math.min(8, tasksDoneToday * 2));

  const score = sleep + focus + habitsScore + mood + productivity;

  // ── Trend ──
  let trend: "rising" | "stable" | "falling" = "stable";
  if (yesterdayScore) {
    const prev = (JSON.parse(yesterdayScore) as MomentumBreakdown).score;
    if (score > prev + 8) trend = "rising";
    else if (score < prev - 8) trend = "falling";
  }

  // ── Insight ──
  const weakest = [
    { name: "sono", val: sleep },
    { name: "foco", val: focus },
    { name: "habitos", val: habitsScore },
    { name: "humor", val: mood },
    { name: "produtividade", val: productivity },
  ].sort((a, b) => a.val - b.val)[0]!;

  const strongest = [
    { name: "sono", val: sleep },
    { name: "foco", val: focus },
    { name: "habitos", val: habitsScore },
    { name: "humor", val: mood },
    { name: "produtividade", val: productivity },
  ].sort((a, b) => b.val - a.val)[0]!;

  let insight: string;
  if (score >= 80) insight = `Dia excelente. ${strongest.name} esta no maximo.`;
  else if (score >= 60) insight = `Dia solido. ${weakest.name} pode melhorar.`;
  else if (score >= 40) insight = `Dia morno. Foque em ${weakest.name} pra subir.`;
  else insight = `Dia dificil. Priorize ${weakest.name} e descanse.`;

  const result: MomentumBreakdown = {
    score,
    sleep,
    focus,
    habits: habitsScore,
    mood,
    productivity,
    trend,
    insight,
  };

  await redis.set(cacheKey, JSON.stringify(result), "EX", 300).catch(() => {});
  return result;
}
