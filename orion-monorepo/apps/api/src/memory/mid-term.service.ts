import { prisma } from "../db/prisma.js";
import type { Prisma } from "@prisma/client";

/* ═══════════════════════════════════════════════════════════════════
   Mid-term memory — padrões comportamentais do usuário.

   Tipos de padrão:
   - energy_peak:    horários do dia em que o usuário tem mais energia
   - module_usage:   módulos mais usados (frequência relativa)
   - response_time:  tempo médio de resposta a alertas (engajamento)
   - topic_frequency: tópicos mais conversados nas últimas semanas
═══════════════════════════════════════════════════════════════════ */

export type PatternType =
  | "energy_peak"
  | "module_usage"
  | "response_time"
  | "topic_frequency";

export interface UserPatternRecord {
  patternType: PatternType;
  data: Record<string, unknown>;
  confidence: number;
}

/** Lê todos os patterns de um usuário. */
export async function getUserPatterns(userId: string): Promise<UserPatternRecord[]> {
  const rows = await prisma.userPattern.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    patternType: r.patternType as PatternType,
    data: r.data as Record<string, unknown>,
    confidence: r.confidence,
  }));
}

/** Upsert de um pattern (chave composta userId+patternType garante 1 por tipo). */
export async function upsertPattern(
  userId: string,
  patternType: PatternType,
  data: Record<string, unknown>,
  confidence: number,
): Promise<void> {
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType } },
    create: { userId, patternType, data: data as Prisma.InputJsonValue, confidence },
    update: { data: data as Prisma.InputJsonValue, confidence },
  });
}

/**
 * Recalcula module_usage: percentual de cada módulo nas últimas 4 semanas.
 * Baseado em conversations.moduleId.
 */
export async function recomputeModuleUsage(userId: string): Promise<void> {
  const since = new Date(Date.now() - 28 * 24 * 3600 * 1000);
  const convs = await prisma.conversation.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { moduleId: true },
  });

  if (convs.length < 3) return; // dados insuficientes pra padrão confiável

  const counts: Record<string, number> = {};
  for (const c of convs) {
    const k = c.moduleId ?? "general";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const total = convs.length;
  const distribution: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    distribution[k] = Math.round((v / total) * 100) / 100;
  }
  // Confidence cresce com volume de dados
  const confidence = Math.min(1, total / 20);
  await upsertPattern(userId, "module_usage", distribution, confidence);
}

/**
 * Recalcula response_time: tempo médio entre receber alerta e responder.
 * Indicador de engajamento.
 */
export async function recomputeResponseTime(userId: string): Promise<void> {
  const since = new Date(Date.now() - 28 * 24 * 3600 * 1000);
  const alerts = await prisma.proactiveAlert.findMany({
    where: { userId, dismissed: true, createdAt: { gte: since } },
    select: { createdAt: true, priority: true },
  });

  if (alerts.length < 5) return;

  // Sem coluna respondedAt no schema atual — vamos usar updatedAt como proxy.
  // (TODO: adicionar respondedAt no proactive_alerts pra precisão real)
  const byPriority: Record<string, number> = {};
  for (const a of alerts) {
    const key = `priority_${a.priority}`;
    byPriority[key] = (byPriority[key] ?? 0) + 1;
  }
  await upsertPattern(
    userId,
    "response_time",
    {
      total: alerts.length,
      byPriority,
      sinceDays: 28,
    },
    Math.min(1, alerts.length / 30),
  );
}

/** Renderiza patterns em texto pro system prompt. */
export function renderPatternsForPrompt(patterns: UserPatternRecord[]): string {
  if (patterns.length === 0) return "(ainda coletando padrões de uso)";
  const lines: string[] = [];
  for (const p of patterns) {
    if (p.confidence < 0.2) continue; // baixa confiança, descarta
    switch (p.patternType) {
      case "module_usage": {
        const top = Object.entries(p.data)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([k, v]) => `${k}:${Math.round((v as number) * 100)}%`)
          .join(" · ");
        lines.push(`• Uso de módulos (28d): ${top}`);
        break;
      }
      case "energy_peak": {
        const peak = p.data.peakHour as number | undefined;
        if (peak !== undefined) lines.push(`• Pico de energia ~${peak}h`);
        break;
      }
      case "response_time": {
        const total = p.data.total as number | undefined;
        if (total) lines.push(`• Engajamento com alertas: ${total} interagidos em 28d`);
        break;
      }
      case "topic_frequency": {
        const top = p.data.topTopics as string[] | undefined;
        if (top && top.length > 0) lines.push(`• Tópicos recorrentes: ${top.slice(0, 5).join(", ")}`);
        break;
      }
    }
  }
  return lines.length > 0 ? lines.join("\n") : "(padrões em formação)";
}
