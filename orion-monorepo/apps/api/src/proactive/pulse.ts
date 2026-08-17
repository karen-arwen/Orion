import type { AlertPriority } from "@prisma/client";
import type { InternalActionType } from "@orion/types";
import { prisma } from "../db/prisma.js";
import { routeInternalAction, type RouteActionResult } from "../decisions/action-router.js";

interface PulseContext {
  userId: string;
  timezone: string;
}

interface PulseMission {
  title: string;
  summary: string;
  proposedAction: string;
  priority: AlertPriority;
  actionType: InternalActionType;
  actionInput: Record<string, unknown>;
}

export interface PulseResult {
  checked: number;
  routed: number;
  skipped: number;
  results: Array<RouteActionResult & { title: string }>;
}

function startOfLocalDay(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

async function alreadyRoutedToday(userId: string, title: string): Promise<boolean> {
  const existing = await prisma.autonomyActionLog.findFirst({
    where: {
      userId,
      title,
      createdAt: { gte: startOfLocalDay() },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

function tomorrowAt(hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

async function buildMissions(ctx: PulseContext): Promise<PulseMission[]> {
  const now = new Date();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const today = now.toISOString().slice(0, 10);

  const [
    activeTasks,
    overdueTasks,
    doingTasks,
    completedFocus,
    recentSleep,
    latestMindset,
    activeHabits,
    habitLogsToday,
    unresolvedSecurity,
    subscriptions,
    wishlistTargets,
    staleContact,
  ] = await Promise.all([
    prisma.task.count({ where: { userId: ctx.userId, status: { in: ["todo", "doing"] } } }),
    prisma.task.findMany({
      where: { userId: ctx.userId, status: { in: ["todo", "doing"] }, dueAt: { lt: now } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 5,
    }),
    prisma.task.count({ where: { userId: ctx.userId, status: "doing" } }),
    prisma.focusSession.count({
      where: { userId: ctx.userId, completed: true, startedAt: { gte: threeDaysAgo } },
    }),
    prisma.sleepLog.findMany({
      where: { userId: ctx.userId },
      orderBy: { bedTime: "desc" },
      take: 3,
    }),
    prisma.mindsetCheckin.findFirst({
      where: { userId: ctx.userId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.habit.findMany({
      where: { userId: ctx.userId, archivedAt: null },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.habitLog.findMany({
      where: { habit: { userId: ctx.userId }, date: today },
      select: { habitId: true },
    }),
    prisma.securityFinding.findMany({
      where: { userId: ctx.userId, resolved: false, risk: { in: ["high", "critical"] } },
      orderBy: [{ risk: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
    prisma.financeSubscription.findMany({
      where: { userId: ctx.userId, active: true },
      orderBy: { amount: "desc" },
      take: 10,
    }),
    prisma.wishlistItem.findMany({
      where: { userId: ctx.userId, currentPrice: { not: null }, targetPrice: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.socialContact.findFirst({
      where: { userId: ctx.userId, importance: { gte: 7 }, updatedAt: { lt: sevenDaysAgo } },
      orderBy: [{ importance: "desc" }, { updatedAt: "asc" }],
    }),
  ]);

  const missions: PulseMission[] = [];

  if (overdueTasks.length >= 2) {
    missions.push({
      title: "Replanejar tarefas vencidas",
      summary: `${overdueTasks.length} tarefas vencidas detectadas. A primeira e "${overdueTasks[0]?.title}".`,
      proposedAction: "Criar uma tarefa de triagem para reorganizar vencimentos e cortar escopo.",
      priority: overdueTasks.length >= 4 ? "high" : "medium",
      actionType: "task.create",
      actionInput: {
        title: "Triagem de tarefas vencidas",
        notes: `O Orion detectou ${overdueTasks.length} tarefas vencidas. Revisar, reagendar ou arquivar: ${overdueTasks.map((task) => task.title).join("; ")}.`,
        priority: 3,
        energy: 2,
        estMinutes: 25,
        scheduledFor: tomorrowAt(9),
      },
    });
  }

  if (activeTasks >= 10) {
    missions.push({
      title: "Reduzir carga ativa do Life OS",
      summary: `${activeTasks} tarefas abertas. Isso costuma degradar foco e decisao.`,
      proposedAction: "Criar uma sessao curta de pruning para escolher no maximo 3 prioridades.",
      priority: "medium",
      actionType: "task.create",
      actionInput: {
        title: "Pruning do Life OS: escolher 3 prioridades",
        notes: "Cortar ou arquivar tarefas abertas demais. Saida esperada: 3 prioridades reais e o resto estacionado.",
        priority: 2,
        energy: 2,
        estMinutes: 20,
        scheduledFor: tomorrowAt(10),
      },
    });
  }

  const sleepHours =
    recentSleep.length > 0
      ? recentSleep.reduce((sum, log) => sum + Math.max(0, log.wakeTime.getTime() - log.bedTime.getTime()) / 36e5, 0) / recentSleep.length
      : null;
  if (sleepHours !== null && sleepHours < 6.5) {
    missions.push({
      title: "Plano de energia reduzida",
      summary: `Media recente de sono em ${sleepHours.toFixed(1)}h. O plano de hoje precisa ficar mais leve.`,
      proposedAction: "Criar tarefa de ajuste do dia com foco em energia, nao volume.",
      priority: sleepHours < 5.5 ? "high" : "medium",
      actionType: "task.create",
      actionInput: {
        title: "Ajustar plano do dia pela energia",
        notes: `Sono medio recente: ${sleepHours.toFixed(1)}h. Escolher 1 tarefa essencial, 1 recuperacao e adiar o resto sem culpa operacional.`,
        priority: 2,
        energy: 1,
        estMinutes: 15,
      },
    });
  }

  if (doingTasks > 0 && completedFocus === 0) {
    missions.push({
      title: "Criar bloco de foco de recuperacao",
      summary: `${doingTasks} tarefa(s) em andamento e nenhum foco concluido nos ultimos 3 dias.`,
      proposedAction: "Criar um bloco de foco curto para gerar tracao.",
      priority: "low",
      actionType: "task.create",
      actionInput: {
        title: "Bloco de foco 25min: destravar uma tarefa em andamento",
        notes: "Escolher uma tarefa em doing, fechar distrações e produzir um avanço visível.",
        priority: 2,
        energy: 2,
        estMinutes: 25,
      },
    });
  }

  if (latestMindset && latestMindset.stress >= 8) {
    missions.push({
      title: "Protocolo anti-sobrecarga",
      summary: `Stress ${latestMindset.stress}/10 no ultimo check-in. Empilhar mais tarefa agora e ruim.`,
      proposedAction: "Criar uma tarefa de estabilizacao antes de executar trabalho pesado.",
      priority: latestMindset.stress >= 9 ? "high" : "medium",
      actionType: "task.create",
      actionInput: {
        title: "Reduzir atrito antes da proxima acao",
        notes: "Escolher a menor proxima acao, remover uma pendencia desnecessaria e fazer uma pausa curta.",
        priority: 2,
        energy: 1,
        estMinutes: 10,
      },
    });
  }

  const loggedHabitIds = new Set(habitLogsToday.map((log) => log.habitId));
  const missingHabits = activeHabits.filter((habit) => !loggedHabitIds.has(habit.id));
  if (activeHabits.length > 0 && missingHabits.length === activeHabits.length) {
    missions.push({
      title: "Check rapido de habitos",
      summary: `${missingHabits.length} habito(s) ativos ainda sem check-in hoje.`,
      proposedAction: "Criar alerta proativo para um check-in de habitos sem peso.",
      priority: "low",
      actionType: "alert.create",
      actionInput: {
        module: "habit",
        icon: "OK",
        color: "#10B981",
        title: "Check-in de habitos pendente",
        text: `Nenhum habito marcado hoje. Comece pequeno: ${missingHabits.slice(0, 3).map((habit) => habit.name).join(", ")}.`,
        action: "Abrir Habitos e marcar o menor compromisso possivel hoje",
        priority: "low",
        expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      },
    });
  }

  if (unresolvedSecurity.length > 0) {
    missions.push({
      title: "Priorizar risco de seguranca",
      summary: `${unresolvedSecurity.length} risco(s) alto/critico sem resolucao. Principal: ${unresolvedSecurity[0]?.title}.`,
      proposedAction: "Criar tarefa curta para resolver o risco mais alto.",
      priority: unresolvedSecurity.some((finding) => finding.risk === "critical") ? "critical" : "high",
      actionType: "task.create",
      actionInput: {
        title: `Resolver seguranca: ${unresolvedSecurity[0]?.title ?? "risco prioritario"}`,
        notes: unresolvedSecurity[0]?.action ?? "Abrir modulo Seguranca e resolver o risco prioritario.",
        priority: 3,
        energy: 2,
        estMinutes: 30,
      },
    });
  }

  const monthlySubscriptions = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
  if (subscriptions.length >= 5 || monthlySubscriptions >= 150) {
    missions.push({
      title: "Auditar assinaturas recorrentes",
      summary: `${subscriptions.length} assinatura(s) ativas somando R$ ${monthlySubscriptions.toFixed(2)}/mes.`,
      proposedAction: "Criar tarefa de auditoria para cortar redundancia.",
      priority: monthlySubscriptions >= 300 ? "medium" : "low",
      actionType: "task.create",
      actionInput: {
        title: "Auditar assinaturas e cortar desperdicio",
        notes: `Assinaturas mais caras: ${subscriptions.slice(0, 5).map((sub) => `${sub.name} R$ ${sub.amount.toFixed(2)}`).join("; ")}.`,
        priority: 2,
        energy: 2,
        estMinutes: 30,
      },
    });
  }

  const targetHit = wishlistTargets.find((item) => item.currentPrice != null && item.targetPrice != null && item.currentPrice <= item.targetPrice);
  if (targetHit) {
    missions.push({
      title: "Preco alvo atingido na wishlist",
      summary: `${targetHit.name} chegou em R$ ${targetHit.currentPrice?.toFixed(2)} contra alvo R$ ${targetHit.targetPrice?.toFixed(2)}.`,
      proposedAction: "Criar alerta para decidir compra com calma.",
      priority: "medium",
      actionType: "alert.create",
      actionInput: {
        module: "shop",
        icon: "BUY",
        color: "#F59E0B",
        title: "Preco alvo atingido",
        text: `${targetHit.name} esta no alvo. Decida olhando caixa, urgencia e historico, nao impulso.`,
        action: `Abrir Compras e avaliar ${targetHit.name}`,
        priority: "medium",
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
    });
  }

  if (staleContact) {
    missions.push({
      title: `Retomar contato com ${staleContact.name}`,
      summary: `Contato importante sem movimento desde ${staleContact.updatedAt.toLocaleDateString("pt-BR")}.`,
      proposedAction: "Criar tarefa de follow-up no Social CRM.",
      priority: "low",
      actionType: "task.create",
      actionInput: {
        title: `Follow-up: ${staleContact.name}`,
        notes: `Contexto: ${staleContact.context || "sem contexto"}. Proximo passo: ${staleContact.nextStep}.`,
        priority: 1,
        energy: 1,
        estMinutes: 10,
      },
    });
  }

  return missions;
}

export async function runProactivePulseForUser(ctx: PulseContext): Promise<PulseResult> {
  const missions = await buildMissions(ctx);
  const results: PulseResult["results"] = [];
  let skipped = 0;

  for (const mission of missions.slice(0, 6)) {
    if (results.length >= 3) break;
    if (await alreadyRoutedToday(ctx.userId, mission.title)) {
      skipped++;
      continue;
    }
    const routed = await routeInternalAction(ctx.userId, mission);
    results.push({ ...routed, title: mission.title });
  }

  return {
    checked: missions.length,
    routed: results.length,
    skipped,
    results,
  };
}

export async function runProactivePulseForAllUsers(): Promise<{ scanned: number; failed: number; routed: number }> {
  const users = await prisma.user.findMany({
    select: { id: true, profile: { select: { timezone: true } } },
  });
  let failed = 0;
  let routed = 0;
  for (const user of users) {
    try {
      const result = await runProactivePulseForUser({
        userId: user.id,
        timezone: user.profile?.timezone ?? "America/Sao_Paulo",
      });
      routed += result.routed;
    } catch (err) {
      failed++;
      console.warn(`[pulse] user ${user.id} falhou:`, (err as Error).message);
    }
  }
  return { scanned: users.length, failed, routed };
}
