import type { EnergyLog, EnergyLogInput, EnergyPattern, EnergySummary } from "@orion/types";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

function startOfLocalDay(timezone: string, date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string): string => parts.find((entry) => entry.type === type)?.value ?? "";
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000-03:00`);
}

function toEnergyLog(row: {
  id: string;
  userId: string;
  value: number;
  note: string | null;
  createdAt: Date;
}): EnergyLog {
  return {
    id: row.id,
    userId: row.userId,
    value: row.value,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function hourInTimezone(date: Date, timezone: string): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(date),
  );
}

function findPattern(
  rows: Array<{ value: number; createdAt: Date }>,
  timezone: string,
  mode: "low" | "peak",
): EnergyPattern | null {
  const buckets = new Map<number, { total: number; count: number }>();
  for (const row of rows) {
    const hour = hourInTimezone(row.createdAt, timezone);
    const current = buckets.get(hour) ?? { total: 0, count: 0 };
    buckets.set(hour, { total: current.total + row.value, count: current.count + 1 });
  }

  const candidates = Array.from(buckets.entries())
    .filter(([, bucket]) => bucket.count >= 2)
    .map(([hour, bucket]) => ({
      hour,
      average: bucket.total / bucket.count,
      sampleSize: bucket.count,
      confidence: Math.min(0.95, bucket.count / 7),
    }));

  if (candidates.length === 0) return null;
  const sorted = candidates.sort((a, b) => (mode === "low" ? a.average - b.average : b.average - a.average));
  const selected = sorted[0];
  if (!selected) return null;
  return {
    label: mode === "low" ? "queda de energia" : "pico de energia",
    hour: selected.hour,
    average: Number(selected.average.toFixed(1)),
    confidence: Number(selected.confidence.toFixed(2)),
    sampleSize: selected.sampleSize,
  };
}

function buildRecommendation(low: EnergyPattern | null, peak: EnergyPattern | null): string {
  if (low && peak) {
    return `Seu melhor bloco parece ser por volta de ${peak.hour}h. Evite tarefas pesadas perto de ${low.hour}h e use esse horario para pausa, revisao leve ou organizacao.`;
  }
  if (peak) return `Ha sinal de pico por volta de ${peak.hour}h. Coloque tarefas cognitivas nesse bloco.`;
  if (low) return `Ha sinal de queda por volta de ${low.hour}h. Agende pausa curta antes desse horario.`;
  return "Ainda preciso de mais registros para detectar padroes. Registre energia 2-3 vezes ao dia por uma semana.";
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function createEnergyLog(userId: string, input: EnergyLogInput): Promise<EnergyLog> {
  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  const row = await prisma.energyLog.create({
    data: {
      userId,
      value: Math.max(1, Math.min(10, Math.round(input.value))),
      note: input.note?.trim() || null,
      createdAt,
    },
    select: { id: true, userId: true, value: true, note: true, createdAt: true },
  });
  return toEnergyLog(row);
}

export async function getEnergySummary(userId: string, timezone: string): Promise<EnergySummary> {
  const todayStart = startOfLocalDay(timezone);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.energyLog.findMany({
    where: { userId, createdAt: { gte: weekStart } },
    select: { id: true, userId: true, value: true, note: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const low = findPattern(rows, timezone, "low");
  const peak = findPattern(rows, timezone, "peak");

  await Promise.all(
    [low, peak]
      .filter((pattern): pattern is EnergyPattern => pattern !== null)
      .map((pattern) =>
        prisma.userPattern.upsert({
          where: {
            userId_patternType: {
              userId,
              patternType: pattern.label === "queda de energia" ? "energy_low" : "energy_peak",
            },
          },
          create: {
            userId,
            patternType: pattern.label === "queda de energia" ? "energy_low" : "energy_peak",
            data: asJson(pattern),
            confidence: pattern.confidence,
          },
          update: { data: asJson(pattern), confidence: pattern.confidence },
        }),
      ),
  );

  return {
    today: rows.filter((row) => row.createdAt >= todayStart).map(toEnergyLog),
    week: rows.map(toEnergyLog),
    lowEnergyPattern: low,
    peakEnergyPattern: peak,
    recommendation: buildRecommendation(low, peak),
  };
}
