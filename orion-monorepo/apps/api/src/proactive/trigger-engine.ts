import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { routeInternalAction } from "../decisions/action-router.js";
import { createMorningBriefAlert } from "./morning-brief.service.js";
import { createWeeklyReviewAlert } from "./weekly-review.service.js";
import { analyzeHabits } from "../modules/habit-intelligence.service.js";
import { getContactNudges } from "../modules/social-crm.service.js";
import { checkBudgetLimits, autoCategorize } from "../modules/financial-autopilot.service.js";
import { createDailyDigestAlert } from "./daily-digest.service.js";
import type { AlertPriority, InternalActionType } from "@orion/types";

/* ═══════════════════════════════════════════════════════════════════
   TRIGGER ENGINE — o sistema de eventos proativos do ORION.

   Princípio: em vez de esperar o usuário chamar o ORION, o ORION
   monitora eventos do mundo do usuário e age ou avisa na hora certa.

   Tipos de trigger:
   - TEMPORAL: horário do dia, dia da semana
   - COMPORTAMENTAL: o usuário não fez algo que faria normalmente
   - CONTEXTUAL: dados cruzados (muitas reuniões + pouco sono = aviso)
   - EXTERNO: evento chegou (email, PR, preço) — processado pelo micro cycle
   - PADRÃO: desvio de rotina detectado

   Cada trigger tem:
   - `evaluate()`: checa se a condição está ativa
   - `shouldInterrupt()`: decide se vale interromper o usuário agora
   - `buildAction()`: gera a ação ou alerta a ser executado

   A taxa de interrupção é limitada: máx 3 notificações não urgentes/dia
   por usuário. O ORION prefere agir silenciosamente a spammar alertas.
═══════════════════════════════════════════════════════════════════ */

// ─── Tipos ─────────────────────────────────────────────────────────

export interface TriggerContext {
  userId: string;
  timezone: string;
  nowHour: number;       // hora local do usuário (0-23)
  nowMinute: number;
  dayOfWeek: number;     // 0=dom, 1=seg...6=sab
  isWeekend: boolean;
  isWorkHour: boolean;   // 9-18 seg-sex
}

export interface TriggerResult {
  triggerId: string;
  fired: boolean;
  actionRouted: boolean;
  reason: string;
}

interface TriggerAction {
  title: string;
  summary: string;
  proposedAction: string;
  priority: AlertPriority;
  actionType: InternalActionType;
  actionInput: Record<string, unknown>;
}

// ─── Rate limiting de interrupções ────────────────────────────────

async function countTodayInterruptions(userId: string): Promise<number> {
  const key = `trigger:interruptions:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const count = await redis.get(key);
  return count ? parseInt(count, 10) : 0;
}

async function recordInterruption(userId: string): Promise<void> {
  const key = `trigger:interruptions:${userId}:${new Date().toISOString().slice(0, 10)}`;
  await redis.incr(key);
  await redis.expire(key, 86400);
}

async function alreadyFiredToday(userId: string, triggerId: string): Promise<boolean> {
  const key = `trigger:fired:${userId}:${triggerId}:${new Date().toISOString().slice(0, 10)}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

async function markFiredToday(userId: string, triggerId: string): Promise<void> {
  const key = `trigger:fired:${userId}:${triggerId}:${new Date().toISOString().slice(0, 10)}`;
  await redis.set(key, "1", "EX", 86400);
}

// ─── Triggers individuais ──────────────────────────────────────────

interface Trigger {
  id: string;
  priority: AlertPriority;
  maxPerDay: number;      // quantas vezes pode disparar por dia (geralmente 1)
  evaluate: (ctx: TriggerContext, userId: string) => Promise<TriggerAction | null>;
}

const TRIGGERS: Trigger[] = [

  // ── Morning Brief check-in (8h) ──────────────────────────────
  {
    id: "morning_brief_check",
    priority: "medium",
    maxPerDay: 1,
    evaluate: async (ctx, userId) => {
      if (ctx.nowHour !== 8 || ctx.isWeekend) return null;

      // Gera briefing premium com Claude ao invés de mensagem estática
      await createMorningBriefAlert(userId);

      // Retorna null porque o createMorningBriefAlert já cria o alerta diretamente
      return null;
    },
  },

  // ── Sem foco em dia útil (detecta ausência de sessão) ─────────
  {
    id: "no_focus_workday",
    priority: "low",
    maxPerDay: 1,
    evaluate: async (ctx, userId) => {
      if (ctx.nowHour !== 14 || ctx.isWeekend) return null;

      const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
      const focusToday = await prisma.focusSession.count({
        where: { userId, startedAt: { gte: todayStart } },
      }).catch(() => 0);

      if (focusToday > 0) return null;

      const hasTasks = await prisma.task.findFirst({
        where: { userId, status: { in: ["todo", "doing"] } },
      }).catch(() => null);

      if (!hasTasks) return null;

      return {
        title: "Nenhuma sessão de foco hoje",
        summary: "São 14h e você ainda não registrou foco. Quer uma sessão rápida?",
        proposedAction: "Alerta de foco sugerido.",
        priority: "low",
        actionType: "alert.create",
        actionInput: {
          module: "focus",
          icon: "FOC",
          color: "#818CF8",
          title: "⚡ 14h sem foco ainda",
          text: "Nenhuma sessão de foco registrada hoje. Um Pomodoro de 25min muda o dia. Topa?",
          action: "Abrir FOCO",
          priority: "low",
          dedupKey: `no_focus_${new Date().toISOString().slice(0, 10)}`,
          expiresAt: new Date(new Date().setHours(17, 0, 0, 0)).toISOString(),
        },
      };
    },
  },

  // ── Sobrecarga detectada: muitas reuniões + pouco sono ────────
  {
    id: "overload_detection",
    priority: "high",
    maxPerDay: 1,
    evaluate: async (ctx, userId) => {
      if (ctx.nowHour !== 9) return null;

      const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
      const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

      const [eventCount, lastSleep, activeTasks] = await Promise.all([
        Promise.resolve(0),
        prisma.sleepLog.findFirst({
          where: { userId },
          orderBy: { bedTime: "desc" },
        }).catch(() => null),
        prisma.task.count({
          where: { userId, status: { in: ["todo", "doing"] } },
        }).catch(() => 0),
      ]);

      const sleepHours = lastSleep?.wakeTime && lastSleep?.bedTime
        ? (lastSleep.wakeTime.getTime() - lastSleep.bedTime.getTime()) / 3600000
        : null;

      const isOverloaded = eventCount >= 5 && (sleepHours === null || sleepHours < 6) && activeTasks >= 8;
      if (!isOverloaded) return null;

      return {
        title: "Sobrecarga detectada",
        summary: `${eventCount} reuniões + <6h de sono + ${activeTasks} tarefas abertas. Isso é demais.`,
        proposedAction: "Alerta de sobrecarga real.",
        priority: "high",
        actionType: "alert.create",
        actionInput: {
          module: "health",
          icon: "OVR",
          color: "#EF4444",
          title: "🔴 Sobrecarga detectada",
          text: `${eventCount} reuniões hoje, ${sleepHours !== null ? sleepHours.toFixed(1) : "?"}h de sono, ${activeTasks} tarefas abertas. Hoje é dia de executar menos e proteger sua energia. Quer que eu ajude a cortar o não essencial?`,
          action: "Ver Life OS",
          priority: "high",
          dedupKey: `overload_${new Date().toISOString().slice(0, 10)}`,
          expiresAt: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
        },
      };
    },
  },

  // ── Desvio de sono: 3 noites ruins seguidas ───────────────────
  {
    id: "sleep_pattern_alert",
    priority: "medium",
    maxPerDay: 1,
    evaluate: async (ctx, userId) => {
      if (ctx.nowHour !== 8) return null;

      const lastThree = await prisma.sleepLog.findMany({
        where: { userId },
        orderBy: { bedTime: "desc" },
        take: 3,
      }).catch(() => []);

      if (lastThree.length < 3) return null;

      const allPoor = lastThree.every((s) => (s.quality ?? 5) <= 2);
      const avgHours = lastThree.reduce((sum, s) => {
        if (!s.wakeTime || !s.bedTime) return sum;
        return sum + (s.wakeTime.getTime() - s.bedTime.getTime()) / 3600000;
      }, 0) / lastThree.length;

      if (!allPoor && avgHours >= 6.5) return null;

      const issue = allPoor ? "qualidade ruim (≤2/5) por 3 noites seguidas"
        : `apenas ${avgHours.toFixed(1)}h de média nas últimas 3 noites`;

      return {
        title: "Padrão de sono preocupante",
        summary: `${issue}. Isso impacta cognição, humor e produtividade.`,
        proposedAction: "Alerta de saúde do sono.",
        priority: "medium",
        actionType: "alert.create",
        actionInput: {
          module: "sleep",
          icon: "SLP",
          color: "#8B5CF6",
          title: "😴 Padrão de sono preocupante",
          text: `${issue[0]?.toUpperCase()}${issue.slice(1)}. Sono de má qualidade acumula. Quer que eu ajuste sua rotina noturna ou revise o que está impactando?`,
          action: "Abrir SLEEP COACH",
          priority: "medium",
          dedupKey: `sleep_pattern_${new Date().toISOString().slice(0, 10)}`,
          expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
        },
      };
    },
  },

  // ── Fim de semana — revisão semanal ───────────────────────────
  {
    id: "weekly_review_prompt",
    priority: "low",
    maxPerDay: 1,
    evaluate: async (ctx, userId) => {
      // Sábado às 10h
      if (ctx.dayOfWeek !== 6 || ctx.nowHour !== 10) return null;

      // Gera revisão semanal premium com Claude
      await createWeeklyReviewAlert(userId);
      return null;
    },
  },

  // ── Projeto parado há >5 dias ─────────────────────────────────
  {
    id: "stale_project_alert",
    priority: "medium",
    maxPerDay: 1,
    evaluate: async (ctx, userId) => {
      if (ctx.nowHour !== 10 || ctx.isWeekend) return null;

      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000);
      const stale = await prisma.project.findFirst({
        where: {
          userId,
          status: "active",
          updatedAt: { lt: fiveDaysAgo },
        },
        orderBy: { updatedAt: "asc" },
      }).catch(() => null);

      if (!stale) return null;

      const daysSince = Math.round((Date.now() - stale.updatedAt.getTime()) / 86400000);

      return {
        title: `Projeto parado: ${stale.name}`,
        summary: `"${stale.name}" não tem atualização há ${daysSince} dias.`,
        proposedAction: "Alerta de projeto estagnado.",
        priority: "medium",
        actionType: "alert.create",
        actionInput: {
          module: "career",
          icon: "PRJ",
          color: "#F59E0B",
          title: `⏸ ${stale.name} parado há ${daysSince} dias`,
          text: `O projeto "${stale.name}" está sem atualização. Está bloqueado, desprioritizado ou precisa de impulso? Posso ajudar a identificar o próximo passo.`,
          action: "Abrir CARREIRA",
          priority: "medium",
          dedupKey: `stale_project_${stale.id}_${new Date().toISOString().slice(0, 10)}`,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        },
      };
    },
  },


  // ── Habit Intelligence (diário, 20h) ─────────────────────────
  {
    id: "habit_intelligence",
    priority: "low",
    maxPerDay: 1,
    evaluate: async (ctx, userId) => {
      if (ctx.nowHour !== 20) return null;

      const insights = await analyzeHabits(userId).catch(() => []);
      const broken = insights.find((i) => i.type === "streak_broken");
      if (broken) {
        return {
          title: "Habito pausado",
          summary: broken.message,
          proposedAction: "Criar alerta de habito.",
          priority: "low" as AlertPriority,
          actionType: "alert.create" as InternalActionType,
          actionInput: {
            module: "habits",
            icon: "HBT",
            color: "#F59E0B",
            title: broken.habitName + " parou",
            text: broken.message,
            action: "Abrir HABITOS",
            priority: "low",
            dedupKey: "habit_broken_" + broken.habitId + "_" + new Date().toISOString().slice(0, 10),
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          },
        };
      }
      return null;
    },
  },



// ── Social CRM nudges (terça e quinta, 10h) ──────────────────
  {
    id: "social_crm_nudge",
    priority: "low",
    maxPerDay: 1,
    evaluate: async (ctx, userId) => {
      if (ctx.nowHour !== 10 || (ctx.dayOfWeek !== 2 && ctx.dayOfWeek !== 4)) return null;

      const nudges = await getContactNudges(userId).catch(() => []);
      const top = nudges[0];
      if (!top) return null;

      return {
        title: "Reconectar: " + top.contactName,
        summary: top.reason,
        proposedAction: "Criar alerta de contato.",
        priority: "low" as AlertPriority,
        actionType: "alert.create" as InternalActionType,
        actionInput: {
          module: "social",
          icon: "PPL",
          color: "#7C3AED",
          title: "Faz tempo: " + top.contactName,
          text: top.reason + "\n" + top.suggestedAction,
          action: "Abrir SOCIAL",
          priority: "low",
          dedupKey: "social_nudge_" + top.contactId + "_" + new Date().toISOString().slice(0, 10),
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        },
      };
    },
  },

  // ── Financial check (1x por semana, segunda 9h) ──────────────
  {
    id: "financial_budget_check",
    priority: "low",
    maxPerDay: 1,
    evaluate: async (ctx, userId) => {
      if (ctx.dayOfWeek !== 1 || ctx.nowHour !== 9) return null;

      // Auto-categorize first
      await autoCategorize(userId).catch(() => {});

      const alerts = await checkBudgetLimits(userId).catch(() => []);
      const critical = alerts.filter((a) => a.alert === "critical");
      if (!critical.length) return null;

      const topAlert = critical[0]!;
      return {
        title: "Orcamento: " + topAlert.category,
        summary: topAlert.category + ": " + topAlert.percentUsed + "% do limite usado.",
        proposedAction: "Criar alerta financeiro.",
        priority: "medium" as AlertPriority,
        actionType: "alert.create" as InternalActionType,
        actionInput: {
          module: "finance",
          icon: "CFO",
          color: "#EF4444",
          title: "Orcamento " + topAlert.category + ": " + topAlert.percentUsed + "%",
          text: "R$ " + topAlert.spent.toFixed(2) + " de R$ " + topAlert.limit.toFixed(2) + " (" + topAlert.percentUsed + "%). Considere reduzir gastos nessa categoria.",
          action: "Abrir CFO PESSOAL",
          priority: "medium",
          dedupKey: "budget_" + topAlert.category + "_" + new Date().toISOString().slice(0, 7),
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        },
      };
    },
  },


  // ── Daily Digest (22h) ───────────────────────────────────────
  {
    id: "daily_digest",
    priority: "low",
    maxPerDay: 1,
    evaluate: async (ctx: TriggerContext, userId: string) => {
      if (ctx.nowHour !== 22) return null;
      await createDailyDigestAlert(userId);
      return null;
    },
  },
];

// ─── Runner principal ─────────────────────────────────────────────

function buildContext(user: { profile: { timezone: string } | null }): TriggerContext {
  const now = new Date();
  const timezone = user.profile?.timezone ?? "America/Sao_Paulo";
  const localStr = now.toLocaleString("en-US", { timeZone: timezone, hour12: false });
  const local = new Date(localStr);
  const dow = local.getDay();
  const hour = local.getHours();

  return {
    userId: "",
    timezone,
    nowHour: hour,
    nowMinute: local.getMinutes(),
    dayOfWeek: dow,
    isWeekend: dow === 0 || dow === 6,
    isWorkHour: hour >= 9 && hour <= 18 && dow >= 1 && dow <= 5,
  };
}

export async function runTriggerEngineForUser(userId: string): Promise<TriggerResult[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user) return [];

  const ctx = { ...buildContext(user), userId };
  const results: TriggerResult[] = [];

    for (const trigger of TRIGGERS) {
    const firedToday = await alreadyFiredToday(userId, trigger.id);
    if (firedToday) {
      results.push({ triggerId: trigger.id, fired: false, actionRouted: false, reason: "já disparou hoje" });
      continue;
    }

    const action = await trigger.evaluate(ctx, userId).catch((err) => {
      console.warn(`[trigger:${trigger.id}] user ${userId}:`, (err as Error).message);
      return null;
    });

    if (!action) {
      results.push({ triggerId: trigger.id, fired: false, actionRouted: false, reason: "condição não ativa" });
      continue;
    }

    // Rate limit: máx 3 interrupções não críticas por dia
    if (trigger.priority !== "critical" && trigger.priority !== "high") {
      const todayCount = await countTodayInterruptions(userId);
      if (todayCount >= 3) {
        results.push({ triggerId: trigger.id, fired: false, actionRouted: false, reason: "limite diário de interrupções atingido" });
        continue;
      }
    }

    await routeInternalAction(userId, action).catch(console.warn);
    await markFiredToday(userId, trigger.id);
    await recordInterruption(userId);

    results.push({ triggerId: trigger.id, fired: true, actionRouted: true, reason: "disparado" });
  }

  return results;
}

export async function runTriggerEngineForAll(): Promise<{ scanned: number; fired: number }> {
  const users = await prisma.user.findMany({ select: { id: true } });
  let fired = 0;

  for (const user of users) {
    const results = await runTriggerEngineForUser(user.id).catch(() => []);
    fired += results.filter((r) => r.fired).length;
  }

  return { scanned: users.length, fired };
}
