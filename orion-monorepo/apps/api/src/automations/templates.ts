import { prisma } from "../db/prisma.js";
import type { AutomationAction, AutomationConditions } from "./engine.js";
import { automationQueue, JOB_NAMES } from "../queues/index.js";

/* ═══════════════════════════════════════════════════════════════════
   Templates das 7 automações pré-configuradas do O.R.I.O.N.

   - templateKey identifica unicamente. Seed é idempotente: se o user
     já tem uma com esse key, não duplica.
   - Após criar/atualizar uma com triggerType=cron, registramos um
     BullMQ repeating job que dispara runAutomation no schedule certo.
═══════════════════════════════════════════════════════════════════ */

export interface AutomationTemplate {
  templateKey: string;
  name: string;
  description: string;
  triggerType: "cron" | "event" | "behavioral" | "contextual" | "manual";
  triggerConfig: Record<string, unknown>;
  conditions?: AutomationConditions;
  actions: AutomationAction[];
  requiresConfirmation: boolean;
  confirmationTimeout?: number;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    templateKey: "morning_brief",
    name: "Morning Brief",
    description: "Briefing executivo todo dia útil às 8h: agenda + emails urgentes + prioridades",
    triggerType: "cron",
    triggerConfig: { cron: "0 8 * * 1-5", tz: "America/Sao_Paulo" },
    conditions: { mode_not: "SILENCIOSO", cooldown_hours: 12 },
    actions: [
      {
        type: "generate_brief",
        config: {
          persona: "morning brief",
          prompt:
            "Olhe agenda, emails e projetos. Saudação curta com leitura do dia + 2-3 prioridades concretas + pergunta final convidando ação.",
          module: "morning_brief",
          title: "Morning Brief",
          icon: "◐",
          color: "#F59E0B",
          action: "Vamos atacar essa lista",
        },
      },
    ],
    requiresConfirmation: false,
  },
  {
    templateKey: "rotina_noturna",
    name: "Rotina Noturna",
    description: "Resumo do dia + checklist amanhã + sugestão de relax às 22:30",
    triggerType: "cron",
    triggerConfig: { cron: "30 22 * * *", tz: "America/Sao_Paulo" },
    conditions: { mode_not: "SILENCIOSO", cooldown_hours: 18 },
    actions: [
      {
        type: "generate_brief",
        config: {
          persona: "rotina noturna",
          prompt:
            "Resumo curto do que foi feito hoje (com base em agenda/conversas se aparecer no contexto), 2 itens críticos pra amanhã, e uma sugestão de transição pra modo descanso (música, leitura, parar de tela).",
          module: "rotina_noturna",
          title: "Fim do dia",
          icon: "☽",
          color: "#7C3AED",
          action: "Quero a versão expandida no chat",
        },
      },
    ],
    requiresConfirmation: false,
  },
  {
    templateKey: "content_planner",
    name: "Content Planner",
    description: "3 ideias de post seg/qua/sex 10h, baseadas nos interesses do usuário",
    triggerType: "cron",
    triggerConfig: { cron: "0 10 * * 1,3,5", tz: "America/Sao_Paulo" },
    conditions: { cooldown_hours: 20 },
    actions: [
      {
        type: "generate_brief",
        config: {
          persona: "content strategist",
          prompt:
            "Gere 3 ideias de post curtas e DISTINTAS (formatos diferentes: 1 reels, 1 carrossel, 1 thread). Use o perfil/projetos do usuário no contexto. Cada ideia: 1 linha de hook + 1 linha de tese.",
          module: "content_planner",
          title: "Ideias de conteúdo de hoje",
          icon: "✦",
          color: "#EC4899",
          action: "Desenvolve a primeira ideia em rascunho completo",
        },
      },
    ],
    requiresConfirmation: false,
  },
  {
    templateKey: "github_nudge",
    name: "GitHub Nudge",
    description: "Alerta se 3 dias sem commit (precisa GITHUB_TOKEN configurado no .env)",
    triggerType: "behavioral",
    triggerConfig: { days_since: 3, metric: "github_commit" },
    conditions: { cooldown_hours: 48 },
    actions: [
      {
        type: "send_alert",
        config: {
          title: "GitHub parado há 3 dias",
          text: "Sem commits recentes nos seus repos. Quer atacar uma task rápida pra manter ritmo?",
          action: "Sugere uma tarefa rápida de portfólio que dá pra fechar em 1h",
          module: "github_nudge",
          icon: "↑",
          color: "#F59E0B",
          priority: "medium",
          dedupKey: "github_nudge",
          ttlHours: 12,
        },
      },
    ],
    requiresConfirmation: false,
  },
  {
    templateKey: "energy_check",
    name: "Energy Check",
    description: "Toda tarde às 16h pergunta como tá a energia e sugere realocação",
    triggerType: "cron",
    triggerConfig: { cron: "0 16 * * 1-5", tz: "America/Sao_Paulo" },
    conditions: { mode_not: "SILENCIOSO", cooldown_hours: 20 },
    actions: [
      {
        type: "send_alert",
        config: {
          title: "Check de energia",
          text: "Como tá o pique? Se baixo, dá pra trocar tarefa pesada por uma leve agora.",
          action: "Me sugere uma tarefa leve baseada nas minhas pendências",
          module: "energy_check",
          icon: "♡",
          color: "#10B981",
          priority: "low",
          ttlHours: 6,
        },
      },
    ],
    requiresConfirmation: false,
  },
  {
    templateKey: "modo_foco",
    name: "Modo Foco",
    description: "Disparo manual: bloqueia alertas não-críticos e sugere Pomodoro",
    triggerType: "manual",
    triggerConfig: {},
    actions: [
      {
        type: "send_alert",
        config: {
          title: "Modo Foco ativado",
          text: "Alertas não-críticos pausados. Sugiro Pomodoro 50/10. Manda 'sair do foco' quando quiser parar.",
          action: "Inicia Pomodoro 50/10",
          module: "modo_foco",
          icon: "◐",
          color: "#00D4FF",
          priority: "high",
          ttlHours: 4,
        },
      },
    ],
    requiresConfirmation: true,
    confirmationTimeout: 5,
  },
  {
    templateKey: "deal_watch",
    name: "Deal Watch",
    description: "Quando item da wishlist cai -40% — exige aprovação antes de comprar",
    triggerType: "event",
    triggerConfig: { event: "price_drop", threshold_pct: 40 },
    actions: [
      {
        type: "send_alert",
        config: {
          title: "Item da wishlist com desconto",
          text: "Um item da sua lista caiu 40%+. Quer ver detalhes e decidir?",
          action: "Mostra detalhes do item e preço histórico",
          module: "deal_watch",
          icon: "◬",
          color: "#F59E0B",
          priority: "medium",
          ttlHours: 24,
        },
      },
    ],
    requiresConfirmation: true,
    confirmationTimeout: 60,
  },
];

const CRON_TEMPLATES = AUTOMATION_TEMPLATES.filter((t) => t.triggerType === "cron");

/**
 * Cria/atualiza as 7 automações pra um usuário (idempotente).
 * Chamado uma vez no primeiro login de cada usuário.
 */
export async function seedDefaultAutomations(userId: string): Promise<void> {
  for (const tpl of AUTOMATION_TEMPLATES) {
    const existing = await prisma.automation.findFirst({
      where: { userId, templateKey: tpl.templateKey },
    });
    if (existing) continue;

    const created = await prisma.automation.create({
      data: {
        userId,
        templateKey: tpl.templateKey,
        name: tpl.name,
        description: tpl.description,
        triggerType: tpl.triggerType,
        triggerConfig: tpl.triggerConfig,
        conditions: (tpl.conditions ?? null) as object | null,
        actions: tpl.actions as unknown as object,
        requiresConfirmation: tpl.requiresConfirmation,
        confirmationTimeout: tpl.confirmationTimeout ?? 240,
        enabled: tpl.triggerType !== "event", // event triggers desligados por padrão (dependem de módulos futuros)
      },
    });

    // Registra repeating job se for cron
    if (tpl.triggerType === "cron") {
      const cron = (tpl.triggerConfig as { cron?: string; tz?: string }).cron;
      const tz = (tpl.triggerConfig as { cron?: string; tz?: string }).tz ?? "America/Sao_Paulo";
      if (cron) {
        await automationQueue.add(
          JOB_NAMES.RUN_AUTOMATION,
          { automationId: created.id },
          {
            repeat: { pattern: cron, tz },
            jobId: `automation:${created.id}`,
          },
        );
      }
    }
  }
}

/** Re-registra repeating jobs de todas automations cron habilitadas — boot recovery. */
export async function rehydrateRepeatingJobs(): Promise<void> {
  const cronAutos = await prisma.automation.findMany({
    where: { triggerType: "cron", enabled: true },
    select: { id: true, triggerConfig: true },
  });
  for (const a of cronAutos) {
    const cfg = a.triggerConfig as { cron?: string; tz?: string };
    if (!cfg.cron) continue;
    await automationQueue.add(
      JOB_NAMES.RUN_AUTOMATION,
      { automationId: a.id },
      {
        repeat: { pattern: cfg.cron, tz: cfg.tz ?? "America/Sao_Paulo" },
        jobId: `automation:${a.id}`,
      },
    );
  }
  console.log(`◉ Re-hidratados ${cronAutos.length} repeating jobs de automations`);
}

export { CRON_TEMPLATES };
