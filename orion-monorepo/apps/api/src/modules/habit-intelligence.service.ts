import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   HABIT INTELLIGENCE — o ORION cuida dos seus hábitos.

   - Detecta quebra de streak e pergunta se tá tudo bem
   - Sugere ajuste de frequência baseado em padrão real
   - Identifica melhores horários para cada hábito
   - Gera triggers proativos para o Trigger Engine
═══════════════════════════════════════════════════════════════════ */

interface HabitInsight {
  habitId: string;
  habitName: string;
  type: "streak_broken" | "low_consistency" | "suggest_reduce" | "suggest_increase" | "celebrate";
  message: string;
  data: Record<string, unknown>;
}

export async function analyzeHabits(userId: string): Promise<HabitInsight[]> {
  const insights: HabitInsight[] = [];
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  const habits = await prisma.habit.findMany({
    where: { userId, archivedAt: null },
    include: {
      logs: {
        where: { createdAt: { gte: twoWeeksAgo } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  for (const habit of habits) {
    const thisWeek = habit.logs.filter((l) => l.createdAt >= weekAgo).length;
    const lastWeek = habit.logs.filter((l) => l.createdAt < weekAgo).length;
    const expected = habit.frequency === "daily" ? 7 : habit.frequency === "weekly" ? 1 : 7;
    const rate = thisWeek / expected;

    // Streak broken: had good streak but missed recently
    if (habit.streak === 0 && habit.bestStreak >= 3 && lastWeek >= 3) {
      insights.push({
        habitId: habit.id,
        habitName: habit.name,
        type: "streak_broken",
        message: `"${habit.name}" tinha streak de ${habit.bestStreak} dias mas parou. Tudo bem? Quer ajustar a frequencia?`,
        data: { bestStreak: habit.bestStreak, lastWeekCount: lastWeek, thisWeekCount: thisWeek },
      });
    }

    // Low consistency: doing less than 40% of expected
    if (rate < 0.4 && thisWeek >= 1) {
      insights.push({
        habitId: habit.id,
        habitName: habit.name,
        type: "low_consistency",
        message: `"${habit.name}": ${thisWeek}/${expected} esta semana (${Math.round(rate * 100)}%). Quer reduzir pra ${Math.max(1, Math.ceil(expected * 0.5))}x/semana?`,
        data: { thisWeek, expected, rate },
      });
    }

    // Suggest reduce: consistently doing ~50% for 2+ weeks
    if (rate >= 0.3 && rate <= 0.6 && lastWeek > 0) {
      const lastRate = lastWeek / expected;
      if (lastRate >= 0.3 && lastRate <= 0.6) {
        insights.push({
          habitId: habit.id,
          habitName: habit.name,
          type: "suggest_reduce",
          message: `"${habit.name}" esta consistente em ~${Math.round(rate * 100)}% ha 2 semanas. Ajustar meta pra ${Math.ceil(expected * rate)}x por semana pode ser mais realista.`,
          data: { currentRate: rate, previousRate: lastRate },
        });
      }
    }

    // Celebrate: perfect or near-perfect week
    if (rate >= 0.9 && thisWeek >= 5) {
      insights.push({
        habitId: habit.id,
        habitName: habit.name,
        type: "celebrate",
        message: `"${habit.name}": ${thisWeek}/${expected} esta semana! Streak: ${habit.streak} dias.`,
        data: { thisWeek, streak: habit.streak },
      });
    }
  }

  return insights;
}
