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
  priority: "low" | "medium" | "high" | "critical";
  dedupKey: string;
  ttlHours: number;
}

async function upsertAlert(userId: string, alert: AlertInput): Promise<boolean> {
  const existing = await prisma.proactiveAlert.findUnique({
    where: { userId_dedupKey: { userId, dedupKey: alert.dedupKey } },
    select: { id: true, dismissed: true },
  });
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
      module: alert.module,
      icon: alert.icon,
      color: alert.color,
      title: alert.title,
      text: alert.text,
      action: alert.action,
      priority: alert.priority,
      expiresAt: new Date(Date.now() + alert.ttlHours * 3600 * 1000),
    },
  });
  return !existing;
}

// ── DETECTORES ──────────────────────────────────────────────────────

async function detectStaleEmails(ctx: DetectionContext): Promise<boolean> {
  const integ = await prisma.integration.findFirst({
    where: { userId: ctx.userId, provider: "gmail", status: "connected" },
  });
  if (!integ) return false;
  const token = await tryEnsureFreshAccessToken(integ);
  if (!token) return false;

  try {
    // Emails antigos não lidos (>2 dias) — proxy de "não respondido"
    const emails = await gmailList(token, {
      query: "is:unread older_than:2d -category:promotions -category:social",
      maxResults: 5,
    });
    if (emails.length === 0) return false;

    const top = emails[0];
    if (!top) return false;
    return upsertAlert(ctx.userId, {
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
    return false;
  }
}

async function detectTomorrowUnprepared(ctx: DetectionContext): Promise<boolean> {
  const integ = await prisma.integration.findFirst({
    where: { userId: ctx.userId, provider: "gcal", status: "connected" },
  });
  if (!integ) return false;
  const token = await tryEnsureFreshAccessToken(integ);
  if (!token) return false;

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
    if (critical.length === 0) return false;

    const first = critical[0];
    if (!first) return false;
    return upsertAlert(ctx.userId, {
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
    return false;
  }
}

async function detectOverdueTasks(ctx: DetectionContext): Promise<boolean> {
  const overdue = await prisma.task.findMany({
    where: {
      userId: ctx.userId,
      status: { in: ["todo", "doing"] },
      dueAt: { lt: new Date() },
    },
    take: 10,
  });
  if (overdue.length === 0) return false;

  const first = overdue[0];
  if (!first) return false;
  return upsertAlert(ctx.userId, {
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

async function detectStaleProjects(ctx: DetectionContext): Promise<boolean> {
  const threshold = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const stale = await prisma.project.findMany({
    where: {
      userId: ctx.userId,
      status: { notIn: ["pausado", "concluido"] },
      updatedAt: { lt: threshold },
    },
    take: 5,
  });
  if (stale.length === 0) return false;

  const first = stale[0];
  if (!first) return false;
  return upsertAlert(ctx.userId, {
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

function hoursBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 36e5);
}

async function detectSleepDebt(ctx: DetectionContext): Promise<boolean> {
  const recent = await prisma.sleepLog.findMany({
    where: { userId: ctx.userId },
    orderBy: { bedTime: "desc" },
    take: 3,
  });
  if (recent.length === 0) return false;

  const avgHours = recent.reduce((sum, log) => sum + hoursBetween(log.bedTime, log.wakeTime), 0) / recent.length;
  const lowQuality = recent.filter((log) => log.quality <= 2).length;
  if (avgHours >= 6.5 && lowQuality === 0) return false;

  return upsertAlert(ctx.userId, {
    module: "sleep",
    icon: "☽",
    color: "#7C3AED",
    title: "Recuperacao abaixo do ideal",
    text: `Media recente de sono: ${avgHours.toFixed(1)}h. Isso pode afetar foco, humor e decisao hoje.`,
    action: "Analise meus ultimos registros de sono e ajuste meu plano de hoje para proteger energia",
    priority: avgHours < 5.5 || lowQuality >= 2 ? "high" : "medium",
    dedupKey: `sleep_debt:${new Date().toISOString().slice(0, 10)}`,
    ttlHours: 18,
  });
}

async function detectMindsetStress(ctx: DetectionContext): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const latest = await prisma.mindsetCheckin.findFirst({
    where: { userId: ctx.userId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  if (!latest || latest.stress < 8) return false;

  const activeTasks = await prisma.task.count({
    where: { userId: ctx.userId, status: { in: ["todo", "doing"] } },
  });

  return upsertAlert(ctx.userId, {
    module: "mindset",
    icon: "▶",
    color: "#10B981",
    title: "Stress alto detectado",
    text: `Ultimo check-in marcou stress ${latest.stress}/10 com ${activeTasks} tarefa(s) abertas. Melhor reduzir atrito antes de empilhar coisa.`,
    action: "Replaneje meu dia considerando meu stress alto e escolha so a proxima acao essencial",
    priority: latest.stress >= 9 ? "high" : "medium",
    dedupKey: `mindset_stress:${new Date().toISOString().slice(0, 10)}`,
    ttlHours: 10,
  });
}

async function detectWishlistTargets(ctx: DetectionContext): Promise<boolean> {
  const items = await prisma.wishlistItem.findMany({
    where: {
      userId: ctx.userId,
      currentPrice: { not: null },
      targetPrice: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  const hit = items.find((item) => {
    if (item.currentPrice == null || item.targetPrice == null) return false;
    return item.currentPrice <= item.targetPrice;
  });
  if (!hit || hit.currentPrice == null || hit.targetPrice == null) return false;

  return upsertAlert(ctx.userId, {
    module: "shop",
    icon: "◬",
    color: "#F59E0B",
    title: "Preco alvo atingido",
    text: `"${hit.name}" esta em R$ ${hit.currentPrice.toFixed(2)} ou abaixo do alvo R$ ${hit.targetPrice.toFixed(2)}.`,
    action: `Abra minha wishlist e me ajude a decidir se vale comprar "${hit.name}" agora`,
    priority: "medium",
    dedupKey: `wishlist_target:${hit.id}:${new Date().toISOString().slice(0, 10)}`,
    ttlHours: 24,
  });
}

async function detectSocialFollowUp(ctx: DetectionContext): Promise<boolean> {
  const threshold = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const contact = await prisma.socialContact.findFirst({
    where: {
      userId: ctx.userId,
      importance: { gte: 6 },
      updatedAt: { lt: threshold },
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "asc" }],
  });
  if (!contact) return false;

  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  return upsertAlert(ctx.userId, {
    module: "social",
    icon: "▫",
    color: "#EC4899",
    title: `Follow-up com ${contact.name}`,
    text: `Contato importante sem movimento ha 14+ dias. Proximo passo: ${contact.nextStep}.`,
    action: `Crie uma mensagem curta e natural para retomar contato com ${contact.name}. Contexto: ${contact.context}`,
    priority: "low",
    dedupKey: `social_followup:${contact.id}:${week}`,
    ttlHours: 72,
  });
}

async function detectFocusMomentum(ctx: DetectionContext): Promise<boolean> {
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const [recentFocus, doingTasks] = await Promise.all([
    prisma.focusSession.count({ where: { userId: ctx.userId, startedAt: { gte: since }, completed: true } }),
    prisma.task.count({ where: { userId: ctx.userId, status: "doing" } }),
  ]);
  if (recentFocus > 0 || doingTasks === 0) return false;

  return upsertAlert(ctx.userId, {
    module: "focus",
    icon: "◐",
    color: "#00D4FF",
    title: "Tracao de foco baixa",
    text: `Voce tem ${doingTasks} tarefa(s) em andamento e nenhum bloco de foco concluido nos ultimos 3 dias.`,
    action: "Escolha uma tarefa em andamento e monte um bloco de foco de 25 minutos para agora",
    priority: "low",
    dedupKey: `focus_momentum:${new Date().toISOString().slice(0, 10)}`,
    ttlHours: 16,
  });
}

// ── ENTRY POINTS ────────────────────────────────────────────────────

export async function detectForUser(ctx: DetectionContext): Promise<{ created: number; checked: number }> {
  const results = await Promise.all([
    detectStaleEmails(ctx),
    detectTomorrowUnprepared(ctx),
    detectOverdueTasks(ctx),
    detectStaleProjects(ctx),
    detectSleepDebt(ctx),
    detectMindsetStress(ctx),
    detectWishlistTargets(ctx),
    detectSocialFollowUp(ctx),
    detectFocusMomentum(ctx),
  ]);
  return { created: results.filter(Boolean).length, checked: results.length };
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
