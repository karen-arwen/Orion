import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";
import type { AlertPriority } from "@orion/types";

/* ═══════════════════════════════════════════════════════════════════
   WEEKLY REVIEW — relatório semanal inteligente gerado por Claude.

   Roda no sábado de manhã. Analisa a semana inteira:
   - Tarefas concluídas vs planejadas
   - Padrões de sono, foco e hábitos
   - Insights de produtividade
   - Sugestões para a próxima semana
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const REVIEW_SYSTEM = `Voce e o O.R.I.O.N — assistente pessoal autonomo.

Gere uma REVISAO SEMANAL concisa e acionavel. Nao e um relatorio corporativo — e uma conversa honesta sobre como a semana foi.

ESTILO:
- Tom de parceiro que se importa. Celebre vitorias reais, aponte problemas sem julgamento.
- Maximo 6 paragrafos. Dados concretos, nao generalidades.
- Termine com 3 sugestoes praticas para a proxima semana.

CONTEUDO:
1. O que foi conquistado (tarefas, habitos, foco)
2. O que ficou pendente e por que
3. Padroes detectados (sono, energia, produtividade)
4. Um insight surpresa (algo que os dados revelam que o usuario talvez nao perceba)
5. Plano sugerido para a proxima semana

FORMATO: texto puro, sem JSON, sem markdown headers.`;

export async function generateWeeklyReview(userId: string): Promise<{
  text: string;
  stats: {
    tasksCompleted: number;
    tasksPending: number;
    focusMinutes: number;
    habitCompletionRate: number;
    avgSleepHours: number;
  };
} | null> {
  const weekKey = `weekly_review:${userId}:${getWeekId()}`;
  const cached = await redis.get(weekKey).catch(() => null);
  if (cached) return JSON.parse(cached) as ReturnType<typeof generateWeeklyReview> extends Promise<infer T> ? T : never;

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [user, tasksCompleted, tasksPending, focusSessions, habitLogs, sleepLogs, conversations, snapshot] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    prisma.task.count({ where: { userId, status: "done", updatedAt: { gte: weekAgo } } }),
    prisma.task.count({ where: { userId, status: { in: ["todo", "doing"] } } }),
    prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: weekAgo } },
      take: 50,
    }),
    prisma.habitLog.findMany({
      where: { habit: { userId }, createdAt: { gte: weekAgo } },
      include: { habit: { select: { name: true } } },
      take: 100,
    }),
    prisma.sleepLog.findMany({
      where: { userId, bedTime: { gte: weekAgo } },
      orderBy: { bedTime: "desc" },
      take: 7,
    }),
    prisma.conversation.findMany({
      where: { userId, updatedAt: { gte: weekAgo } },
      select: { title: true, moduleId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    captureBrainSnapshot(userId).catch(() => null),
  ]);

  if (!user) return null;

  // Calculate stats
  const focusCompleted = focusSessions.filter((f) => f.completed).length;
  const focusMinutes = focusSessions.reduce((s, f) => s + (f.actualMinutes ?? f.duration), 0);

  const totalHabits = await prisma.habit.count({ where: { userId, archivedAt: null } });
  const habitDays = 7;
  const expectedLogs = totalHabits * habitDays;
  const habitCompletionRate = expectedLogs > 0 ? Math.round((habitLogs.length / expectedLogs) * 100) : 0;

  const avgSleepHours = sleepLogs.length > 0
    ? Math.round(sleepLogs.reduce((s, l) => {
        const hrs = l.wakeTime && l.bedTime ? (l.wakeTime.getTime() - l.bedTime.getTime()) / 3600000 : 0;
        return s + hrs;
      }, 0) / sleepLogs.length * 10) / 10
    : 0;

  const avgSleepQuality = sleepLogs.length > 0
    ? Math.round(sleepLogs.reduce((s, l) => s + (l.quality ?? 0), 0) / sleepLogs.length * 10) / 10
    : 0;

  // Build habit breakdown
  const habitBreakdown: Record<string, number> = {};
  for (const log of habitLogs) {
    const name = log.habit.name;
    habitBreakdown[name] = (habitBreakdown[name] ?? 0) + 1;
  }

  const brainText = snapshot ? renderBrainContext(snapshot) : "";

  const prompt = `
REVISAO SEMANAL PARA ${user.name.toUpperCase()}
Semana: ${weekAgo.toLocaleDateString("pt-BR")} a ${new Date().toLocaleDateString("pt-BR")}

TAREFAS:
- Concluidas: ${tasksCompleted}
- Ainda pendentes: ${tasksPending}

FOCO:
- ${focusSessions.length} sessoes (${focusCompleted} completas)
- ${focusMinutes} minutos totais de foco

HABITOS (${habitCompletionRate}% de adesao):
${Object.entries(habitBreakdown).map(([name, count]) => `- ${name}: ${count}/7 dias`).join("\n") || "Sem dados"}

SONO (media: ${avgSleepHours}h, qualidade: ${avgSleepQuality}/5):
${sleepLogs.map((s) => {
  const hrs = s.wakeTime && s.bedTime ? ((s.wakeTime.getTime() - s.bedTime.getTime()) / 3600000).toFixed(1) : "?";
  return `- ${s.bedTime.toLocaleDateString("pt-BR")}: ${hrs}h, qualidade ${s.quality ?? "?"}/5`;
}).join("\n") || "Sem registros"}

CONVERSAS COM ORION (${conversations.length} na semana):
${conversations.map((c) => `- ${c.updatedAt.toLocaleDateString("pt-BR")}: ${c.title ?? c.moduleId ?? "geral"}`).join("\n") || "Nenhuma"}

CONTEXTO GERAL:
${brainText || "—"}

Gere a revisao semanal.`.trim();

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: REVIEW_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    if (!text) return null;

    const result = {
      text,
      stats: { tasksCompleted, tasksPending, focusMinutes, habitCompletionRate, avgSleepHours },
    };

    await redis.set(weekKey, JSON.stringify(result), "EX", 48 * 3600).catch(() => {});
    return result;
  } catch (err) {
    console.warn("[weekly-review] Claude falhou:", (err as Error).message);
    return null;
  }
}

export async function createWeeklyReviewAlert(userId: string): Promise<void> {
  const review = await generateWeeklyReview(userId);
  if (!review) return;

  const dedupKey = `weekly_review_${getWeekId()}`;
  const exists = await prisma.proactiveAlert.findFirst({ where: { userId, dedupKey } }).catch(() => null);
  if (exists) return;

  const statsLine = `Tarefas: ${review.stats.tasksCompleted} feitas | Foco: ${review.stats.focusMinutes}min | Habitos: ${review.stats.habitCompletionRate}% | Sono: ${review.stats.avgSleepHours}h`;

  await prisma.proactiveAlert.create({
    data: {
      userId,
      module: "life",
      icon: "WKR",
      color: "#7C3AED",
      title: "Weekly Review",
      text: `${statsLine}\n\n${review.text}`,
      action: "Ver LIFE OS",
      priority: "medium" as AlertPriority,
      dedupKey,
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    },
  });
}

function getWeekId(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
