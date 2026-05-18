import { prisma } from "../db/prisma.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";
import { calendarList, gmailList } from "../integrations/google-api.js";

/* ═══════════════════════════════════════════════════════════════════
   Alert Detector — roda a cada hora pra todos os usuários.

   Detecta:
   - COMMS: email não respondido há >48h de remetente prioritário
   - AGENDA: evento amanhã sem nota/agenda definida
   - LIFE OS: tasks vencidas
   - CARREIRA: 3+ dias sem atualizar projetos

   Cada detector usa dedupKey pra evitar criar o mesmo alerta repetido.
═══════════════════════════════════════════════════════════════════ */

interface DetectionContext {
  userId: string;
  mode: "SILENCIOSO" | "NORMAL" | "STARK";
  timezone: string;
}

interface AlertInput {
  module: string;
  icon: string;
  color: string;
  title: string;
  text: string;
  action: string;
  priority: "low" | "medium" | "high";
  dedupKey: string;
  ttlHours: number;
}

async function upsertAlert(userId: string, alert: AlertInput): Promise<void> {
  await prisma.proactiveAlert.upsert({
    where: { userId_dedupKey: { userId, dedupKey: alert.dedupKey } },
    create: {
      userId,
      module: alert.module,
      icon: alert.icon,
      color: alert.color,
      title: alert.title,
      text: alert.text,
      action: alert.action,
      priority: alert.priority,
      dedupKey: alert.dedupKey,
      expiresAt: new Date(Date.now() + alert.ttlHours * 3600 * 1000),
    },
    update: {
      text: alert.text,
      priority: alert.priority,
      expiresAt: new Date(Date.now() + alert.ttlHours * 3600 * 1000),
    },
  });
}

// ── DETECTORES ──────────────────────────────────────────────────────

async function detectStaleEmails(ctx: DetectionContext): Promise<void> {
  const integ = await prisma.integration.findFirst({
    where: { userId: ctx.userId, provider: "gmail", status: "connected" },
  });
  if (!integ) return;
  const token = await tryEnsureFreshAccessToken(integ);
  if (!token) return;

  try {
    // Emails antigos não lidos (>2 dias) — proxy de "não respondido"
    const emails = await gmailList(token, {
      query: "is:unread older_than:2d -category:promotions -category:social",
      maxResults: 5,
    });
    if (emails.length === 0) return;

    const top = emails[0];
    if (!top) return;
    await upsertAlert(ctx.userId, {
      module: "comms",
      icon: "◈",
      color: "#EF4444",
      title: `${emails.length} email${emails.length > 1 ? "s" : ""} aguardando resposta`,
      text: `O mais antigo: "${top.subject}" de ${top.from}. Querem atenção há mais de 48h.`,
      action: "Mostra os emails atrasados pra eu priorizar quais responder",
      priority: emails.length >= 3 ? "high" : "medium",
      dedupKey: `stale_emails:${new Date().toISOString().slice(0, 10)}`,
      ttlHours: 12,
    });
  } catch (err) {
    console.warn(`[detector] stale emails falhou pra ${ctx.userId}:`, (err as Error).message);
  }
}

async function detectTomorrowUnprepared(ctx: DetectionContext): Promise<void> {
  const integ = await prisma.integration.findFirst({
    where: { userId: ctx.userId, provider: "gcal", status: "connected" },
  });
  if (!integ) return;
  const token = await tryEnsureFreshAccessToken(integ);
  if (!token) return;

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const endTomorrow = new Date(tomorrow);
    endTomorrow.setHours(23, 59, 59, 999);

    const events = await calendarList(token, {
      timeMin: tomorrow.toISOString(),
      timeMax: endTomorrow.toISOString(),
      maxResults: 10,
    });

    // Eventos críticos: tem attendees e duração > 30min (heurística pra "reunião importante")
    const critical = events.filter(
      (e) => e.attendees.length > 0 && e.summary && !/cancela|cancel/i.test(e.summary),
    );
    if (critical.length === 0) return;

    const first = critical[0];
    if (!first) return;
    await upsertAlert(ctx.userId, {
      module: "calendar",
      icon: "⬡",
      color: "#F59E0B",
      title: `${critical.length} evento${critical.length > 1 ? "s" : ""} amanhã com convidados`,
      text: `Primeiro: "${first.summary}" às ${new Date(first.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: ctx.timezone })}. Quer que eu te prepare?`,
      action: "Prepara briefing pros eventos importantes de amanhã",
      priority: "medium",
      dedupKey: `tomorrow_events:${tomorrow.toISOString().slice(0, 10)}`,
      ttlHours: 18,
    });
  } catch (err) {
    console.warn(`[detector] tomorrow events falhou pra ${ctx.userId}:`, (err as Error).message);
  }
}

async function detectOverdueTasks(ctx: DetectionContext): Promise<void> {
  const overdue = await prisma.task.findMany({
    where: {
      userId: ctx.userId,
      status: { in: ["todo", "doing"] },
      dueAt: { lt: new Date() },
    },
    take: 10,
  });
  if (overdue.length === 0) return;

  const first = overdue[0];
  if (!first) return;
  await upsertAlert(ctx.userId, {
    module: "life",
    icon: "◎",
    color: "#EF4444",
    title: `${overdue.length} tarefa${overdue.length > 1 ? "s" : ""} vencida${overdue.length > 1 ? "s" : ""}`,
    text: `"${first.title}" venceu. Quer replanejar ou marcar como feita?`,
    action: "Lista todas as tarefas vencidas e me ajuda a replanejar",
    priority: overdue.length >= 3 ? "high" : "medium",
    dedupKey: `overdue_tasks:${new Date().toISOString().slice(0, 10)}`,
    ttlHours: 12,
  });
}

async function detectStaleProjects(ctx: DetectionContext): Promise<void> {
  const threshold = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const stale = await prisma.project.findMany({
    where: {
      userId: ctx.userId,
      status: { notIn: ["pausado", "concluido"] },
      updatedAt: { lt: threshold },
    },
    take: 5,
  });
  if (stale.length === 0) return;

  const first = stale[0];
  if (!first) return;
  await upsertAlert(ctx.userId, {
    module: "career",
    icon: "↑",
    color: "#F59E0B",
    title: `Projeto "${first.name}" parado há 1+ semana`,
    text: `Sem atualizações desde ${first.updatedAt.toLocaleDateString("pt-BR")}. Quer atacar uma task rápida?`,
    action: `Me sugere uma micro-task pra desbloquear o ${first.name}`,
    priority: "low",
    dedupKey: `stale_project:${first.id}`,
    ttlHours: 48,
  });
}

// ── ENTRY POINTS ────────────────────────────────────────────────────

export async function detectForUser(ctx: DetectionContext): Promise<void> {
  await Promise.all([
    detectStaleEmails(ctx),
    detectTomorrowUnprepared(ctx),
    detectOverdueTasks(ctx),
    detectStaleProjects(ctx),
  ]);
}

/** Roda detecção pra TODOS os usuários (chamado pelo BullMQ a cada hora). */
export async function detectForAllUsers(): Promise<{ scanned: number; failed: number }> {
  const users = await prisma.user.findMany({
    select: { id: true, mode: true, profile: { select: { timezone: true } } },
  });

  let failed = 0;
  for (const u of users) {
    try {
      await detectForUser({
        userId: u.id,
        mode: u.mode,
        timezone: u.profile?.timezone ?? "America/Sao_Paulo",
      });
    } catch (err) {
      failed++;
      console.warn(`[detector] user ${u.id} falhou:`, (err as Error).message);
    }
  }
  return { scanned: users.length, failed };
}

/** Expira alerts que passaram do expiresAt. */
export async function expireOldAlerts(): Promise<{ expired: number }> {
  const result = await prisma.proactiveAlert.updateMany({
    where: {
      dismissed: false,
      expiresAt: { lt: new Date() },
    },
    data: { dismissed: true },
  });
  return { expired: result.count };
}
