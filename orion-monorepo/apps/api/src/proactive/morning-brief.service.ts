import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";
import { searchRelevantMemories, renderMemoriesForPrompt } from "../memory/long-term.service.js";
import type { AlertPriority } from "@orion/types";
import { predictDay } from "./predictive-engine.js";

/* ═══════════════════════════════════════════════════════════════════
   MORNING BRIEF — briefing matinal inteligente gerado por Claude.

   Em vez de "você tem 3 tarefas", o ORION:
   - Analisa o dia, a semana, os padrões de sono e foco
   - Prioriza o que importa de verdade
   - Sugere como atacar o dia
   - Tom personalizado baseado no perfil comportamental
   - Gera um briefing que o usuário QUER ler
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const BRIEF_SYSTEM = `Você é o O.R.I.O.N — assistente pessoal autônomo.

Gere um BRIEFING MATINAL conciso e acionável para o usuário.

ESTILO:
- Tom direto, confiante, levemente casual. Como um chief of staff que conhece a pessoa.
- NÃO USE "bom dia" genérico. Se sabe o nome, use. Se sabe algo da noite anterior, mencione.
- Máximo 4-5 parágrafos curtos. Bullet points só se necessário.
- Termine com UMA pergunta ou sugestão prática.

CONTEÚDO OBRIGATÓRIO (se houver dados):
1. O que importa hoje (eventos + tarefas prioritárias)
2. Contexto relevante (quem é a pessoa da reunião, história do projeto, etc.)
3. Alertas de padrão (sono, foco, hábitos — só se relevante, não lecture)
4. Uma oportunidade ou insight do dia

FORMATO: texto puro, sem JSON, sem markdown headers. É pra ler como uma mensagem pessoal.`;

interface BriefData {
  userId: string;
  userName: string;
  mode: string;
  brainContext: string;
  tasks: Array<{ title: string; priority: number; dueAt: Date | null }>;
  events: Array<{ title: string; startTime: Date; endTime: Date }>;
  recentSleep: Array<{ bedTime: Date; wakeTime: Date | null; quality: number | null }>;
  focusStats: { completed: number; total: number };
  habits: Array<{ name: string; doneToday: boolean }>;
  memories: string;
  yesterday: string;
}

export async function generateMorningBrief(userId: string): Promise<{
  text: string;
  stats: { tasks: number; events: number; focusRate: string };
} | null> {
  // Dedup — 1 brief por dia
  const todayKey = `morning_brief:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const cached = await redis.get(todayKey).catch(() => null);
  if (cached) return JSON.parse(cached) as { text: string; stats: { tasks: number; events: number; focusRate: string } };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [user, tasks, sleepLogs, focusSessions, habitLogs, snapshot, memories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    }),
    prisma.task.findMany({
      where: { userId, status: { in: ["todo", "doing"] } },
      orderBy: { priority: "desc" },
      take: 10,
    }),
    prisma.sleepLog.findMany({
      where: { userId, bedTime: { gte: weekAgo } },
      orderBy: { bedTime: "desc" },
      take: 5,
    }),
    prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: weekAgo } },
      take: 20,
    }),
    prisma.habitLog.findMany({
      where: {
        habit: { userId },
        createdAt: { gte: todayStart },
      },
      include: { habit: { select: { name: true } } },
    }),
    captureBrainSnapshot(userId).catch(() => null),
    searchRelevantMemories(userId, "morning context priorities goals").catch(() => []),
  ]);

  if (!user) return null;

  const brainText = snapshot ? renderBrainContext(snapshot) : "";
  const memText = memories.length > 0 ? renderMemoriesForPrompt(memories) : "";

  // Buscar hábitos do usuário e marcar quais já foram feitos hoje
  const allHabits = await prisma.habit.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, name: true },
  }).catch(() => []);

  const doneHabitIds = new Set(habitLogs.map((l) => l.habitId));
  const habitsWithStatus = allHabits.map((h) => ({
    name: h.name,
    doneToday: doneHabitIds.has(h.id),
  }));

  // Buscar último conversation pra saber o que aconteceu ontem
  const lastConv = await prisma.conversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 2 } },
  }).catch(() => null);

  const yesterdayContext = lastConv?.messages?.[0]?.content?.slice(0, 300) ?? "";

  // Montar prompt
  const focusCompleted = focusSessions.filter((f) => f.completed).length;
  const focusRate = focusSessions.length > 0
    ? `${Math.round((focusCompleted / focusSessions.length) * 100)}%`
    : "sem dados";

  const taskBlock = tasks.length > 0
    ? tasks.map((t) => {
        const due = t.dueAt ? ` (vence ${t.dueAt.toLocaleDateString("pt-BR")})` : "";
        return `- [P${t.priority}] ${t.title}${due}`;
      }).join("\n")
    : "Nenhuma tarefa em aberto.";

  const sleepBlock = sleepLogs.length > 0
    ? sleepLogs.slice(0, 3).map((s) => {
        const hours = s.wakeTime && s.bedTime
          ? ((s.wakeTime.getTime() - s.bedTime.getTime()) / 3600000).toFixed(1)
          : "?";
        return `${s.bedTime.toLocaleDateString("pt-BR")}: ${hours}h, qualidade ${s.quality ?? "?"}/5`;
      }).join("; ")
    : "Sem registros.";

  const habitBlock = habitsWithStatus.length > 0
    ? habitsWithStatus.map((h) => `${h.doneToday ? "✓" : "○"} ${h.name}`).join(", ")
    : "Sem hábitos ativos.";

  const prompt = `
═══ BRIEFING MATINAL PARA ${user.name.toUpperCase()} ═══
Data: ${now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
Modo: ${user.mode}

═══ TAREFAS ABERTAS ═══
${taskBlock}

═══ SONO RECENTE ═══
${sleepBlock}

═══ FOCO (7 dias) ═══
${focusCompleted}/${focusSessions.length} sessões completadas (${focusRate})

═══ HÁBITOS HOJE ═══
${habitBlock}

═══ CONTEXTO DO BRAIN ═══
${brainText || "—"}

═══ MEMÓRIAS RELEVANTES ═══
${memText || "—"}

═══ ÚLTIMA CONVERSA ═══
${yesterdayContext || "—"}

Gere o briefing matinal.`.trim();

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: BRIEF_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    if (!text) return null;

    const result = {
      text,
      stats: { tasks: tasks.length, events: 0, focusRate },
    };

    // Cache por 12h
    await redis.set(todayKey, JSON.stringify(result), "EX", 12 * 3600).catch(() => {});

    return result;
  } catch (err) {
    console.warn(`[morning-brief] Claude falhou:`, (err as Error).message);
    return null;
  }
}

/** Gera e salva como ProactiveAlert para o frontend consumir */
export async function createMorningBriefAlert(userId: string): Promise<void> {
  const [brief, prediction] = await Promise.all([
    generateMorningBrief(userId),
    predictDay(userId).catch(() => null),
  ]);
  if (!brief) return;

  const dedupKey = `morning_brief_premium_${new Date().toISOString().slice(0, 10)}`;
  const exists = await prisma.proactiveAlert.findFirst({ where: { userId, dedupKey } }).catch(() => null);
  if (exists) return;

  await prisma.proactiveAlert.create({
    data: {
      userId,
      module: "agenda",
      icon: "MRN",
      color: "#00D4FF",
      title: "Morning Brief",
      text: prediction
        ? "PREVISAO: Energia " + prediction.energyForecast + " | Janela: " + prediction.productivityWindow + (prediction.riskFactors.length ? "\nRiscos: " + prediction.riskFactors.join(", ") : "") + "\nSugestao: " + prediction.recommendation + "\n\n" + brief.text
        : brief.text,
      action: "Abrir AGENDA",
      priority: "medium" as AlertPriority,
      dedupKey,
      expiresAt: new Date(new Date().setHours(12, 0, 0, 0)),
    },
  });
}
