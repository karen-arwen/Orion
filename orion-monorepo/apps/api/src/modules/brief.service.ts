import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   ORION DAILY BRIEF SERVICE
   Agrega dados dos módulos e gera briefing personalizado via Claude.
   Cache: UserPattern com chave "brief_<YYYY-MM-DD>"
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic();

export interface DailyBrief {
  date: string;
  greeting: string;
  summary: string;
  focusTip: string;
  agenda: Array<{ time: string; title: string; color: string }>;
  topTasks: Array<{ title: string; priority: number }>;
  habitStatus: { done: number; total: number; streak: number };
  activeRoutine: string | null;
  mood: number | null;
  projectAlert: string | null;
  affirmation: string;
  generatedAt: string;
}

export async function getDailyBrief(userId: string, forceRefresh = false): Promise<DailyBrief> {
  const today = new Date().toISOString().split("T")[0] ?? new Date().toISOString().slice(0, 10);
  const cacheKey = `brief_${today}`;

  // Retorna cache se existir e não forçar refresh
  if (!forceRefresh) {
    const cached = await prisma.userPattern.findUnique({
      where: { userId_patternType: { userId, patternType: cacheKey } },
    });
    if (cached?.data) return cached.data as unknown as DailyBrief;
  }

  // Agrega dados
  const [events, tasks, habits, habitLogs, journalToday, projects, alertsRaw] = await Promise.all([
    // Calendário de hoje
    prisma.calendarEvent.findMany({
      where: {
        userId,
        startTime: { gte: new Date(today + "T00:00:00"), lt: new Date(today + "T23:59:59") },
      },
      orderBy: { startTime: "asc" },
      take: 10,
    }),
    // Tarefas pendentes
    prisma.task.findMany({
      where: { userId, status: { in: ["todo", "doing"] } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 5,
    }),
    // Hábitos ativos
    prisma.habit.findMany({
      where: { userId, archivedAt: null },
    }),
    // Checks de hoje
    prisma.habitLog.findMany({
      where: {
        habit: { userId },
        date: today,
      },
    }),
    // Journal de hoje
    prisma.userPattern.findUnique({
      where: { userId_patternType: { userId, patternType: `journal_entry_${today}` } },
    }),
    // Projetos com stall
    prisma.project.findMany({
      where: { userId, status: { notIn: ["concluido", "cancelado"] } },
      orderBy: { updatedAt: "asc" },
      take: 3,
    }),
    // Alertas não resolvidos
    prisma.proactiveAlert.findMany({
      where: { userId },
      take: 3,
    }),
  ]);

  // Prepara contexto
  const habitsDone = habitLogs.length;
  const habitsTotal = habits.length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const journalMood = journalToday?.data ? (journalToday.data as Record<string, unknown>).mood as number | null : null;

  const stalledProject = projects.find(p => {
    const daysSince = (Date.now() - new Date(p.updatedAt).getTime()) / 86400000;
    return daysSince >= 7;
  });

  // Hora atual para saudação
  const hour = new Date().getHours();
  const greetingBase = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Contexto para o Claude
  const context = `
Usuário: Karen Arwen (dev + influenciadora geek)
Data: ${today} | Hora: ${new Date().toLocaleTimeString("pt-BR")}

AGENDA DE HOJE (${events.length} eventos):
${events.map(e => `- ${new Date(e.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}: ${e.title}`).join("\n") || "Nenhum evento"}

TAREFAS PRIORITÁRIAS (${tasks.length} pendentes):
${tasks.map(t => `- [P${t.priority}] ${t.title}`).join("\n") || "Nenhuma tarefa"}

HÁBITOS: ${habitsDone}/${habitsTotal} concluídos hoje | Maior streak: ${bestStreak} dias
${habits.map(h => `- ${h.icon} ${h.name}: ${habitLogs.find(l => l.habitId === h.id) ? "✓" : "✗"} (streak: ${h.streak})`).join("\n")}

HUMOR REGISTRADO: ${journalMood ? `${journalMood}/5` : "não registrado ainda"}

PROJETOS ATIVOS: ${projects.map(p => `${p.name} (${p.progress}%)`).join(", ")}
${stalledProject ? `⚠ "${stalledProject.name}" está parado há ${Math.floor((Date.now() - new Date(stalledProject.updatedAt).getTime()) / 86400000)} dias` : ""}

ALERTAS PENDENTES: ${alertsRaw.map(a => a.title).join(", ") || "nenhum"}
`.trim();

  // Gera briefing via Claude
  let briefContent: Omit<DailyBrief, "date" | "greeting" | "agenda" | "topTasks" | "habitStatus" | "activeRoutine" | "mood" | "projectAlert" | "generatedAt">;

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 800,
      system: `Você é ORION, assistente pessoal da Karen. Responda APENAS JSON válido, sem markdown.
Formato exato:
{
  "summary": "2-3 frases diretas sobre o dia — o que mais importa agora",
  "focusTip": "1 dica específica e acionável para hoje baseada nos dados",
  "affirmation": "1 frase motivacional curta e personalizada para Karen"
}`,
      messages: [{ role: "user", content: `Gere o briefing diário com base nesses dados:\n\n${context}` }],
    });

    const block = response.content[0];
    const text = block && block.type === "text" ? (block as { type: "text"; text: string }).text.trim() : "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ""));
    briefContent = parsed as typeof briefContent;
  } catch {
    // Fallback sem IA
    briefContent = {
      summary: `${habitsDone} de ${habitsTotal} hábitos concluídos. ${tasks.length} tarefas pendentes. ${events.length > 0 ? `${events.length} eventos hoje.` : "Agenda livre."}`,
      focusTip: tasks[0] ? `Prioridade agora: "${tasks[0].title}"` : "Momento de planejar — revise seus projetos.",
      affirmation: "Cada commit é um passo. Cada dia é uma nova versão de você.",
    };
  }

  const brief: DailyBrief = {
    date: today,
    greeting: `${greetingBase}, Karen`,
    summary: briefContent.summary ?? "",
    focusTip: briefContent.focusTip ?? "",
    affirmation: briefContent.affirmation ?? "",
    agenda: events.slice(0, 5).map(e => ({
      time: new Date(e.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      title: e.title,
      color: "#00D4FF",
    })),
    topTasks: tasks.slice(0, 3).map(t => ({ title: t.title, priority: t.priority })),
    habitStatus: { done: habitsDone, total: habitsTotal, streak: bestStreak },
    activeRoutine: null, // pode ser expandido depois
    mood: journalMood,
    projectAlert: stalledProject ? `"${stalledProject.name}" parado há ${Math.floor((Date.now() - new Date(stalledProject.updatedAt).getTime()) / 86400000)} dias` : null,
    generatedAt: new Date().toISOString(),
  };

  // Salva no cache
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: cacheKey } },
    update: { data: brief as never },
    create: { userId, patternType: cacheKey, data: brief as never },
  });

  return brief;
}
