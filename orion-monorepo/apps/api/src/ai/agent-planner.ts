import type { AlertPriority } from "@prisma/client";
import type { InternalActionType } from "@orion/types";
import type { RouteActionResult } from "../decisions/action-router.js";

export interface PlannedInternalAction {
  title: string;
  summary: string;
  proposedAction: string;
  priority: AlertPriority;
  actionType: InternalActionType;
  actionInput: Record<string, unknown>;
}

export interface AgentPlan {
  intent: string;
  targetModules: string[];
  risk: "safe" | "confirm" | "external";
  confidence: number;
  rationale: string;
  autoRoute: boolean;
  actions: PlannedInternalAction[];
}

export interface RoutedPlannedAction {
  planned: PlannedInternalAction;
  result: RouteActionResult;
}

const MODULE_KEYWORDS: Array<{ moduleId: string; terms: RegExp[] }> = [
  { moduleId: "life", terms: [/tarefa/i, /prioridade/i, /organiza/i, /planeja/i, /portf[oó]lio/i] },
  { moduleId: "memory", terms: [/lembra/i, /mem[oó]ria/i, /salva isso/i, /guardar/i] },
  { moduleId: "finance", terms: [/gasto/i, /receita/i, /assinatura/i, /meta financeira/i, /economizar/i] },
  { moduleId: "shop", terms: [/compr(a|as)/i, /wishlist/i, /pre[cç]o/i, /monitorar/i] },
  { moduleId: "social", terms: [/contato/i, /network/i, /follow-?up/i, /crm/i] },
  { moduleId: "habit", terms: [/h[aá]bito/i, /rotina/i, /streak/i] },
  { moduleId: "security", terms: [/seguran[cç]a/i, /senha/i, /2fa/i, /vazamento/i] },
  { moduleId: "media", terms: [/filme/i, /s[eé]rie/i, /anime/i, /assistir/i] },
  { moduleId: "alerts", terms: [/alerta/i, /me avisa/i, /notifica/i] },
];

const EXTERNAL_RISK = /\b(envia|enviar|mande|mandar|comprar|pagar|delete|deletar|apagar|cancelar|responder email|criar evento)\b/i;

function compact(value: string, max = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trim()}...`;
}

function stripCommandPrefix(message: string): string {
  return compact(
    message
      .replace(/^(orion[,:\s]*)?/i, "")
      .replace(/^(cria|criar|adicione|adicionar|salva|salvar|guarda|guardar|lembra|lembrar|registr(a|e)|monitor(a|e)|me avisa|notifica)\b/i, "")
      .replace(/\b(como tarefa|na mem[oó]ria|como mem[oó]ria|no life os|no orion|pra mim)\b/gi, "")
      .trim(),
    220,
  );
}

function inferModules(message: string): string[] {
  const found = MODULE_KEYWORDS
    .filter((entry) => entry.terms.some((term) => term.test(message)))
    .map((entry) => entry.moduleId);
  return [...new Set(found.length ? found : ["orion"])];
}

function taskAction(message: string): PlannedInternalAction | null {
  if (!/\b(tarefa|cria(?:r)? tarefa|adiciona(?:r)? tarefa|to-?do|todo|fazer)\b/i.test(message)) return null;
  const title = stripCommandPrefix(message).replace(/\btarefa\b/gi, "").trim() || "Tarefa criada pelo Orion";
  return {
    title: `Criar tarefa: ${compact(title, 80)}`,
    summary: "Pedido explícito do usuário para transformar a conversa em uma tarefa executável.",
    proposedAction: `Criar tarefa no Life OS: ${compact(title, 140)}`,
    priority: /urgente|hoje|agora|cr[ií]tico/i.test(message) ? "high" : "medium",
    actionType: "task.create",
    actionInput: {
      title: compact(title, 180),
      notes: `Criado via chat a partir de: "${compact(message, 500)}"`,
      priority: /urgente|cr[ií]tico/i.test(message) ? 3 : 2,
      energy: /simples|r[aá]pido|pequeno/i.test(message) ? 1 : 2,
      estMinutes: /r[aá]pido|15 ?min/i.test(message) ? 15 : 30,
    },
  };
}

function memoryAction(message: string): PlannedInternalAction | null {
  if (!/\b(lembra|memoriza|mem[oó]ria|salva isso|guarda isso|nunca esquece)\b/i.test(message)) return null;
  const content = stripCommandPrefix(message) || message;
  return {
    title: "Salvar memória operacional",
    summary: "O usuário pediu explicitamente para o Orion guardar uma informação para uso futuro.",
    proposedAction: `Salvar memória: ${compact(content, 150)}`,
    priority: "medium",
    actionType: "memory.create",
    actionInput: {
      type: /gosto|prefiro|odeio|adoro|curto/i.test(message) ? "preference" : "fact",
      content: compact(content, 1200),
      importance: /sempre|nunca|importante|odeio|adoro/i.test(message) ? 0.86 : 0.72,
      pinned: /sempre|nunca|muito importante/i.test(message),
    },
  };
}

function habitAction(message: string): PlannedInternalAction | null {
  if (!/\b(h[aá]bito|rotina|streak)\b/i.test(message) || !/\b(cria|criar|adiciona|adicionar|come[cç]ar)\b/i.test(message)) return null;
  const name = stripCommandPrefix(message).replace(/\bh[aá]bito\b/gi, "").trim() || "Novo hábito";
  return {
    title: `Criar hábito: ${compact(name, 80)}`,
    summary: "Pedido explícito para transformar uma intenção recorrente em hábito rastreável.",
    proposedAction: `Criar hábito em Hábitos: ${compact(name, 140)}`,
    priority: "medium",
    actionType: "habit.create",
    actionInput: {
      name: compact(name, 120),
      frequency: /semana|semanal/i.test(message) ? "weekly" : "daily",
      color: "#00D4FF",
      icon: "OK",
    },
  };
}

function alertAction(message: string): PlannedInternalAction | null {
  if (!/\b(me avisa|notifica|alerta|lembrete)\b/i.test(message)) return null;
  const title = stripCommandPrefix(message) || "Alerta criado pelo Orion";
  return {
    title: `Criar alerta: ${compact(title, 80)}`,
    summary: "Pedido explícito para o Orion manter um aviso pendente.",
    proposedAction: `Criar alerta proativo: ${compact(title, 140)}`,
    priority: /urgente|importante|cr[ií]tico/i.test(message) ? "high" : "medium",
    actionType: "alert.create",
    actionInput: {
      module: "orion",
      icon: "!",
      color: "#00D4FF",
      title: compact(title, 150),
      text: `Alerta criado via chat: ${compact(message, 700)}`,
      action: `Retomar: ${compact(title, 300)}`,
      priority: /urgente|importante|cr[ií]tico/i.test(message) ? "high" : "medium",
    },
  };
}

function wishlistAction(message: string): PlannedInternalAction | null {
  if (!/\b(wishlist|lista de compra|monitor(a|e) pre[cç]o|pre[cç]o alvo|quero comprar)\b/i.test(message)) return null;
  const name = stripCommandPrefix(message).replace(/\b(wishlist|pre[cç]o|monitor(a|e))\b/gi, "").trim() || "Item monitorado";
  return {
    title: `Monitorar compra: ${compact(name, 80)}`,
    summary: "Pedido de compras transformado em item de monitoramento manual.",
    proposedAction: `Adicionar item em Compras: ${compact(name, 140)}`,
    priority: "medium",
    actionType: "shop.wishlist.create",
    actionInput: {
      name: compact(name, 180),
      url: "manual://orion-chat",
      notes: `Criado via chat a partir de: "${compact(message, 500)}"`,
    },
  };
}

function socialAction(message: string): PlannedInternalAction | null {
  if (!/\b(contato|crm|network|follow-?up)\b/i.test(message) || !/\b(cria|adiciona|salva|lembrar)\b/i.test(message)) return null;
  const name = stripCommandPrefix(message).replace(/\b(contato|crm|follow-?up)\b/gi, "").trim() || "Contato sem nome";
  return {
    title: `Adicionar contato: ${compact(name, 80)}`,
    summary: "Pedido de relacionamento transformado em registro no Social CRM.",
    proposedAction: `Adicionar contato ao Social CRM: ${compact(name, 140)}`,
    priority: "medium",
    actionType: "social.contact.create",
    actionInput: {
      name: compact(name, 110),
      context: `Criado via chat: ${compact(message, 600)}`,
      nextStep: "Definir próximo contato",
      importance: /importante|cliente|mentor|recrutador/i.test(message) ? 8 : 6,
    },
  };
}


/* ═══════════════════════════════════════════════════════════════════
   MULTI-STEP PLANS — planos compostos de múltiplos passos.

   Detecta pedidos amplos como "cuida dos meus emails", "organiza minha
   semana", "prepara meu dia" e gera uma sequência de ações que o Claude
   executa em ordem, pedindo aprovação para as sensíveis.
═══════════════════════════════════════════════════════════════════ */

interface MultiStepPlan {
  trigger: RegExp;
  steps: Array<{
    description: string;
    toolHint: string;   // tool que o Claude deve usar
    requiresApproval: boolean;
  }>;
}

const MULTI_STEP_PLANS: MultiStepPlan[] = [
  {
    trigger: /(cuida|trata|processa|organiza).{0,15}(email|inbox|caixa)/i,
    steps: [
      { description: "Listar emails nao lidos", toolHint: "gmail_list", requiresApproval: false },
      { description: "Resumir os importantes e separar por urgencia", toolHint: "analysis", requiresApproval: false },
      { description: "Criar tarefas para os que precisam de acao", toolHint: "orion_action (task.create)", requiresApproval: true },
      { description: "Rascunhar respostas para os urgentes", toolHint: "orion_action + gmail_draft", requiresApproval: true },
    ],
  },
  {
    trigger: /(organiza|planeja|prepara|monta).{0,15}(semana|semanal)/i,
    steps: [
      { description: "Verificar tarefas pendentes e prazos", toolHint: "orion_action (task listing)", requiresApproval: false },
      { description: "Analisar agenda da semana", toolHint: "calendar_list", requiresApproval: false },
      { description: "Cruzar energia/foco com carga de reunioes", toolHint: "analysis", requiresApproval: false },
      { description: "Priorizar e redistribuir tarefas", toolHint: "orion_action (task.update)", requiresApproval: true },
      { description: "Sugerir blocos de foco nos horarios livres", toolHint: "suggestion", requiresApproval: false },
    ],
  },
  {
    trigger: /(prepara|monta|planeja).{0,15}(dia|hoje|manha)/i,
    steps: [
      { description: "Gerar morning brief com agenda e tarefas", toolHint: "brain_context + calendar_list", requiresApproval: false },
      { description: "Identificar top 3 prioridades do dia", toolHint: "analysis", requiresApproval: false },
      { description: "Verificar habitos pendentes", toolHint: "habit check", requiresApproval: false },
      { description: "Sugerir primeiro bloco de foco", toolHint: "suggestion", requiresApproval: false },
    ],
  },
  {
    trigger: /(revisa|audita|verifica).{0,15}(finan[cç]|gasto|despesa|dinheiro)/i,
    steps: [
      { description: "Listar transacoes recentes", toolHint: "finance data", requiresApproval: false },
      { description: "Categorizar e sumarizar por categoria", toolHint: "analysis", requiresApproval: false },
      { description: "Comparar com metas e limites", toolHint: "finance goals", requiresApproval: false },
      { description: "Alertar sobre desvios e sugerir cortes", toolHint: "orion_action (alert.create)", requiresApproval: true },
    ],
  },
  {
    trigger: /(limpa|organiza|tria).{0,15}(notifica|alerta|inbox|fila)/i,
    steps: [
      { description: "Listar alertas e decisoes pendentes", toolHint: "alerts + decisions", requiresApproval: false },
      { description: "Classificar por urgencia e relevancia", toolHint: "analysis", requiresApproval: false },
      { description: "Executar as de baixo risco automaticamente", toolHint: "orion_action batch", requiresApproval: true },
      { description: "Apresentar as de alto risco para aprovacao", toolHint: "decision_create", requiresApproval: true },
    ],
  },
];

function detectMultiStepPlan(message: string): MultiStepPlan | null {
  for (const plan of MULTI_STEP_PLANS) {
    if (plan.trigger.test(message)) return plan;
  }
  return null;
}

function renderMultiStepForPrompt(plan: MultiStepPlan): string {
  const lines = plan.steps.map((step, i) => {
    const approval = step.requiresApproval ? " [REQUER APROVACAO]" : "";
    return `  ${i + 1}. ${step.description} (tool: ${step.toolHint})${approval}`;
  });
  return [
    "## PLANO MULTI-STEP DETECTADO",
    "O usuario pediu algo que requer multiplos passos. Execute na ordem:",
    ...lines,
    "",
    "REGRAS:",
    "- Execute cada passo usando as ferramentas disponíveis",
    "- Para passos com [REQUER APROVACAO], mostre o que vai fazer e pergunte antes",
    "- Se um passo falhar, informe e continue com os proximos quando possivel",
    "- Ao final, resuma tudo que foi feito",
  ].join("\n");
}

export function buildAgentPlan(message: string, module?: string): AgentPlan {
  const targetModules = module ? [module, ...inferModules(message).filter((m) => m !== module)] : inferModules(message);
  const explicitActions = [
    taskAction(message),
    memoryAction(message),
    habitAction(message),
    alertAction(message),
    wishlistAction(message),
    socialAction(message),
  ].filter((action): action is PlannedInternalAction => action !== null);

  const risk = EXTERNAL_RISK.test(message) ? "external" : explicitActions.some((a) => a.actionType !== "memory.create") ? "confirm" : "safe";
  const isBroadPlanning = /\b(organiza|planeja|plano|prioriza|decide|estrat[eé]gia|semana|dia)\b/i.test(message);
  const intent = explicitActions.length
    ? "execute_internal_action"
    : isBroadPlanning
      ? "orchestrate_modules"
      : targetModules[0] === "orion"
        ? "general_dialogue"
        : "module_assistance";
  const confidence = explicitActions.length ? 0.86 : isBroadPlanning ? 0.68 : 0.48;

  // Detect multi-step plans for broad requests
  const multiStep = detectMultiStepPlan(message);

  return {
    intent: multiStep ? "multi_step_execution" : intent,
    targetModules,
    risk: multiStep ? "confirm" : risk,
    confidence: multiStep ? 0.82 : confidence,
    rationale: multiStep
      ? "Pedido composto detectado — plano multi-step gerado."
      : explicitActions.length
        ? "Mensagem contém verbo de ação e entidade interna reconhecida."
        : isBroadPlanning
          ? "Mensagem pede organização ampla; o modelo deve cruzar módulos antes de responder."
          : "Sem ação interna determinística; deixar Claude decidir com ferramentas.",
    autoRoute: explicitActions.length > 0 && risk !== "external" && !multiStep,
    actions: explicitActions.slice(0, 3),
    ...(multiStep ? { multiStepPlan: multiStep } : {}),
  } as AgentPlan;
}

export function renderAgentPlanForPrompt(plan: AgentPlan, routed: RoutedPlannedAction[]): string {
  const actions = plan.actions.length
    ? plan.actions.map((a) => `- ${a.actionType}: ${a.proposedAction}`).join("\n")
    : "- nenhuma ação determinística pré-criada";
  const routedLines = routed.length
    ? routed
        .map((item) => {
          if (item.result.status === "executed") return `- executada (${item.result.moduleId}): ${item.result.execution.summary}`;
          if (item.result.status === "decision") return `- pendente (${item.result.moduleId}): ${item.result.reason} id=${item.result.decisionId}`;
          return `- bloqueada (${item.result.moduleId}): ${item.result.reason}`;
        })
        .join("\n")
    : "- nenhuma ação roteada antes da resposta";

  // If multi-step plan detected, add it to the prompt
  const multiStepBlock = (plan as AgentPlan & { multiStepPlan?: MultiStepPlan }).multiStepPlan
    ? "\n" + renderMultiStepForPrompt((plan as AgentPlan & { multiStepPlan?: MultiStepPlan }).multiStepPlan!)
    : "";

  return [
    "## Agent Executor preflight",
    `Intent: ${plan.intent}`,
    `Módulos alvo: ${plan.targetModules.join(", ")}`,
    `Risco: ${plan.risk}`,
    `Confiança: ${Math.round(plan.confidence * 100)}%`,
    `Racional: ${plan.rationale}`,
    "Ações detectadas:",
    actions,
    "Resultado do roteamento prévio:",
    routedLines,
    "Se uma ação já foi roteada acima, não chame orion_action de novo para a mesma intenção; explique ao usuário o estado dela.",
    multiStepBlock,
  ].join("\n");
}

export function renderRoutedActionsForAnswer(routed: RoutedPlannedAction[]): string {
  if (!routed.length) return "";
  const lines = routed.map((item) => {
    if (item.result.status === "executed") return `- Executei em ${item.result.moduleId}: ${item.result.execution.summary}`;
    if (item.result.status === "decision") return `- Deixei aguardando aprovação em ${item.result.moduleId}: ${item.planned.proposedAction}`;
    return `- Bloqueei em ${item.result.moduleId}: ${item.result.reason}`;
  });
  return `

Execução do núcleo:
${lines.join("\n")}`;
}
