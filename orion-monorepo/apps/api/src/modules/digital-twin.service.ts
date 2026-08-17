import { prisma } from "../db/prisma.js";

/**
 * Digital Twin — perfil preditivo que aprende padrões comportamentais.
 * Alimentado automaticamente pelo cognitive loop e pelas interações do usuário.
 */

export interface TwinProfile {
  peakHours: number[];
  lowHours: number[];
  procrastinationMap: Record<string, number>;
  spendingPatterns: Record<string, number>;
  sleepPatterns: { avgBed: string; avgWake: string; avgDuration: number } | null;
  studyPatterns: { bestTime: string; bestDuration: number; bestMethod: string } | null;
  emotionalPatterns: { triggers: string[]; coping: string[]; moodCycle: string } | null;
  communicationStyle: Record<string, unknown> | null;
  values: string[];
  limitations: string[];
  strengths: string[];
}

/** Obter ou criar perfil do Digital Twin */
export async function getTwinProfile(userId: string): Promise<TwinProfile> {
  const existing = await prisma.digitalTwinProfile.findUnique({ where: { userId } });

  if (existing) {
    return {
      peakHours: (existing.peakHours as number[]) ?? [],
      lowHours: (existing.lowHours as number[]) ?? [],
      procrastinationMap: (existing.procrastinationMap as Record<string, number>) ?? {},
      spendingPatterns: (existing.spendingPatterns as Record<string, number>) ?? {},
      sleepPatterns: existing.sleepPatterns as TwinProfile["sleepPatterns"],
      studyPatterns: existing.studyPatterns as TwinProfile["studyPatterns"],
      emotionalPatterns: existing.emotionalPatterns as TwinProfile["emotionalPatterns"],
      communicationStyle: existing.communicationStyle as Record<string, unknown> | null,
      values: existing.values,
      limitations: existing.limitations,
      strengths: existing.strengths,
    };
  }

  // Criar perfil vazio
  await prisma.digitalTwinProfile.create({
    data: { userId, values: [], limitations: [], strengths: [] },
  });

  return {
    peakHours: [], lowHours: [], procrastinationMap: {}, spendingPatterns: {},
    sleepPatterns: null, studyPatterns: null, emotionalPatterns: null, communicationStyle: null,
    values: [], limitations: [], strengths: [],
  };
}

/** Atualizar perfil parcialmente */
export async function updateTwinProfile(userId: string, data: Partial<Record<string, unknown>>) {
  return prisma.digitalTwinProfile.upsert({
    where: { userId },
    create: {
      userId,
      values: (data.values as string[]) ?? [],
      limitations: (data.limitations as string[]) ?? [],
      strengths: (data.strengths as string[]) ?? [],
      ...(data.peakHours && { peakHours: data.peakHours }),
      ...(data.lowHours && { lowHours: data.lowHours }),
      ...(data.procrastinationMap && { procrastinationMap: data.procrastinationMap }),
      ...(data.spendingPatterns && { spendingPatterns: data.spendingPatterns }),
      ...(data.sleepPatterns && { sleepPatterns: data.sleepPatterns }),
      ...(data.studyPatterns && { studyPatterns: data.studyPatterns }),
      ...(data.emotionalPatterns && { emotionalPatterns: data.emotionalPatterns }),
      ...(data.communicationStyle && { communicationStyle: data.communicationStyle }),
    },
    update: {
      ...(data.values && { values: data.values as string[] }),
      ...(data.limitations && { limitations: data.limitations as string[] }),
      ...(data.strengths && { strengths: data.strengths as string[] }),
      ...(data.peakHours && { peakHours: data.peakHours }),
      ...(data.lowHours && { lowHours: data.lowHours }),
      ...(data.procrastinationMap && { procrastinationMap: data.procrastinationMap }),
      ...(data.spendingPatterns && { spendingPatterns: data.spendingPatterns }),
      ...(data.sleepPatterns && { sleepPatterns: data.sleepPatterns }),
      ...(data.studyPatterns && { studyPatterns: data.studyPatterns }),
      ...(data.emotionalPatterns && { emotionalPatterns: data.emotionalPatterns }),
      ...(data.communicationStyle && { communicationStyle: data.communicationStyle }),
    },
  });
}

/**
 * Análise automática — calcula padrões com base nos dados existentes.
 * Chamado periodicamente pelo cognitive loop.
 */
export async function analyzeTwinPatterns(userId: string) {
  // Analisar horários de foco
  const focusSessions = await prisma.focusSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 100,
    select: { startedAt: true, duration: true, mode: true },
  });

  const hourCounts: Record<number, { total: number; productive: number }> = {};
  for (const s of focusSessions) {
    const hour = new Date(s.startedAt).getHours();
    if (!hourCounts[hour]) hourCounts[hour] = { total: 0, productive: 0 };
    hourCounts[hour].total++;
    if (s.duration > 25) hourCounts[hour].productive++;
  }

  const peakHours = Object.entries(hourCounts)
    .filter(([, v]) => v.productive / v.total > 0.6)
    .map(([h]) => Number(h))
    .sort((a, b) => a - b);

  const lowHours = Object.entries(hourCounts)
    .filter(([, v]) => v.productive / v.total < 0.3)
    .map(([h]) => Number(h))
    .sort((a, b) => a - b);

  // Analisar sono
  const sleepLogs = await prisma.sleepLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 30,
    select: { bedtime: true, wakeTime: true, duration: true },
  });

  let sleepPatterns: TwinProfile["sleepPatterns"] = null;
  if (sleepLogs.length >= 7) {
    const avgDuration = sleepLogs.reduce((s, l) => s + (l.duration ?? 0), 0) / sleepLogs.length;
    sleepPatterns = {
      avgBed: sleepLogs[0]?.bedtime ?? "23:00",
      avgWake: sleepLogs[0]?.wakeTime ?? "07:00",
      avgDuration: Math.round(avgDuration * 10) / 10,
    };
  }

  // Analisar gastos
  const transactions = await prisma.financeTransaction.findMany({
    where: { userId, type: "EXPENSE" },
    orderBy: { date: "desc" },
    take: 200,
    select: { category: true, amount: true },
  });

  const spendingPatterns: Record<string, number> = {};
  for (const t of transactions) {
    const cat = t.category ?? "outros";
    spendingPatterns[cat] = (spendingPatterns[cat] ?? 0) + Number(t.amount);
  }

  // Analisar hábitos para strengths/limitations
  const habits = await prisma.habit.findMany({
    where: { userId },
    select: { name: true, currentStreak: true, bestStreak: true },
  });

  const strengths = habits
    .filter((h) => (h.currentStreak ?? 0) >= 7)
    .map((h) => h.name);

  const limitations = habits
    .filter((h) => (h.bestStreak ?? 0) > 7 && (h.currentStreak ?? 0) < 3)
    .map((h) => `Dificuldade com: ${h.name}`);

  // Salvar tudo
  await updateTwinProfile(userId, {
    peakHours,
    lowHours,
    sleepPatterns,
    spendingPatterns,
    strengths: strengths.length > 0 ? strengths : undefined,
    limitations: limitations.length > 0 ? limitations : undefined,
  });

  return { peakHours, lowHours, sleepPatterns, spendingPatterns, strengths, limitations };
}
