import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   SAÚDE — Logging de energia + detecção de padrões.

   - logEnergy(value, note): grava ponto na timeline
   - getDay(date): retorna logs do dia
   - getWeekHeatmap(): retorna 7 dias agrupados por hora (heatmap)
   - detectLowEnergyHour(): identifica horário com energia baixa repetida
═══════════════════════════════════════════════════════════════════ */

export async function logEnergy(
  userId: string,
  value: number,
  note?: string,
): Promise<{ id: string }> {
  if (value < 1 || value > 10) throw new Error("Energia deve ser 1-10");
  const log = await prisma.energyLog.create({
    data: { userId, value, note: note ?? null },
    select: { id: true },
  });
  return log;
}

export async function getEnergyDay(userId: string, isoDate?: string): Promise<Array<{
  id: string;
  value: number;
  note: string | null;
  createdAt: string;
}>> {
  const day = isoDate ? new Date(isoDate) : new Date();
  day.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const rows = await prisma.energyLog.findMany({
    where: { userId, createdAt: { gte: day, lte: end } },
    orderBy: { createdAt: "asc" },
    select: { id: true, value: true, note: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    value: r.value,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface HeatmapCell {
  date: string;
  hour: number;
  avg: number;
  samples: number;
}

export async function getWeekHeatmap(userId: string): Promise<HeatmapCell[]> {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const rows = await prisma.energyLog.findMany({
    where: { userId, createdAt: { gte: start } },
    select: { value: true, createdAt: true },
  });

  // agrupa por (date, hour)
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const date = r.createdAt.toISOString().slice(0, 10);
    const hour = r.createdAt.getHours();
    const key = `${date}|${hour}`;
    const b = buckets.get(key) ?? { sum: 0, count: 0 };
    b.sum += r.value;
    b.count += 1;
    buckets.set(key, b);
  }

  return Array.from(buckets.entries()).map(([key, b]) => {
    const parts = key.split("|");
    return {
      date: parts[0] ?? "",
      hour: parseInt(parts[1] ?? "0", 10),
      avg: b.sum / b.count,
      samples: b.count,
    };
  });
}

/** Hora do dia com energia média < 4 em pelo menos 3 dias dos últimos 14. */
export async function detectLowEnergyHour(userId: string): Promise<number | null> {
  const start = new Date();
  start.setDate(start.getDate() - 14);

  const rows = await prisma.energyLog.findMany({
    where: { userId, createdAt: { gte: start } },
    select: { value: true, createdAt: true },
  });

  const byHour = new Map<number, { sum: number; days: Set<string>; count: number }>();
  for (const r of rows) {
    const hour = r.createdAt.getHours();
    const date = r.createdAt.toISOString().slice(0, 10);
    const b = byHour.get(hour) ?? { sum: 0, days: new Set<string>(), count: 0 };
    b.sum += r.value;
    b.count += 1;
    b.days.add(date);
    byHour.set(hour, b);
  }

  for (const [hour, b] of byHour.entries()) {
    if (b.days.size >= 3 && b.sum / b.count < 4) return hour;
  }
  return null;
}
