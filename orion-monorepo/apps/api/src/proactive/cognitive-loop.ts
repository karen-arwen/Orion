import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";
import { routeInternalAction } from "../decisions/action-router.js";
import { runProactivePulseForUser } from "./pulse.js";
import type { AlertPriority, InternalActionType } from "@orion/types";
import { detectCrossModulePatterns } from "../memory/pattern-detector.js";

/* ═══════════════════════════════════════════════════════════════════
   COGNITIVE LOOP — o cérebro que nunca dorme.

   O ORION pensa sobre o usuário em 3 ciclos paralelos:

   MICRO (15min) — verifica triggers urgentes: email novo de VIP,
     reunião em <30min sem prep, preço alvo atingido, etc.
     → age silenciosamente ou cria alerta de alta prioridade.

   PULSE (1h) — análise de estado: tarefas vencidas, hábitos, saúde,
     finanças, projetos parados. Roda o pulse.ts existente.
     → já implementado, apenas orquestra aqui.

   DEEP (diário, 7h) — raciocínio profundo via Claude:
     lê o contexto completo do usuário, detecta padrões ao longo
     de dias/semanas, gera insights, sugere mudanças proativas.
     → o diferencial real. O ORION que "percebe" a vida do usuário.

   Cada ciclo tem rate limiting por usuário pra não saturar nem
   fazer spam. O DEEP usa Claude para raciocinar — é custoso mas
   roda só uma vez por dia por usuário.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ─── Tipos internos ────────────────────────────────────────────────

export type CycleType = "micro" | "pulse" | "deep";

export interface CycleResult {
  userId: string;
  cycle: CycleType;
  actionsRouted: number;
  insights: string[];
  skipped: boolean;
  reason?: string;
}

interface CognitiveAction {
  title: string;
  summary: string;
  proposedAction: string;
  priority: AlertPriority;
  actionType: InternalActionType;
  actionInput: Record<string, unknown>;
}

interface DeepInsight {
  pattern: string;           // o que o ORION percebeu
  suggestion: string;        // o que ele propõe
  actionType: InternalActionType | "insight.only";
  actionInput?: Record<string, unknown>;
  priority: AlertPriority;
}

// ─── Rate limiting ─────────────────────────────────────────────────

async function canRunCycle(userId: string, cycle: CycleType): Promise<boolean> {
  const cooldowns: Record<CycleType, number> = {
    micro: 12 * 60,        // 12 min entre micros por usuário
    pulse: 50 * 60,        // 50 min entre pulses
    deep: 20 * 3600,       // 20h entre deeps
  };
  const key = `cognitive:${cycle}:${userId}`;
  const exists = await redis.exists(key);
  if (exists) return false;
  await redis.set(key, "1", "EX", cooldowns[cycle]);
  return true;
}

// ─── CICLO MICRO (15min) ───────────────────────────────────────────
// Verifica triggers urgentes. Rápido, leve, sem Claude.

async function runMicroCycle(userId: string): Promise<CycleResult> {
  const result: CycleResult = { userId, cycle: "micro", actionsRouted: 0, insights: [], skipped: false };

  const now = new Date();
  const in30min = new Date(now.getTime() + 30 * 60 * 1000);
  const in60min = new Date(now.getTime() + 60 * 60 * 1000);

  const actions: CognitiveAction[] = [];

  // 1. Reunião em <30min sem nota de prep
  const soonEvents: Array<{ id: string; title: string; startTime: Date }> = [];

  for (const event of soonEvents) {
    const hasNote = await prisma.proactiveAlert.findFirst({
      where: { userId, dedupKey: `meeting_prep_${event.id}` },
    }).catch(() => null);

    if (!hasNote) {
      actions.push({
        title: `Prep: ${event.title}`,
        summary: `Reunião "${event.title}" começa em menos de 30 minutos.`,
        proposedAction: "Criar alerta de preparação rápida.",
        priority: "high",
        actionType: "alert.create",
        actionInput: {
          module: "agenda",
          icon: "MTG",
          color: "#00D4FF",
          title: `⚡ Em breve: ${event.title}`,
          text: `Reunião em ${Math.round((event.startTime.getTime() - now.getTime()) / 60000)} min. Quer que eu prepare pontos de pauta ou revise contexto?`,
          action: "Abrir AGENDA e preparar",
          priority: "high",
          dedupKey: `meeting_prep_${event.id}`,
          expiresAt: new Date(event.startTime.getTime() + 15 * 60 * 1000).toISOString(),
        },
      });
    }
  }

  // 2. Reunião em 1h sem prep registrado (alerta mais suave)
  const upcoming1h: Array<{ id: string; title: string; startTime: Date }> = [];

  for (const event of upcoming1h) {
    const hasAlert = await prisma.proactiveAlert.findFirst({
      where: { userId, dedupKey: `meeting_1h_${event.id}` },
    }).catch(() => null);

    if (!hasAlert) {
      actions.push({
        title: `Aviso antecipado: ${event.title}`,
        summary: `Reunião em ~1h: "${event.title}".`,
        proposedAction: "Criar alerta de aviso antecipado.",
        priority: "medium",
        actionType: "alert.create",
        actionInput: {
          module: "agenda",
          icon: "CLK",
          color: "#818CF8",
          title: `Em 1h: ${event.title}`,
          text: `Você tem "${event.title}" às ${event.startTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Precisa de algo antes?`,
          action: "Ver AGENDA",
          priority: "medium",
          dedupKey: `meeting_1h_${event.id}`,
          expiresAt: in60min.toISOString(),
        },
      });
    }
  }

  // 3. Wishlist com preço alvo atingido (check rápido)
  const priceHits = await prisma.wishlistItem.findMany({
    where: {
      userId,
      currentPrice: { not: null },
      targetPrice: { not: null },
    },
  }).catch(() => []);

  for (const item of priceHits) {
    if (item.currentPrice != null && item.targetPrice != null && item.currentPrice <= item.targetPrice) {
      const key = `price_hit_${item.id}_${item.currentPrice}`;
      const exists = await prisma.proactiveAlert.findFirst({ where: { userId, dedupKey: key } }).catch(() => null);
      if (!exists) {
        actions.push({
          title: `Preço alvo: ${item.name}`,
          summary: `${item.name} está em R$ ${item.currentPrice?.toFixed(2)} — meta era R$ ${item.targetPrice?.toFixed(2)}.`,
          proposedAction: "Alerta de preço atingido.",
          priority: "medium",
          actionType: "alert.create",
          actionInput: {
            module: "shop",
            icon: "BUY",
            color: "#F59E0B",
            title: `🎯 Preço alvo: ${item.name}`,
            text: `${item.name} chegou em R$ ${item.currentPrice?.toFixed(2)} (meta: R$ ${item.targetPrice?.toFixed(2)}). Compra?`,
            action: "Abrir COMPRAS",
            priority: "medium",
            dedupKey: key,
            expiresAt: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
          },
        });
      }
    }
  }

  // 4. Tarefa com deadline em <2h
  const urgentTasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: ["todo", "doing"] },
      dueAt: { gte: now, lte: new Date(now.getTime() + 2 * 3600 * 1000) },
    },
    take: 2,
  }).catch(() => []);

  for (const task of urgentTasks) {
    if (!task.dueAt) continue;
    const key = `task_urgent_${task.id}`;
    const exists = await prisma.proactiveAlert.findFirst({ where: { userId, dedupKey: key } }).catch(() => null);
    if (!exists) {
      const minsLeft = Math.round((task.dueAt.getTime() - now.getTime()) / 60000);
      actions.push({
        title: `Prazo urgente: ${task.title}`,
        summary: `Tarefa "${task.title}" vence em ${minsLeft} minutos.`,
        proposedAction: "Alerta de prazo urgente.",
        priority: "high",
        actionType: "alert.create",
        actionInput: {
          module: "life",
          icon: "URG",
          color: "#EF4444",
          title: `🔴 ${minsLeft}min: ${task.title}`,
          text: `Tarefa com prazo iminente. Está em andamento ou precisa ser reagendada?`,
          action: "Abrir LIFE OS",
          priority: "high",
          dedupKey: key,
          expiresAt: task.dueAt.toISOString(),
        },
      });
    }
  }

  // Routa até 3 ações
  for (const action of actions.slice(0, 3)) {
    await routeInternalAction(userId, action).catch(console.warn);
    result.actionsRouted++;
  }

  return result;
}

// ─── CICLO DEEP (diário) ───────────────────────────────────────────
// Claude raciocina sobre o estado da vida do usuário e gera insights.

const DEEP_SYSTEM = `Você é o núcleo cognitivo do O.R.I.O.N — um sistema de inteligência pessoal autônomo.

Sua tarefa agora é RACIOCINAR sobre o estado atual da vida do usuário e identificar:
1. Padrões preocupantes ou positivos que merecem atenção
2. Oportunidades que o usuário pode estar perdendo
3. Ações proativas concretas que melhorariam a vida dele hoje

REGRAS CRÍTICAS:
- Seja específico, não genérico. "Você tem 7 tarefas vencidas concentradas em projeto X" é melhor que "você tem tarefas vencidas".
- Priorize qualidade de vida sobre produtividade a qualquer custo.
- Se detectar sobrecarga real, sugira corte — não mais tarefas.
- Insights emocionais são válidos: perceba quando a pessoa parece estressada pelos dados.
- NUNCA invente dados. Só use o que está no contexto fornecido.
- Máximo 4 insights. Qualidade > quantidade.

FORMATO DE RESPOSTA — JSON puro:
{
  "insights": [
    {
      "pattern": "descrição do padrão detectado (específico, com dados)",
      "suggestion": "ação ou reflexão que você propõe",
      "actionType": "alert.create | task.create | memory.create | insight.only",
      "priority": "low | medium | high | critical",
      "actionInput": { ... } // só se actionType não for "insight.only"
    }
  ]
}`;

async function runDeepCycle(userId: string): Promise<CycleResult> {
  const result: CycleResult = { userId, cycle: "deep", actionsRouted: 0, insights: [], skipped: false };

  // Coleta contexto rico
  const [user, snapshot, memories, patterns, recentConvs, sleepLogs, focusSessions, habitLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    }),
    captureBrainSnapshot(userId).catch(() => null),
    prisma.memory.findMany({
      where: { userId, importance: { gte: 0.5 } },
      orderBy: { importance: "desc" },
      take: 20,
    }).catch(() => []),
    prisma.userPattern.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }).catch(() => []),
    prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { title: true, updatedAt: true },
    }).catch(() => []),
    prisma.sleepLog.findMany({
      where: { userId },
      orderBy: { bedTime: "desc" },
      take: 7,
    }).catch(() => []),
    prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
      orderBy: { startedAt: "desc" },
      take: 10,
    }).catch(() => []),
    prisma.habitLog.findMany({
      where: {
        habit: { userId },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
      },
      include: { habit: { select: { name: true } } },
      take: 30,
    }).catch(() => []),
  ]);

  if (!user) {
    result.skipped = true;
    result.reason = "usuário não encontrado";
    return result;
  }

  const brainText = snapshot ? renderBrainContext(snapshot) : "contexto indisponível";

  // Monta o contexto para o Claude raciocinar
  const memoryBlock = memories.length > 0
    ? memories.map((m) => `• [${m.type}] ${m.content}`).join("\n")
    : "nenhuma memória relevante";

  const patternBlock = patterns.length > 0
    ? patterns.map((p) => `• ${p.patternType}: ${JSON.stringify(p.data)} (conf: ${p.confidence})`).join("\n")
    : "sem padrões detectados";

  const sleepBlock = sleepLogs.length > 0
    ? sleepLogs.map((s) => {
        const duration = s.wakeTime && s.bedTime
          ? ((s.wakeTime.getTime() - s.bedTime.getTime()) / 3600000).toFixed(1) + "h"
          : "?";
        return `• ${s.bedTime.toLocaleDateString("pt-BR")}: ${duration} dormido, qualidade ${s.quality ?? "?"}/5`;
      }).join("\n")
    : "sem registros de sono";

  const focusBlock = focusSessions.length > 0
    ? `${focusSessions.filter((f) => f.completed).length}/${focusSessions.length} sessões completadas nos últimos 7 dias`
    : "sem sessões de foco";

  const habitBlock = habitLogs.length > 0
    ? (() => {
        const byHabit: Record<string, number> = {};
        for (const log of habitLogs) {
          const name = log.habit.name;
          byHabit[name] = (byHabit[name] ?? 0) + 1;
        }
        return Object.entries(byHabit).map(([name, count]) => `• ${name}: ${count}/7 dias`).join("\n");
      })()
    : "sem logs de hábitos na semana";

  const conversationContext = recentConvs.length > 0
    ? recentConvs.map((c) => `• ${c.updatedAt.toLocaleDateString("pt-BR")}: ${c.title ?? "sem titulo"}`).join("\n")
    : "sem conversas recentes";

  const userContext = `
═══ USUÁRIO ═══
Nome: ${user.name}
Modo: ${user.mode}
Bio: ${user.profile?.bio ?? "—"}

═══ ESTADO ATUAL ═══
${brainText}

═══ MEMÓRIAS IMPORTANTES ═══
${memoryBlock}

═══ PADRÕES DETECTADOS ═══
${patternBlock}

═══ SONO (últimos 7 dias) ═══
${sleepBlock}

═══ FOCO (últimos 7 dias) ═══
${focusBlock}

═══ HÁBITOS (últimos 7 dias) ═══
${habitBlock}

═══ CONVERSAS RECENTES ═══
${conversationContext}
`.trim();

  // Chama Claude para raciocinar
  let rawResponse = "";
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: DEEP_SYSTEM,
      messages: [{ role: "user", content: userContext }],
    });
    rawResponse = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  } catch (err) {
    console.warn(`[cognitive:deep] Claude falhou para user ${userId}:`, (err as Error).message);
    result.skipped = true;
    result.reason = "Claude indisponível";
    return result;
  }

  // Parse dos insights
  let parsed: { insights: DeepInsight[] } = { insights: [] };
  try {
    const cleaned = rawResponse.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(cleaned) as { insights: DeepInsight[] };
  } catch {
    console.warn(`[cognitive:deep] parse falhou para user ${userId}:`, rawResponse.slice(0, 200));
    result.skipped = true;
    result.reason = "parse JSON falhou";
    return result;
  }

  // Salva insights como memórias e roteia ações
  for (const insight of (parsed.insights ?? []).slice(0, 4)) {
    result.insights.push(insight.pattern);

    // Salva o insight como memória de longo prazo
    try {
      const existing = await prisma.memory.findFirst({
        where: { userId, content: { contains: insight.pattern.slice(0, 50) } },
      });
      if (!existing) {
        await prisma.memory.create({
          data: {
            userId,
            type: "fact",
            content: `[DEEP INSIGHT] ${insight.pattern} → ${insight.suggestion}`,
            importance: insight.priority === "critical" ? 0.9
              : insight.priority === "high" ? 0.75
              : insight.priority === "medium" ? 0.5
              : 0.3,
          },
        });
      }
    } catch {
      // não crítico
    }

    // Roteia ações que não são só insights
    if (insight.actionType !== "insight.only" && insight.actionInput) {
      try {
        await routeInternalAction(userId, {
          title: `[ORION Deep] ${insight.pattern.slice(0, 60)}`,
          summary: insight.suggestion,
          proposedAction: insight.suggestion,
          priority: insight.priority,
          actionType: insight.actionType as InternalActionType,
          actionInput: insight.actionInput,
        });
        result.actionsRouted++;
      } catch (err) {
        console.warn(`[cognitive:deep] rota falhou:`, (err as Error).message);
      }
    }
  }

  // Run cross-module pattern detection
  const crossPatterns = await detectCrossModulePatterns(userId).catch(() => []);
  for (const p of crossPatterns) {
    result.insights.push(`[PATTERN] ${p.description} → ${p.actionable}`);
  }

  return result;
}

// ─── ORQUESTRADOR PRINCIPAL ────────────────────────────────────────

export async function runCognitiveLoop(userId: string, cycle: CycleType): Promise<CycleResult> {
  const canRun = await canRunCycle(userId, cycle);
  if (!canRun) {
    return { userId, cycle, actionsRouted: 0, insights: [], skipped: true, reason: "cooldown ativo" };
  }

  try {
    switch (cycle) {
      case "micro":
        return await runMicroCycle(userId);

      case "pulse": {
        // Reutiliza o pulse existente — bem testado
        const userProfile = await prisma.user.findUnique({
          where: { id: userId },
          select: { profile: { select: { timezone: true } } },
        });
        const pulseResult = await runProactivePulseForUser({
          userId,
          timezone: userProfile?.profile?.timezone ?? "America/Sao_Paulo",
        });
        return {
          userId,
          cycle: "pulse",
          actionsRouted: pulseResult.routed,
          insights: pulseResult.results.map((r) => r.title),
          skipped: false,
        };
      }

      case "deep":
        return await runDeepCycle(userId);
    }
  } catch (err) {
    console.error(`[cognitive:${cycle}] user ${userId} erro:`, (err as Error).message);
    return { userId, cycle, actionsRouted: 0, insights: [], skipped: true, reason: (err as Error).message };
  }
}

// ─── RUNNER PARA TODOS OS USUÁRIOS ────────────────────────────────

export async function runCognitiveLoopForAll(cycle: CycleType): Promise<{
  scanned: number;
  executed: number;
  skipped: number;
  totalActions: number;
}> {
  const users = await prisma.user.findMany({
    select: { id: true },
  });

  let executed = 0;
  let skipped = 0;
  let totalActions = 0;

  for (const user of users) {
    const result = await runCognitiveLoop(user.id, cycle).catch((err) => {
      console.warn(`[cognitive:${cycle}] user ${user.id} falhou:`, (err as Error).message);
      return null;
    });

    if (!result || result.skipped) {
      skipped++;
    } else {
      executed++;
      totalActions += result.actionsRouted;
    }
  }

  return { scanned: users.length, executed, skipped, totalActions };
}
