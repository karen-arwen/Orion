import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";

/* ═══════════════════════════════════════════════════════════════════
   PATTERN DETECTOR — correlações cross-module.

   Analisa dados de múltiplos módulos e detecta padrões:
   - Sono × Foco: "quando dorme <6h, sessões de foco completam 30% menos"
   - Reuniões × Humor: "dias com >4 reuniões correlacionam com humor mais baixo"
   - Hábitos × Streak: "exercício consistente correlaciona com sono melhor"
   - Produtividade × Hora: "suas melhores sessões de foco são entre 9h-11h"

   Roda no Deep Cycle (diário). Os insights são salvos como UserPattern
   e alimentam o system prompt do ORION.
═══════════════════════════════════════════════════════════════════ */

interface DetectedPattern {
  type: string;
  description: string;
  confidence: number;     // 0-1
  data: Record<string, unknown>;
  actionable: string;     // sugestão prática
}

export async function detectCrossModulePatterns(userId: string): Promise<DetectedPattern[]> {
  const patterns: DetectedPattern[] = [];
  const weekAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  // Rate limit: once per day
  const cacheKey = `pattern_detect:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const cached = await redis.exists(cacheKey);
  if (cached) return [];
  await redis.set(cacheKey, "1", "EX", 20 * 3600);

  const [sleepLogs, focusSessions, habitLogs, mindsetCheckins, tasks] = await Promise.all([
    prisma.sleepLog.findMany({
      where: { userId, bedTime: { gte: weekAgo } },
      orderBy: { bedTime: "asc" },
    }).catch(() => []),
    prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: weekAgo } },
      orderBy: { startedAt: "asc" },
    }).catch(() => []),
    prisma.habitLog.findMany({
      where: { habit: { userId }, createdAt: { gte: weekAgo } },
      include: { habit: { select: { name: true } } },
    }).catch(() => []),
    prisma.mindsetCheckin.findMany({
      where: { userId, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),
    prisma.task.findMany({
      where: { userId, status: "done", updatedAt: { gte: weekAgo } },
    }).catch(() => []),
  ]);

  // ─── Pattern 1: Sleep × Focus ───────────────────────────────────
  if (sleepLogs.length >= 3 && focusSessions.length >= 3) {
    const dayMap = new Map<string, { sleepHours: number; focusCompleted: number; focusTotal: number }>();

    for (const log of sleepLogs) {
      if (!log.wakeTime || !log.bedTime) continue;
      const day = log.wakeTime.toISOString().slice(0, 10);
      const hours = (log.wakeTime.getTime() - log.bedTime.getTime()) / 3600000;
      dayMap.set(day, { sleepHours: hours, focusCompleted: 0, focusTotal: 0 });
    }

    for (const session of focusSessions) {
      const day = session.startedAt.toISOString().slice(0, 10);
      const entry = dayMap.get(day);
      if (entry) {
        entry.focusTotal++;
        if (session.completed) entry.focusCompleted++;
      }
    }

    const entries = [...dayMap.values()].filter((e) => e.focusTotal > 0);
    if (entries.length >= 3) {
      const lowSleep = entries.filter((e) => e.sleepHours < 6.5);
      const goodSleep = entries.filter((e) => e.sleepHours >= 7);

      if (lowSleep.length >= 2 && goodSleep.length >= 2) {
        const lowRate = lowSleep.reduce((s, e) => s + e.focusCompleted / e.focusTotal, 0) / lowSleep.length;
        const goodRate = goodSleep.reduce((s, e) => s + e.focusCompleted / e.focusTotal, 0) / goodSleep.length;

        if (goodRate - lowRate > 0.15) {
          patterns.push({
            type: "sleep_focus_correlation",
            description: `Quando dorme menos de 6.5h, taxa de foco completo cai de ${Math.round(goodRate * 100)}% para ${Math.round(lowRate * 100)}%.`,
            confidence: Math.min(0.9, 0.5 + entries.length * 0.05),
            data: { lowSleepFocusRate: lowRate, goodSleepFocusRate: goodRate, sampleDays: entries.length },
            actionable: "Priorize sono de 7h+ em noites antes de dias de trabalho profundo.",
          });
        }
      }
    }
  }

  // ─── Pattern 2: Focus Time of Day ──────────────────────────────
  if (focusSessions.length >= 5) {
    const hourBuckets: Record<string, { completed: number; total: number }> = {};

    for (const session of focusSessions) {
      const hour = session.startedAt.getHours();
      const bucket = hour < 10 ? "manha_cedo" : hour < 12 ? "manha" : hour < 15 ? "tarde_cedo" : hour < 18 ? "tarde" : "noite";
      if (!hourBuckets[bucket]) hourBuckets[bucket] = { completed: 0, total: 0 };
      hourBuckets[bucket].total++;
      if (session.completed) hourBuckets[bucket].completed++;
    }

    let bestBucket = "";
    let bestRate = 0;
    for (const [bucket, data] of Object.entries(hourBuckets)) {
      if (data.total >= 2) {
        const rate = data.completed / data.total;
        if (rate > bestRate) {
          bestRate = rate;
          bestBucket = bucket;
        }
      }
    }

    if (bestBucket && bestRate > 0.6) {
      const nameMap: Record<string, string> = {
        manha_cedo: "antes das 10h",
        manha: "entre 10h e 12h",
        tarde_cedo: "entre 12h e 15h",
        tarde: "entre 15h e 18h",
        noite: "apos 18h",
      };
      patterns.push({
        type: "focus_best_time",
        description: `Melhor horario para foco: ${nameMap[bestBucket] ?? bestBucket} (${Math.round(bestRate * 100)}% de conclusao).`,
        confidence: Math.min(0.85, 0.4 + focusSessions.length * 0.03),
        data: { bestBucket, bestRate, buckets: hourBuckets },
        actionable: `Agende trabalho profundo ${nameMap[bestBucket] ?? bestBucket} para maximizar produtividade.`,
      });
    }
  }

  // ─── Pattern 3: Mood × Productivity ────────────────────────────
  if (mindsetCheckins.length >= 3 && tasks.length >= 3) {
    const dayMood = new Map<string, number>();
    const dayTasks = new Map<string, number>();

    for (const checkin of mindsetCheckins) {
      const day = checkin.createdAt.toISOString().slice(0, 10);
      dayMood.set(day, checkin.mood);
    }

    for (const task of tasks) {
      const day = task.updatedAt.toISOString().slice(0, 10);
      dayTasks.set(day, (dayTasks.get(day) ?? 0) + 1);
    }

    const paired = [...dayMood.entries()]
      .filter(([day]) => dayTasks.has(day))
      .map(([day, mood]) => ({ mood, tasks: dayTasks.get(day)! }));

    if (paired.length >= 3) {
      const avgMood = paired.reduce((s, p) => s + p.mood, 0) / paired.length;
      const highMood = paired.filter((p) => p.mood > avgMood);
      const lowMood = paired.filter((p) => p.mood <= avgMood);

      if (highMood.length >= 2 && lowMood.length >= 2) {
        const highTaskAvg = highMood.reduce((s, p) => s + p.tasks, 0) / highMood.length;
        const lowTaskAvg = lowMood.reduce((s, p) => s + p.tasks, 0) / lowMood.length;

        if (highTaskAvg > lowTaskAvg * 1.3) {
          patterns.push({
            type: "mood_productivity_correlation",
            description: `Dias com humor acima da media: ${highTaskAvg.toFixed(1)} tarefas concluidas. Abaixo: ${lowTaskAvg.toFixed(1)}.`,
            confidence: Math.min(0.8, 0.4 + paired.length * 0.04),
            data: { highMoodTasks: highTaskAvg, lowMoodTasks: lowTaskAvg, sampleDays: paired.length },
            actionable: "Nos dias de humor baixo, reduza expectativas e foque em tarefas leves.",
          });
        }
      }
    }
  }

  // ─── Pattern 4: Habit Consistency ──────────────────────────────
  if (habitLogs.length >= 5) {
    const habitCounts: Record<string, number> = {};
    for (const log of habitLogs) {
      const name = log.habit.name;
      habitCounts[name] = (habitCounts[name] ?? 0) + 1;
    }

    const totalDays = 14;
    for (const [name, count] of Object.entries(habitCounts)) {
      const rate = count / totalDays;
      if (rate < 0.3 && count >= 2) {
        patterns.push({
          type: "habit_low_consistency",
          description: `Habito "${name}": feito ${count}/${totalDays} dias (${Math.round(rate * 100)}%). Abaixo do ideal.`,
          confidence: 0.7,
          data: { habit: name, count, totalDays, rate },
          actionable: `Considere reduzir a frequencia de "${name}" ou trocar o horario para aumentar adesao.`,
        });
      }
    }
  }

  // ─── Persist patterns ──────────────────────────────────────────
  for (const pattern of patterns) {
    try {
      await prisma.userPattern.upsert({
        where: {
          userId_patternType: { userId, patternType: pattern.type },
        },
        update: {
          data: pattern.data as unknown as import("@prisma/client").Prisma.InputJsonValue,
          confidence: pattern.confidence,
          updatedAt: new Date(),
        },
        create: {
          userId,
          patternType: pattern.type,
          data: pattern.data as unknown as import("@prisma/client").Prisma.InputJsonValue,
          confidence: pattern.confidence,
        },
      });
    } catch {
      // not critical
    }
  }

  return patterns;
}
