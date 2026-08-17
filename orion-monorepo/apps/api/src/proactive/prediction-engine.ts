import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   PREDICTION ENGINE — detecta riscos e oportunidades antes que
   o usuario perceba.

   Analisa dados cross-module e gera predicoes com probabilidade,
   impacto e sugestao de acao.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const PREDICTION_SYSTEM = `Voce e o motor preditivo do O.R.I.O.N.
Analise os dados e detecte RISCOS e OPORTUNIDADES.
Seja especifico. Use dados reais. Classifique por probabilidade (0.0-1.0) e impacto.

Devolva JSON:
{
  "predictions": [
    {
      "type": "risk" | "opportunity",
      "category": "burnout|budget|deadline|habit|sleep|career|purchase|social|health",
      "title": "titulo curto",
      "description": "explicacao com dados",
      "probability": 0.0-1.0,
      "impact": "low|medium|high|critical",
      "suggestion": "acao recomendada"
    }
  ]
}`;

export async function generatePredictions(userId: string): Promise<number> {
  const [tasks, habits, energy, sleep, finance, goals] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: { in: ["todo", "doing"] } }, take: 20 }),
    prisma.habit.findMany({ where: { userId, archivedAt: null }, include: { logs: { orderBy: { createdAt: "desc" }, take: 14 } } }),
    prisma.energyLog.findMany({ where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } } }),
    prisma.sleepLog.findMany({ where: { userId }, orderBy: { bedTime: "desc" }, take: 7 }),
    prisma.financeTransaction.findMany({ where: { userId, occurredAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } } }),
    prisma.financeGoal.findMany({ where: { userId, status: "active" } }),
  ]);

  const overdueTasks = tasks.filter((t) => t.dueAt && t.dueAt < new Date());
  const avgEnergy = energy.length > 0 ? energy.reduce((s, e) => s + e.value, 0) / energy.length : null;
  const avgSleep = sleep.length > 0 ? sleep.reduce((s, l) => s + ((l.wakeTime?.getTime() ?? 0) - l.bedTime.getTime()) / 3600000, 0) / sleep.length : null;
  const monthlySpend = finance.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  const brokenStreaks = habits.filter((h) => h.streak === 0 && h.bestStreak > 3).length;

  const ctx = {
    tasks_abertas: tasks.length,
    tasks_atrasadas: overdueTasks.length,
    energia_media_7d: avgEnergy?.toFixed(1) ?? "sem dados",
    sono_medio_7d: avgSleep ? `${avgSleep.toFixed(1)}h` : "sem dados",
    gasto_mensal: monthlySpend.toFixed(2),
    metas_financeiras: goals.map((g) => ({ nome: g.name, progresso: `${Math.round((g.currentAmount / g.targetAmount) * 100)}%`, deadline: g.deadline?.toISOString().slice(0, 10) })),
    habitos_quebrados: brokenStreaks,
    habitos_total: habits.length,
  };

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1500,
    temperature: 0.4,
    system: PREDICTION_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(ctx) }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let predictions: Array<{ type: string; category: string; title: string; description: string; probability: number; impact: string; suggestion: string }> = [];
  try {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(first, last + 1)) as { predictions: typeof predictions };
    predictions = parsed.predictions ?? [];
  } catch { /* no predictions */ }

  // Save to DB (deduplicate by title)
  let saved = 0;
  for (const pred of predictions) {
    const existing = await prisma.prediction.findFirst({
      where: { userId, title: pred.title, status: "active" },
    });
    if (!existing) {
      await prisma.prediction.create({
        data: {
          userId,
          type: pred.type,
          category: pred.category,
          title: pred.title,
          description: pred.description,
          probability: pred.probability,
          impact: pred.impact,
          signals: [ctx],
          suggestion: pred.suggestion,
        },
      });
      saved++;
    }
  }

  return saved;
}

export async function getActivePredictions(userId: string): Promise<Array<{
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  probability: number;
  impact: string;
  suggestion: string;
  createdAt: Date;
}>> {
  return prisma.prediction.findMany({
    where: { userId, status: "active" },
    orderBy: [{ probability: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true, type: true, category: true, title: true,
      description: true, probability: true, impact: true,
      suggestion: true, createdAt: true,
    },
  });
}

export async function dismissPrediction(userId: string, predictionId: string): Promise<void> {
  await prisma.prediction.updateMany({
    where: { id: predictionId, userId },
    data: { status: "dismissed" },
  });
}
