import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   SELF-REFLECTION — o ORION reflete sobre o usuario periodicamente.

   Daily: o que aprendi, riscos imediatos, oportunidades
   Weekly: padroes da semana, metas em risco, sugestoes
   Monthly: evolucao do mes, conquistas, ajustes estrategicos
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const REFLECTION_SYSTEM = `Voce e o sistema de auto-reflexao do O.R.I.O.N.
Analise os dados do usuario e gere insights CONCRETOS e ACIONAVEIS.
Nao seja generico. Use os dados reais fornecidos.

Devolva APENAS JSON valido:
{
  "insights": [{"pattern": "o que voce percebeu", "suggestion": "o que sugere", "priority": "high|medium|low"}],
  "risks": [{"title": "risco detectado", "probability": 0.0-1.0, "impact": "low|medium|high|critical", "action": "o que fazer"}],
  "opportunities": [{"title": "oportunidade", "value": "por que importa", "action": "proximo passo"}],
  "suggestions": [{"type": "automation|habit|goal|notification|routine", "detail": "sugestao especifica"}]
}`;

export async function runDailyReflection(userId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  // Check if already ran today
  const existing = await prisma.reflection.findUnique({
    where: { userId_type_period: { userId, type: "daily", period: today } },
  });
  if (existing) return "Reflexao diaria ja gerada hoje.";

  // Gather cross-module data
  const [tasks, habits, energy, sleep, finance, memories] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: { in: ["todo", "doing"] } }, take: 15 }),
    prisma.habit.findMany({ where: { userId, archivedAt: null }, include: { logs: { orderBy: { createdAt: "desc" }, take: 7 } } }),
    prisma.energyLog.findMany({ where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
    prisma.sleepLog.findMany({ where: { userId }, orderBy: { bedTime: "desc" }, take: 3 }),
    prisma.financeTransaction.findMany({ where: { userId, occurredAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }, orderBy: { occurredAt: "desc" }, take: 20 }),
    prisma.memory.findMany({ where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } }, take: 10 }),
  ]);

  const avgEnergy = energy.length > 0
    ? (energy.reduce((s, e) => s + e.value, 0) / energy.length).toFixed(1)
    : "sem dados";

  const totalSpent = finance.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  const ctx = {
    date: today,
    tasks_abertas: tasks.length,
    tasks_doing: tasks.filter((t) => t.status === "doing").length,
    habitos_total: habits.length,
    habitos_feitos_hoje: habits.filter((h) => h.logs.some((l) => l.createdAt.toISOString().startsWith(today))).length,
    energia_media_hoje: avgEnergy,
    ultimo_sono: sleep[0] ? { duracao_min: Math.round((sleep[0].wakeTime!.getTime() - sleep[0].bedTime.getTime()) / 60000), qualidade: sleep[0].quality } : null,
    gasto_semanal: totalSpent.toFixed(2),
    memorias_novas: memories.length,
    top_categorias_gasto: [...new Set(finance.map((t) => t.category))].slice(0, 5),
  };

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1500,
    temperature: 0.5,
    system: REFLECTION_SYSTEM,
    messages: [{ role: "user", content: `Reflexao DIARIA para ${today}:\n${JSON.stringify(ctx, null, 2)}` }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let parsed: { insights: unknown[]; risks: unknown[]; opportunities: unknown[]; suggestions: unknown[] };
  try {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    parsed = JSON.parse(text.slice(first, last + 1));
  } catch {
    parsed = { insights: [], risks: [], opportunities: [], suggestions: [{ type: "manual", detail: text }] };
  }

  await prisma.reflection.create({
    data: {
      userId,
      type: "daily",
      period: today,
      insights: parsed.insights as object[],
      risks: parsed.risks as object[],
      opportunities: parsed.opportunities as object[],
      suggestions: parsed.suggestions as object[],
    },
  });

  return `Reflexao diaria gerada com ${(parsed.insights as unknown[]).length} insights, ${(parsed.risks as unknown[]).length} riscos, ${(parsed.opportunities as unknown[]).length} oportunidades.`;
}

export async function getLatestReflection(userId: string, type: "daily" | "weekly" | "monthly"): Promise<{
  period: string;
  insights: unknown[];
  risks: unknown[];
  opportunities: unknown[];
  suggestions: unknown[];
  createdAt: Date;
} | null> {
  const reflection = await prisma.reflection.findFirst({
    where: { userId, type },
    orderBy: { createdAt: "desc" },
  });
  if (!reflection) return null;
  return {
    period: reflection.period,
    insights: reflection.insights as unknown[],
    risks: reflection.risks as unknown[],
    opportunities: reflection.opportunities as unknown[],
    suggestions: reflection.suggestions as unknown[],
    createdAt: reflection.createdAt,
  };
}
