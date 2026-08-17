import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   MULTI-LLM ROUTER — escolhe o melhor modelo por tipo de tarefa.

   Estrategia:
   1. Checa routing rules no banco (customizaveis por admin)
   2. Se nao tem regra, usa heuristicas built-in
   3. Fallback chain: primary → secondary → cheapest available
   4. Loga uso + custo pra analytics

   Providers suportados:
   - Anthropic (Claude): primary, melhor pra raciocinio/code/escrita
   - OpenAI (GPT): secondary, bom generalista
   - Google (Gemini): vision/video/docs grandes
   - DeepSeek: code/math barato
   - Mistral: summaries baratos
   - Local (Ollama): privacidade/offline
═══════════════════════════════════════════════════════════════════ */

export type TaskType =
  | "chat"           // conversa geral
  | "code"           // geracao/review de codigo
  | "summary"        // resumo de texto
  | "writing"        // escrita longa/criativa
  | "reasoning"      // raciocinio complexo
  | "translation"    // traducao
  | "vision"         // analise de imagem
  | "extraction"     // extracao de dados estruturados
  | "classification" // classificacao/triagem
  | "embedding"      // embedding generation
  | "quick"          // resposta rapida, custo minimo
  | "agent"          // agente autonomo (precisa de tools)
  | "reflection";    // auto-reflexao do sistema

export interface RoutingContext {
  taskType: TaskType;
  userId?: string;
  contextTokens?: number;     // tamanho estimado do contexto
  needsVision?: boolean;
  needsTools?: boolean;
  privacyLevel?: "normal" | "sensitive" | "local_only";
  maxCostUsd?: number;
  preferLatency?: "fast" | "normal" | "slow_ok";
}

export interface RoutedModel {
  provider: string;          // "anthropic", "openai", "google", "deepseek", "mistral", "local"
  model: string;             // model slug
  maxTokens: number;
  estimatedCostPer1kIn: number;
  estimatedCostPer1kOut: number;
}

// ─── Built-in routing heuristics ──────────────────────────────────

const BUILTIN_ROUTES: Record<TaskType, RoutedModel> = {
  chat: {
    provider: "anthropic",
    model: env.ANTHROPIC_MODEL,
    maxTokens: 4096,
    estimatedCostPer1kIn: 0.003,
    estimatedCostPer1kOut: 0.015,
  },
  code: {
    provider: "anthropic",
    model: env.ANTHROPIC_MODEL,
    maxTokens: 8192,
    estimatedCostPer1kIn: 0.003,
    estimatedCostPer1kOut: 0.015,
  },
  summary: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 2048,
    estimatedCostPer1kIn: 0.001,
    estimatedCostPer1kOut: 0.005,
  },
  writing: {
    provider: "anthropic",
    model: env.ANTHROPIC_MODEL,
    maxTokens: 4096,
    estimatedCostPer1kIn: 0.003,
    estimatedCostPer1kOut: 0.015,
  },
  reasoning: {
    provider: "anthropic",
    model: env.ANTHROPIC_MODEL,
    maxTokens: 8192,
    estimatedCostPer1kIn: 0.003,
    estimatedCostPer1kOut: 0.015,
  },
  translation: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 2048,
    estimatedCostPer1kIn: 0.001,
    estimatedCostPer1kOut: 0.005,
  },
  vision: {
    provider: "anthropic",
    model: env.ANTHROPIC_MODEL,
    maxTokens: 4096,
    estimatedCostPer1kIn: 0.003,
    estimatedCostPer1kOut: 0.015,
  },
  extraction: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 2048,
    estimatedCostPer1kIn: 0.001,
    estimatedCostPer1kOut: 0.005,
  },
  classification: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 1024,
    estimatedCostPer1kIn: 0.001,
    estimatedCostPer1kOut: 0.005,
  },
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    maxTokens: 8191,
    estimatedCostPer1kIn: 0.00002,
    estimatedCostPer1kOut: 0,
  },
  quick: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 1024,
    estimatedCostPer1kIn: 0.001,
    estimatedCostPer1kOut: 0.005,
  },
  agent: {
    provider: "anthropic",
    model: env.ANTHROPIC_MODEL,
    maxTokens: 8192,
    estimatedCostPer1kIn: 0.003,
    estimatedCostPer1kOut: 0.015,
  },
  reflection: {
    provider: "anthropic",
    model: env.ANTHROPIC_MODEL,
    maxTokens: 4096,
    estimatedCostPer1kIn: 0.003,
    estimatedCostPer1kOut: 0.015,
  },
};

/** Resolve the best model for a given task context */
export async function routeModel(ctx: RoutingContext): Promise<RoutedModel> {
  // 1. Check DB routing rules (allows admin customization)
  try {
    const rule = await prisma.aiRoutingRule.findFirst({
      where: { taskType: ctx.taskType, enabled: true },
      include: { model: { include: { provider: true } } },
      orderBy: { priority: "desc" },
    });

    if (rule?.model?.enabled && rule.model.provider.enabled) {
      return {
        provider: rule.model.provider.name,
        model: rule.model.slug,
        maxTokens: rule.model.maxTokens,
        estimatedCostPer1kIn: rule.model.costPer1kIn,
        estimatedCostPer1kOut: rule.model.costPer1kOut,
      };
    }
  } catch {
    // DB not migrated yet or no rules — fall through to builtins
  }

  // 2. Privacy override — force local model
  if (ctx.privacyLevel === "local_only") {
    return {
      provider: "local",
      model: "llama-3.1-8b",
      maxTokens: 4096,
      estimatedCostPer1kIn: 0,
      estimatedCostPer1kOut: 0,
    };
  }

  // 3. Cost override — use cheapest
  if (ctx.maxCostUsd !== undefined && ctx.maxCostUsd < 0.001) {
    return BUILTIN_ROUTES.quick;
  }

  // 4. Use builtin heuristic
  return BUILTIN_ROUTES[ctx.taskType] ?? BUILTIN_ROUTES.chat;
}

/** Log AI usage for cost tracking and analytics */
export async function logUsage(params: {
  userId: string;
  modelSlug: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs: number;
  taskType: string;
  agentId?: string;
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        userId: params.userId,
        modelSlug: params.modelSlug,
        tokensIn: params.tokensIn,
        tokensOut: params.tokensOut,
        costUsd: params.costUsd,
        durationMs: params.durationMs,
        taskType: params.taskType,
        agentId: params.agentId,
      },
    });
  } catch {
    // Usage logging is best-effort
  }
}

/** Get usage stats for a user */
export async function getUsageStats(userId: string, days = 30): Promise<{
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  byModel: Array<{ model: string; cost: number; requests: number }>;
  byTaskType: Array<{ taskType: string; cost: number; requests: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const logs = await prisma.aiUsageLog.findMany({
    where: { userId, createdAt: { gte: since } },
  });

  const byModel = new Map<string, { cost: number; requests: number }>();
  const byTask = new Map<string, { cost: number; requests: number }>();
  let totalCost = 0;
  let totalTokens = 0;

  for (const log of logs) {
    totalCost += log.costUsd;
    totalTokens += log.tokensIn + log.tokensOut;

    const m = byModel.get(log.modelSlug) ?? { cost: 0, requests: 0 };
    m.cost += log.costUsd;
    m.requests += 1;
    byModel.set(log.modelSlug, m);

    const t = byTask.get(log.taskType) ?? { cost: 0, requests: 0 };
    t.cost += log.costUsd;
    t.requests += 1;
    byTask.set(log.taskType, t);
  }

  return {
    totalCost,
    totalTokens,
    requestCount: logs.length,
    byModel: [...byModel.entries()].map(([model, data]) => ({ model, ...data })),
    byTaskType: [...byTask.entries()].map(([taskType, data]) => ({ taskType, ...data })),
  };
}
