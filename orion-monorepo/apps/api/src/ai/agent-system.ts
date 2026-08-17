import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { routeModel, logUsage, type TaskType } from "./llm-router.js";

/* ═══════════════════════════════════════════════════════════════════
   AGENT SYSTEM — agentes especializados do ORION.

   Cada agente tem:
   - Objetivo claro
   - System prompt proprio
   - Tools permitidas
   - Nivel de autonomia
   - Limite de custo
   - Timeout
   - Logs completos

   O Orchestrator Agent delega para agentes especializados.
   Agentes podem spawnar sub-agentes (chain depth limit: 3).
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface AgentInput {
  userId: string;
  agentName: string;
  input: Record<string, unknown>;
  trigger?: string;
  parentRunId?: string;
}

export interface AgentOutput {
  runId: string;
  status: "completed" | "failed" | "cancelled";
  output: Record<string, unknown>;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; output: unknown }>;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
}

// ── Built-in agents (seeded on first use) ─────────────────────────

const BUILTIN_AGENTS: Array<{
  name: string;
  displayName: string;
  description: string;
  objective: string;
  systemPrompt: string;
  allowedTools: string[];
  autonomyLevel: number;
  costLimitUsd: number;
  taskType: TaskType;
}> = [
  {
    name: "orchestrator",
    displayName: "Orchestrator",
    description: "Coordena outros agentes para tarefas complexas",
    objective: "Decompor tarefas complexas em sub-tarefas e delegar para agentes especializados",
    systemPrompt: "Voce e o Orchestrator do ORION. Analise a tarefa, decomponha em passos e delegue para os agentes certos. Retorne um plano de execucao em JSON.",
    allowedTools: ["plan_multi_step"],
    autonomyLevel: 5,
    costLimitUsd: 0.50,
    taskType: "reasoning",
  },
  {
    name: "memory_agent",
    displayName: "Memory Agent",
    description: "Gerencia memorias do usuario",
    objective: "Extrair, classificar, armazenar e recuperar memorias relevantes",
    systemPrompt: "Voce gerencia a memoria do ORION. Extraia fatos, preferencias e padroes das interacoes. Classifique por tipo e importancia.",
    allowedTools: ["orion_action"],
    autonomyLevel: 4,
    costLimitUsd: 0.05,
    taskType: "extraction",
  },
  {
    name: "reflection_agent",
    displayName: "Reflection Agent",
    description: "Auto-reflexao diaria/semanal",
    objective: "Analisar dados do usuario e gerar insights, riscos e oportunidades",
    systemPrompt: "Voce e o agente de reflexao do ORION. Analise os dados do usuario (habitos, energia, sono, financas, tarefas, metas) e gere: 1) insights sobre padroes, 2) riscos detectados, 3) oportunidades encontradas, 4) sugestoes de melhoria. Seja especifico e acionavel.",
    allowedTools: ["financial_analysis", "habit_analysis", "social_nudges"],
    autonomyLevel: 3,
    costLimitUsd: 0.15,
    taskType: "reflection",
  },
  {
    name: "finance_agent",
    displayName: "Finance Agent",
    description: "Analise financeira e alertas",
    objective: "Monitorar gastos, categorizar transacoes, detectar anomalias, projetar cenarios",
    systemPrompt: "Voce e o CFO pessoal do ORION. Analise transacoes, detecte padroes de gasto, alerte limites, projete cenarios e sugira economia. Use dados reais do usuario.",
    allowedTools: ["financial_analysis", "orion_action"],
    autonomyLevel: 3,
    costLimitUsd: 0.10,
    taskType: "reasoning",
  },
  {
    name: "health_agent",
    displayName: "Health Agent",
    description: "Monitoramento de saude e bem-estar",
    objective: "Analisar energia, sono, humor, habitos e sugerir melhorias",
    systemPrompt: "Voce monitora saude e bem-estar no ORION. Analise padroes de energia, sono e humor. Detecte riscos (burnout, sono ruim, queda de energia). Sugira intervencoes baseadas em dados.",
    allowedTools: ["habit_analysis", "orion_action"],
    autonomyLevel: 2,
    costLimitUsd: 0.08,
    taskType: "reasoning",
  },
  {
    name: "planning_agent",
    displayName: "Planning Agent",
    description: "Planejamento e priorizacao de tarefas",
    objective: "Analisar agenda, tarefas, energia e metas para recomendar a proxima melhor acao",
    systemPrompt: "Voce e o planejador do ORION. Cruze agenda, tarefas, energia atual, metas e prazos para determinar a proxima melhor acao. Seja concreto: diga QUAL tarefa, POR QUANTO TEMPO, e POR QUE agora.",
    allowedTools: ["calendar_intelligence", "plan_multi_step", "orion_action"],
    autonomyLevel: 3,
    costLimitUsd: 0.10,
    taskType: "reasoning",
  },
  {
    name: "research_agent",
    displayName: "Research Agent",
    description: "Pesquisa e coleta de informacoes",
    objective: "Pesquisar na web, compilar informacoes, gerar relatorios",
    systemPrompt: "Voce e o pesquisador do ORION. Use busca web para encontrar informacoes atualizadas. Compile resultados de forma estruturada com fontes. Seja critico com a qualidade das fontes.",
    allowedTools: ["web_search"],
    autonomyLevel: 4,
    costLimitUsd: 0.08,
    taskType: "reasoning",
  },
  {
    name: "risk_agent",
    displayName: "Risk Agent",
    description: "Detecta riscos e alerta proativamente",
    objective: "Monitorar dados cross-module e detectar riscos antes que virem problemas",
    systemPrompt: "Voce e o detector de riscos do ORION. Analise dados de todos os modulos e identifique: prazos em risco, burnout iminente, gastos fora do padrao, metas abandonadas, habitos quebrando, sono deteriorando, contatos importantes sendo ignorados. Classifique por probabilidade e impacto.",
    allowedTools: ["financial_analysis", "habit_analysis", "social_nudges"],
    autonomyLevel: 3,
    costLimitUsd: 0.10,
    taskType: "reasoning",
  },
  {
    name: "coach_agent",
    displayName: "Coach Agent",
    description: "Coaching pessoal e profissional",
    objective: "Oferecer coaching baseado em dados reais do usuario",
    systemPrompt: "Voce e o coach pessoal do ORION. Use dados reais do usuario (metas, progresso, habitos, energia, carreira) para oferecer coaching acionavel. Nao seja generico. Confronte racionalizacoes com carinho. Sempre termine com 1 acao concreta.",
    allowedTools: ["habit_analysis"],
    autonomyLevel: 2,
    costLimitUsd: 0.10,
    taskType: "writing",
  },
];

/** Ensure built-in agents exist in DB */
async function seedAgents(): Promise<void> {
  for (const agent of BUILTIN_AGENTS) {
    await prisma.agent.upsert({
      where: { name: agent.name },
      create: {
        name: agent.name,
        displayName: agent.displayName,
        description: agent.description,
        objective: agent.objective,
        systemPrompt: agent.systemPrompt,
        allowedTools: agent.allowedTools,
        autonomyLevel: agent.autonomyLevel,
        costLimitUsd: agent.costLimitUsd,
        builtIn: true,
      },
      update: {
        displayName: agent.displayName,
        description: agent.description,
        objective: agent.objective,
        systemPrompt: agent.systemPrompt,
      },
    });
  }
}

/** Run an agent */
export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const start = Date.now();

  // Ensure agents are seeded
  await seedAgents();

  // Find agent
  const agent = await prisma.agent.findUnique({ where: { name: input.agentName } });
  if (!agent || !agent.enabled) {
    throw new Error(`Agent "${input.agentName}" not found or disabled`);
  }

  // Check chain depth (prevent infinite recursion)
  if (input.parentRunId) {
    let depth = 0;
    let currentRunId: string | null = input.parentRunId;
    while (currentRunId && depth < 5) {
      const parent = await prisma.agentRun.findUnique({ where: { id: currentRunId } });
      currentRunId = parent?.parentRunId ?? null;
      depth++;
    }
    if (depth >= 3) throw new Error("Agent chain depth limit (3) reached");
  }

  // Create run record
  const run = await prisma.agentRun.create({
    data: {
      agentId: agent.id,
      userId: input.userId,
      trigger: input.trigger ?? "user",
      input: input.input,
      status: "running",
      parentRunId: input.parentRunId,
    },
  });

  try {
    // Route to best model
    const builtin = BUILTIN_AGENTS.find((a) => a.name === agent.name);
    const routed = await routeModel({
      taskType: (builtin?.taskType ?? "chat") as TaskType,
      userId: input.userId,
      needsTools: agent.allowedTools.length > 0,
    });

    // Call LLM
    const response = await anthropic.messages.create({
      model: routed.model,
      max_tokens: routed.maxTokens,
      temperature: 0.6,
      system: agent.systemPrompt ?? agent.objective,
      messages: [{
        role: "user",
        content: JSON.stringify(input.input),
      }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
    const costUsd = (response.usage?.input_tokens ?? 0) * routed.estimatedCostPer1kIn / 1000 +
                    (response.usage?.output_tokens ?? 0) * routed.estimatedCostPer1kOut / 1000;
    const durationMs = Date.now() - start;

    // Parse output
    let output: Record<string, unknown>;
    try {
      output = JSON.parse(text);
    } catch {
      output = { text };
    }

    // Update run
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        output,
        tokensUsed,
        costUsd,
        durationMs,
        completedAt: new Date(),
      },
    });

    // Log usage
    await logUsage({
      userId: input.userId,
      modelSlug: routed.model,
      tokensIn: response.usage?.input_tokens ?? 0,
      tokensOut: response.usage?.output_tokens ?? 0,
      costUsd,
      durationMs,
      taskType: builtin?.taskType ?? "agent",
      agentId: agent.id,
    });

    return {
      runId: run.id,
      status: "completed",
      output,
      toolCalls: [],
      tokensUsed,
      costUsd,
      durationMs,
    };
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: (err as Error).message,
        durationMs: Date.now() - start,
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

/** List available agents */
export async function listAgents(): Promise<Array<{
  name: string;
  displayName: string;
  description: string;
  autonomyLevel: number;
  enabled: boolean;
}>> {
  await seedAgents();
  return prisma.agent.findMany({
    select: { name: true, displayName: true, description: true, autonomyLevel: true, enabled: true },
    orderBy: { name: "asc" },
  });
}

/** Get agent run history */
export async function getAgentRuns(userId: string, limit = 20): Promise<Array<{
  id: string;
  agentName: string;
  status: string;
  durationMs: number;
  costUsd: number;
  createdAt: Date;
}>> {
  const runs = await prisma.agentRun.findMany({
    where: { userId },
    include: { agent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return runs.map((r) => ({
    id: r.id,
    agentName: r.agent.name,
    status: r.status,
    durationMs: r.durationMs,
    costUsd: r.costUsd,
    createdAt: r.createdAt,
  }));
}
