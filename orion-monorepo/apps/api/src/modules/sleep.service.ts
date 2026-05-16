import type { HealthSyncSource, SleepImportResult, SleepImportSample, SleepLog, SleepLogInput, SleepSummary } from "@orion/types";
import { prisma } from "../db/prisma.js";

function durationMinutes(bedTime: Date, wakeTime: Date): number {
  return Math.max(0, Math.round((wakeTime.getTime() - bedTime.getTime()) / 60_000));
}

function toSleepLog(row: {
  id: string;
  userId: string;
  bedTime: Date;
  wakeTime: Date;
  quality: number;
  notes: string | null;
  source: string;
  externalId: string | null;
  createdAt: Date;
}): SleepLog {
  return {
    id: row.id,
    userId: row.userId,
    bedTime: row.bedTime.toISOString(),
    wakeTime: row.wakeTime.toISOString(),
    quality: row.quality,
    notes: row.notes,
    source: row.source,
    externalId: row.externalId,
    createdAt: row.createdAt.toISOString(),
    durationMinutes: durationMinutes(row.bedTime, row.wakeTime),
  };
}

function toSyncSource(row: {
  id: string;
  provider: string;
  status: string;
  deviceName: string | null;
  lastSyncedAt: Date | null;
}): HealthSyncSource {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    deviceName: row.deviceName,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildRecommendation(logs: SleepLog[], consistencyScore: number, insufficientStreak: number): string {
  if (logs.length < 3) return "Registre pelo menos 3 noites para detectar consistencia e risco de sono insuficiente.";
  if (insufficientStreak >= 3) return "Sono abaixo de 7h por 3 noites seguidas. Priorize uma janela fixa de descanso hoje.";
  if (consistencyScore >= 85) return "Janela de sono consistente. Mantenha o horario e proteja a rotina noturna.";
  if (consistencyScore >= 60) return "Consistencia razoavel. Tente reduzir a variacao de dormir/acordar para menos de 30 minutos.";
  return "Seu horario esta oscilando muito. Defina um horario-alvo para dormir e um ritual de desaceleracao.";
}

export async function createSleepLog(userId: string, input: SleepLogInput): Promise<SleepLog> {
  const bedTime = new Date(input.bedTime);
  const wakeTime = new Date(input.wakeTime);
  if (Number.isNaN(bedTime.getTime()) || Number.isNaN(wakeTime.getTime())) {
    throw new Error("Horarios de sono invalidos.");
  }
  if (wakeTime.getTime() <= bedTime.getTime()) {
    throw new Error("O horario de acordar precisa ser depois do horario de dormir.");
  }
  const row = await prisma.sleepLog.create({
    data: {
      userId,
      bedTime,
      wakeTime,
      quality: input.quality ?? 3,
      notes: input.notes ?? null,
      source: "manual",
    },
    select: sleepSelect,
  });
  return toSleepLog(row);
}

export async function importSleepSamples(userId: string, samples: SleepImportSample[]): Promise<SleepImportResult> {
  let imported = 0;
  let skipped = 0;
  for (const sample of samples) {
    const bedTime = new Date(sample.bedTime);
    const wakeTime = new Date(sample.wakeTime);
    if (Number.isNaN(bedTime.getTime()) || Number.isNaN(wakeTime.getTime()) || wakeTime <= bedTime) {
      skipped += 1;
      continue;
    }
    await prisma.healthSyncSource.upsert({
      where: { userId_provider: { userId, provider: sample.provider } },
      create: {
        userId,
        provider: sample.provider,
        status: "connected",
        deviceName: sample.deviceName ?? null,
        lastSyncedAt: new Date(),
      },
      update: {
        status: "connected",
        deviceName: sample.deviceName ?? undefined,
        lastSyncedAt: new Date(),
      },
      select: { id: true },
    });
    const existing = await prisma.sleepLog.findFirst({
      where: {
        userId,
        source: sample.provider,
        externalId: sample.externalId,
      },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.sleepLog.create({
      data: {
        userId,
        bedTime,
        wakeTime,
        quality: sample.quality ?? 3,
        notes: sample.notes ?? null,
        source: sample.provider,
        externalId: sample.externalId,
      },
      select: { id: true },
    });
    imported += 1;
  }
  return { imported, skipped };
}

export async function deleteSleepLog(userId: string, id: string): Promise<{ id: string }> {
  const owned = await prisma.sleepLog.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Registro de sono nao encontrado.");
  await prisma.sleepLog.delete({ where: { id }, select: { id: true } });
  return { id };
}

const sleepSelect = {
  id: true,
  userId: true,
  bedTime: true,
  wakeTime: true,
  quality: true,
  notes: true,
  source: true,
  externalId: true,
  createdAt: true,
} as const;

export async function getSleepSummary(userId: string): Promise<SleepSummary> {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.sleepLog.findMany({
    where: { userId, bedTime: { gte: since } },
    orderBy: { bedTime: "desc" },
    take: 14,
    select: sleepSelect,
  });
  const logs = rows.map(toSleepLog);
  const syncSources = await prisma.healthSyncSource.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, provider: true, status: true, deviceName: true, lastSyncedAt: true },
  });
  const completedDurations = logs.map((log) => log.durationMinutes);
  const averageMinutes = completedDurations.length
    ? Math.round(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length)
    : 0;
  const wakeDeviation = standardDeviation(rows.map((row) => minutesFromMidnight(row.wakeTime)));
  const bedDeviation = standardDeviation(rows.map((row) => minutesFromMidnight(row.bedTime)));
  const consistencyScore = Math.max(0, Math.round(100 - Math.min(100, (wakeDeviation + bedDeviation) / 2)));
  let insufficientSleepStreak = 0;
  for (const log of logs) {
    if (log.durationMinutes >= 420) break;
    insufficientSleepStreak += 1;
  }

  return {
    logs,
    syncSources: syncSources.map(toSyncSource),
    averageMinutes,
    consistencyScore,
    insufficientSleepStreak,
    recommendation: buildRecommendation(logs, consistencyScore, insufficientSleepStreak),
  };
}
