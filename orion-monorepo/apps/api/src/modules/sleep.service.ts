import { prisma } from "../db/prisma.js";
import type { SleepStats } from "@orion/types";

/* ═══════════════════════════════════════════════════════════════════
   SLEEP COACH — log de sono + cálculo de consistência.
   Consistência: variação do horário de dormir nos últimos 7 dias.
   <30min variação = ótimo. >2h = ruim.
═══════════════════════════════════════════════════════════════════ */

export async function logSleep(opts: {
  userId: string;
  bedTime: string;
  wakeTime: string;
  quality: number;
  notes?: string;
}): Promise<unknown> {
  if (opts.quality < 1 || opts.quality > 5) throw new Error("Qualidade deve ser 1-5");
  const bed = new Date(opts.bedTime);
  const wake = new Date(opts.wakeTime);
  if (wake.getTime() <= bed.getTime()) throw new Error("Hora de acordar deve ser depois de dormir");

  return prisma.sleepLog.create({
    data: {
      userId: opts.userId,
      bedTime: bed,
      wakeTime: wake,
      quality: opts.quality,
      notes: opts.notes ?? null,
    },
  });
}

export async function recentLogs(userId: string, limit = 14): Promise<Array<{
  id: string;
  bedTime: string;
  wakeTime: string;
  quality: number;
  notes: string | null;
  createdAt: string;
  durationMin: number;
}>> {
  const rows = await prisma.sleepLog.findMany({
    where: { userId },
    orderBy: { bedTime: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    bedTime: r.bedTime.toISOString(),
    wakeTime: r.wakeTime.toISOString(),
    quality: r.quality,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    durationMin: Math.round((r.wakeTime.getTime() - r.bedTime.getTime()) / 60_000),
  }));
}

export async function stats(userId: string): Promise<SleepStats> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const rows = await prisma.sleepLog.findMany({
    where: { userId, bedTime: { gte: since } },
    select: { bedTime: true, wakeTime: true, quality: true },
  });

  if (rows.length === 0) {
    return { avgDurationMin: 0, avgQuality: 0, consistencyScore: 0, samplesLast7Days: 0 };
  }

  const durations = rows.map((r) => (r.wakeTime.getTime() - r.bedTime.getTime()) / 60_000);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const avgQual = rows.reduce((a, b) => a + b.quality, 0) / rows.length;

  // Consistência: stddev do horário de dormir (em minutos do dia)
  const bedMinutes = rows.map((r) => r.bedTime.getHours() * 60 + r.bedTime.getMinutes());
  const meanBed = bedMinutes.reduce((a, b) => a + b, 0) / bedMinutes.length;
  const variance = bedMinutes.reduce((a, b) => a + (b - meanBed) ** 2, 0) / bedMinutes.length;
  const stddev = Math.sqrt(variance);
  // 0 stddev = 100%, 120min stddev = 0%
  const consistencyScore = Math.max(0, Math.round(100 - (stddev / 120) * 100));

  return {
    avgDurationMin: Math.round(avgDuration),
    avgQuality: Math.round(avgQual * 10) / 10,
    consistencyScore,
    samplesLast7Days: rows.length,
  };
}
