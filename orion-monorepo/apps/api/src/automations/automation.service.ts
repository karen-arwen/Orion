import { Prisma, type TriggerType } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { automationQueue, type AutomationJobData } from "./queues.js";

interface AutomationAction {
  type: "chat_message" | "send_alert" | "create_task" | "log";
  prompt?: string;
  title?: string;
  text?: string;
  module?: string;
  priority?: "low" | "medium" | "high" | "critical";
}

interface TriggerConfig {
  cron?: string;
  event?: string;
  days_since?: number;
  metric?: string;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseActions(value: Prisma.JsonValue): AutomationAction[] {
  const items: unknown[] = Array.isArray(value) ? value : [];
  return items
    .filter(isRecord)
    .map((item) => ({
      type: item.type === "chat_message" || item.type === "send_alert" || item.type === "create_task" ? item.type : "log",
      prompt: typeof item.prompt === "string" ? item.prompt : undefined,
      title: typeof item.title === "string" ? item.title : undefined,
      text: typeof item.text === "string" ? item.text : undefined,
      module: typeof item.module === "string" ? item.module : undefined,
      priority:
        item.priority === "low" || item.priority === "medium" || item.priority === "high" || item.priority === "critical"
          ? item.priority
          : undefined,
    }));
}

function parseTriggerConfig(value: Prisma.JsonValue): TriggerConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return {
    cron: typeof value.cron === "string" ? value.cron : undefined,
    event: typeof value.event === "string" ? value.event : undefined,
    days_since: typeof value.days_since === "number" ? value.days_since : undefined,
    metric: typeof value.metric === "string" ? value.metric : undefined,
  };
}

async function conditionsPass(_conditions: Prisma.JsonValue | null): Promise<boolean> {
  return true;
}

async function createConfirmationAlert(
  userId: string,
  automationId: string,
  actionText: string,
  timeoutMinutes: number,
): Promise<void> {
  await prisma.proactiveAlert.create({
    data: {
      userId,
      module: "AUTOMATION",
      icon: "◇",
      color: "#00D4FF",
      title: "Confirmação necessária",
      text: actionText,
      action: `CONFIRM_AUTOMATION:${automationId}`,
      priority: "medium",
      expiresAt: new Date(Date.now() + timeoutMinutes * 60 * 1000),
    },
  });
}

export async function enqueueAutomation(automationId: string, source: AutomationJobData["source"]): Promise<void> {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    select: { id: true, userId: true },
  });
  if (!automation) throw new Error("Automation not found");
  await automationQueue.add(
    `automation:${automation.id}:${source}`,
    { automationId: automation.id, userId: automation.userId, source },
    { jobId: `${automation.id}:${source}:${Date.now()}` },
  );
}

export async function scheduleCronAutomation(automationId: string): Promise<void> {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    select: { id: true, userId: true, enabled: true, triggerType: true, triggerConfig: true },
  });
  if (!automation?.enabled) return;
  if (automation.triggerType !== "cron" && automation.triggerType !== "temporal") return;
  const config = parseTriggerConfig(automation.triggerConfig);
  if (!config.cron) return;

  await automationQueue.add(
    `automation:${automation.id}:cron`,
    { automationId: automation.id, userId: automation.userId, source: "cron" },
    {
      jobId: `repeat:${automation.id}`,
      repeat: { pattern: config.cron },
    },
  );
}

export async function scheduleAllCronAutomations(): Promise<void> {
  const automations = await prisma.automation.findMany({
    where: { enabled: true, triggerType: { in: ["cron", "temporal"] } },
    select: { id: true },
  });
  await Promise.all(automations.map((automation) => scheduleCronAutomation(automation.id)));
}

export async function createDefaultAutomationsForUser(userId: string): Promise<void> {
  const defaults: Array<{
    name: string;
    description: string;
    triggerType: TriggerType;
    triggerConfig: Prisma.InputJsonValue;
    conditions?: Prisma.InputJsonValue;
    actions: Prisma.InputJsonValue;
    requiresConfirmation?: boolean;
  }> = [
    {
      name: "Morning Brief",
      description: "Resumo de emails, agenda e 3 prioridades do dia.",
      triggerType: "cron",
      triggerConfig: { cron: "0 8 * * 1-5" },
      actions: [{ type: "send_alert", module: "AGENDA", title: "Morning Brief", text: "Gerar briefing executivo do dia." }],
    },
    {
      name: "Modo Foco",
      description: "Ativa foco quando contexto de IDE aparecer.",
      triggerType: "contextual",
      triggerConfig: { event: "ide.opened" },
      actions: [{ type: "send_alert", module: "FOCO", title: "Modo Foco", text: "Ativar foco e sugerir Pomodoro." }],
      requiresConfirmation: true,
    },
    {
      name: "Rotina Noturna",
      description: "Resumo do dia, checklist de amanhã e modo relax.",
      triggerType: "cron",
      triggerConfig: { cron: "30 22 * * *" },
      actions: [{ type: "send_alert", module: "LIFE", title: "Rotina Noturna", text: "Fechar o dia e preparar amanhã." }],
    },
    {
      name: "GitHub Nudge",
      description: "Alerta quando projeto ficar parado.",
      triggerType: "behavioral",
      triggerConfig: { days_since: 3, metric: "github_commit" },
      actions: [{ type: "send_alert", module: "CARREIRA", title: "GitHub Nudge", text: "Sugerir uma tarefa rápida para destravar commits." }],
    },
    {
      name: "Deal Watch",
      description: "Monitora descontos relevantes e pede aprovação antes de comprar.",
      triggerType: "event",
      triggerConfig: { price_drop_pct: 40 },
      actions: [{ type: "send_alert", module: "COMPRAS", title: "Deal Watch", text: "Produto da wishlist caiu forte de preço." }],
      requiresConfirmation: true,
    },
    {
      name: "Content Planner",
      description: "Ideias de posts baseadas em interesses e trends.",
      triggerType: "cron",
      triggerConfig: { cron: "0 10 * * 1,3,5" },
      actions: [{ type: "chat_message", module: "CRIACAO", title: "Content Planner", prompt: "Gere 3 ideias de post com base nos interesses e tendencias atuais." }],
    },
    {
      name: "Energy Check",
      description: "Detecta queda de energia e sugere realocação de tarefas.",
      triggerType: "behavioral",
      triggerConfig: { time: "16:00", pattern: "low_energy_detected" },
      actions: [{ type: "send_alert", module: "SAUDE", title: "Energy Check", text: "Sugerir pausa e mover tarefa pesada para horario melhor." }],
    },
  ];

  for (const item of defaults) {
    const automation = await prisma.automation.upsert({
      where: { id: `${userId}:${item.name}` },
      update: {},
      create: {
        userId,
        name: item.name,
        description: item.description,
        triggerType: item.triggerType,
        triggerConfig: item.triggerConfig,
        conditions: item.conditions,
        actions: item.actions,
        requiresConfirmation: item.requiresConfirmation ?? false,
        enabled: true,
      },
    }).catch(async () => {
      const existing = await prisma.automation.findFirst({
        where: { userId, name: item.name },
        select: { id: true },
      });
      if (existing) return existing;
      return prisma.automation.create({
        data: {
          userId,
          name: item.name,
          description: item.description,
          triggerType: item.triggerType,
          triggerConfig: item.triggerConfig,
          conditions: item.conditions,
          actions: item.actions,
          requiresConfirmation: item.requiresConfirmation ?? false,
          enabled: true,
        },
      });
    });
    await scheduleCronAutomation(automation.id);
  }
}

export async function executeAutomationJob(data: AutomationJobData): Promise<{ status: string }> {
  const startedAt = Date.now();
  const automation = await prisma.automation.findFirst({
    where: { id: data.automationId, userId: data.userId },
    select: {
      id: true,
      userId: true,
      name: true,
      enabled: true,
      conditions: true,
      actions: true,
      requiresConfirmation: true,
      confirmationTimeout: true,
    },
  });

  if (!automation || !automation.enabled) {
    return { status: "skipped" };
  }

  const pass = await conditionsPass(automation.conditions);
  if (!pass) {
    await prisma.automationLog.create({
      data: {
        automationId: automation.id,
        status: "skipped",
        result: asJson({ reason: "conditions_failed", source: data.source }),
        executionMs: Date.now() - startedAt,
      },
    });
    return { status: "skipped" };
  }

  const actions = parseActions(automation.actions);
  const actionText = actions
    .map((action) => action.text ?? action.prompt ?? action.title ?? action.type)
    .filter((value) => value.length > 0)
    .join("\n");

  if (automation.requiresConfirmation) {
    await createConfirmationAlert(
      automation.userId,
      automation.id,
      actionText || `Automação "${automation.name}" aguardando aprovação.`,
      automation.confirmationTimeout,
    );
    await prisma.automationLog.create({
      data: {
        automationId: automation.id,
        status: "pending_confirmation",
        result: asJson({ source: data.source, actions }),
        executionMs: Date.now() - startedAt,
      },
    });
    return { status: "pending_confirmation" };
  }

  for (const action of actions) {
    if (action.type === "send_alert" || action.type === "chat_message") {
      await prisma.proactiveAlert.create({
        data: {
          userId: automation.userId,
          module: action.module ?? "AUTOMATION",
          icon: action.type === "chat_message" ? "◆" : "◇",
          color: "#00D4FF",
          title: action.title ?? automation.name,
          text: action.text ?? action.prompt ?? `Automação executada: ${automation.name}`,
          action: action.prompt ?? action.text ?? automation.name,
          priority: action.priority ?? "medium",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  await prisma.$transaction([
    prisma.automationLog.create({
      data: {
        automationId: automation.id,
        status: "executed",
        result: asJson({ source: data.source, actionsExecuted: actions.length }),
        executionMs: Date.now() - startedAt,
      },
    }),
    prisma.automation.update({
      where: { id: automation.id },
      data: { lastTriggered: new Date() },
    }),
  ]);

  return { status: "executed" };
}

export function normalizeTriggerType(triggerType: "cron" | "temporal" | "event" | "behavioral" | "contextual" | "manual"): TriggerType {
  return triggerType;
}
