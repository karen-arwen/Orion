import Anthropic from "@anthropic-ai/sdk";
import type { Automation, AutomationLog, OrionMode } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";

/* ═══════════════════════════════════════════════════════════════════
   Engine de automações.

   Responsabilidades:
   - Aplicar conditions (filtros tipo "modo != SILENCIOSO")
   - Executar a lista de actions sequencialmente
   - Se requiresConfirmation: cria ProactiveAlert pending em vez de
     executar direto. O usuário aprova → engine roda de novo passando
     a flag confirmed.
   - Logar resultado (status, executionMs, result JSON)

   Tipos de action suportados:
   - generate_brief:  Claude gera um texto com brain context → vira ProactiveAlert
   - send_alert:      cria ProactiveAlert direto (sem IA)
   - chat_message:    insere mensagem no chat principal do usuário (futuro)
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface AutomationAction {
  type: "generate_brief" | "send_alert" | "chat_message";
  config: Record<string, unknown>;
}

export interface AutomationConditions {
  mode_not?: OrionMode;
  mode_in?: OrionMode[];
  hour_between?: [number, number];
  /** Não dispara se já rodou nas últimas N horas (anti-spam) */
  cooldown_hours?: number;
}

interface RunContext {
  manual?: boolean;
  /** Se chamado depois de aprovação de alerta de confirmação */
  confirmed?: boolean;
}

// ── CONDITIONS ──────────────────────────────────────────────────────

function passesConditions(
  automation: Automation,
  user: { mode: OrionMode },
  conditions: AutomationConditions | null,
): { ok: true } | { ok: false; reason: string } {
  if (!conditions) return { ok: true };

  if (conditions.mode_not && user.mode === conditions.mode_not) {
    return { ok: false, reason: `bloqueado em modo ${user.mode}` };
  }
  if (conditions.mode_in && !conditions.mode_in.includes(user.mode)) {
    return { ok: false, reason: `modo ${user.mode} fora de [${conditions.mode_in.join(",")}]` };
  }
  if (conditions.hour_between) {
    const now = new Date().getHours();
    const [from, to] = conditions.hour_between;
    if (from <= to ? now < from || now > to : now < from && now > to) {
      return { ok: false, reason: `fora da janela ${from}-${to}h` };
    }
  }
  if (conditions.cooldown_hours && automation.lastTriggered) {
    const since = Date.now() - automation.lastTriggered.getTime();
    if (since < conditions.cooldown_hours * 3600 * 1000) {
      const remaining = Math.round((conditions.cooldown_hours * 3600 * 1000 - since) / 60_000);
      return { ok: false, reason: `cooldown ativo (${remaining}min restantes)` };
    }
  }
  return { ok: true };
}

// ── ACTIONS ─────────────────────────────────────────────────────────

interface ActionResult {
  type: string;
  ok: boolean;
  details: Record<string, unknown>;
}

async function actGenerateBrief(
  userId: string,
  config: Record<string, unknown>,
): Promise<ActionResult> {
  const persona = typeof config.persona === "string" ? config.persona : "morning brief";
  const prompt = typeof config.prompt === "string" ? config.prompt : "Gere um briefing executivo curto baseado no contexto. 3-5 linhas, tom Jarvis.";
  const module = typeof config.module === "string" ? config.module : "morning_brief";
  const icon = typeof config.icon === "string" ? config.icon : "◐";
  const color = typeof config.color === "string" ? config.color : "#F59E0B";

  const snap = await captureBrainSnapshot(userId);
  const ctx = renderBrainContext(snap);

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 500,
    temperature: 0.7,
    system: `Você é o O.R.I.O.N. em modo ${persona}. Português BR, sofisticado, conciso.\n${prompt}`,
    messages: [{ role: "user", content: ctx }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) return { type: "generate_brief", ok: false, details: { error: "claude_empty" } };

  const today = new Date().toISOString().slice(0, 10);
  await prisma.proactiveAlert.upsert({
    where: {
      userId_dedupKey: {
        userId,
        dedupKey: `${module}:${today}`,
      },
    },
    create: {
      userId,
      module,
      icon,
      color,
      title: typeof config.title === "string" ? config.title : "Brief do dia",
      text,
      action: typeof config.action === "string" ? config.action : "Vamos atacar essa lista agora",
      priority: "medium",
      dedupKey: `${module}:${today}`,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
    update: { text },
  });

  return { type: "generate_brief", ok: true, details: { module, length: text.length } };
}

async function actSendAlert(
  userId: string,
  config: Record<string, unknown>,
): Promise<ActionResult> {
  const title = typeof config.title === "string" ? config.title : "Alerta";
  const text = typeof config.text === "string" ? config.text : "";
  const action = typeof config.action === "string" ? config.action : "";
  const module = typeof config.module === "string" ? config.module : "system";
  const priority =
    config.priority === "high" || config.priority === "low" ? config.priority : "medium";
  const icon = typeof config.icon === "string" ? config.icon : "◈";
  const color = typeof config.color === "string" ? config.color : "#00D4FF";
  const dedupKey = typeof config.dedupKey === "string" ? config.dedupKey : null;
  const ttlHours = typeof config.ttlHours === "number" ? config.ttlHours : 24;

  await prisma.proactiveAlert.upsert({
    where: dedupKey
      ? { userId_dedupKey: { userId, dedupKey } }
      : { userId_dedupKey: { userId, dedupKey: `${module}:${Date.now()}` } },
    create: {
      userId,
      module,
      icon,
      color,
      title,
      text,
      action,
      priority,
      dedupKey: dedupKey ?? `${module}:${Date.now()}`,
      expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000),
    },
    update: { text, action, priority, expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000) },
  });

  return { type: "send_alert", ok: true, details: { module, dedupKey } };
}

async function executeActions(
  userId: string,
  actions: AutomationAction[],
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const action of actions) {
    try {
      switch (action.type) {
        case "generate_brief":
          results.push(await actGenerateBrief(userId, action.config));
          break;
        case "send_alert":
          results.push(await actSendAlert(userId, action.config));
          break;
        case "chat_message":
          // Stub — implementação completa exige sistema de message injection no chat
          results.push({ type: "chat_message", ok: true, details: { note: "stub" } });
          break;
        default:
          results.push({
            type: action.type,
            ok: false,
            details: { error: `unknown action type: ${action.type}` },
          });
      }
    } catch (err) {
      results.push({
        type: action.type,
        ok: false,
        details: { error: (err as Error).message },
      });
    }
  }
  return results;
}

// ── MAIN ENTRY POINT ────────────────────────────────────────────────

export async function runAutomation(
  automationId: string,
  ctx: RunContext = {},
): Promise<AutomationLog> {
  const started = Date.now();
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { user: { select: { mode: true } } },
  });
  if (!automation) throw new Error(`Automação ${automationId} não encontrada`);
  if (!automation.enabled && !ctx.manual) {
    return await prisma.automationLog.create({
      data: {
        automationId,
        status: "skipped",
        result: { reason: "disabled" },
        executionMs: 0,
      },
    });
  }

  // Conditions
  const conditions = automation.conditions as AutomationConditions | null;
  const check = passesConditions(automation, automation.user, conditions);
  if (!check.ok && !ctx.manual) {
    return await prisma.automationLog.create({
      data: {
        automationId,
        status: "skipped",
        result: { reason: check.reason },
        executionMs: Date.now() - started,
      },
    });
  }

  // Requires confirmation? Cria alert de confirmação, não executa ainda.
  if (automation.requiresConfirmation && !ctx.confirmed) {
    await prisma.proactiveAlert.upsert({
      where: {
        userId_dedupKey: {
          userId: automation.userId,
          dedupKey: `automation_confirm:${automation.id}`,
        },
      },
      create: {
        userId: automation.userId,
        module: "automation",
        icon: "⚙",
        color: "#7C3AED",
        title: `Confirmar: ${automation.name}`,
        text: automation.description ?? `Quer executar a automação "${automation.name}"?`,
        action: `Aprovar automação ${automation.name}`,
        priority: "medium",
        dedupKey: `automation_confirm:${automation.id}`,
        expiresAt: new Date(Date.now() + automation.confirmationTimeout * 60_000),
      },
      update: {
        expiresAt: new Date(Date.now() + automation.confirmationTimeout * 60_000),
      },
    });

    return await prisma.automationLog.create({
      data: {
        automationId,
        status: "pending",
        result: { reason: "awaiting_confirmation" },
        executionMs: Date.now() - started,
      },
    });
  }

  // Executa
  const actions = automation.actions as unknown as AutomationAction[];
  const results = await executeActions(automation.userId, Array.isArray(actions) ? actions : []);

  const ok = results.every((r) => r.ok);
  const log = await prisma.automationLog.create({
    data: {
      automationId,
      status: ok ? "success" : "failed",
      result: { results } as unknown as object,
      executionMs: Date.now() - started,
    },
  });

  await prisma.automation.update({
    where: { id: automationId },
    data: { lastTriggered: new Date() },
  });

  return log;
}
