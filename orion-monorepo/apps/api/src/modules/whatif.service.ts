import type { WhatIfScenario, WhatIfScenarioInput } from "@orion/types";
import { prisma } from "../db/prisma.js";
import { generateJson } from "./ai-json.js";

const SYSTEM = `Voce e O.R.I.O.N. no modulo WHAT-IF.
Simule cenarios com pensamento critico, riscos, indicadores e proximas acoes.
Nao venda certeza falsa. Responda APENAS JSON valido no schema pedido.`;

function fallback(input: WhatIfScenarioInput): WhatIfScenario {
  return {
    question: input.question,
    executiveSummary: "Nao consegui simular com IA agora. Estruturei uma analise base para continuar.",
    assumptions: ["O contexto ainda precisa de dados concretos.", `Horizonte: ${input.horizon}`],
    likelyOutcome: "O resultado mais provavel depende da execucao e dos sinais iniciais.",
    bestCase: "O plano funciona com baixo atrito e cria opcionalidade.",
    worstCase: "A decisao consome energia sem retorno claro.",
    leadingIndicators: ["Tempo ate o primeiro sinal positivo", "Custo real", "Energia necessaria", "Feedback externo"],
    decisionMatrix: [
      { option: "Avancar pequeno", upside: "Aprendizado rapido", downside: "Resultado limitado", effort: "baixo", confidence: 0.72 },
      { option: "Esperar mais dados", upside: "Menos risco", downside: "Perde momento", effort: "baixo", confidence: 0.58 },
    ],
    nextActions: ["Definir criterio de sucesso", "Rodar experimento pequeno", "Revisar sinais em uma semana"],
  };
}

export async function simulateScenario(userId: string, input: WhatIfScenarioInput): Promise<WhatIfScenario> {
  const [profile, memories, tasks] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.memory.findMany({ where: { userId }, orderBy: { importance: "desc" }, take: 8 }),
    prisma.task.findMany({ where: { userId, status: { in: ["todo", "doing"] } }, orderBy: { priority: "desc" }, take: 8 }),
  ]);
  const payload = {
    userContext: {
      bio: profile?.bio ?? "",
      memories: memories.map((m) => `[${m.type}] ${m.content}`),
      activeTasks: tasks.map((t) => ({ title: t.title, priority: t.priority, energy: t.energy })),
    },
    request: input,
    schema: {
      question: "string",
      executiveSummary: "string",
      assumptions: ["string"],
      likelyOutcome: "string",
      bestCase: "string",
      worstCase: "string",
      leadingIndicators: ["string"],
      decisionMatrix: [{ option: "string", upside: "string", downside: "string", effort: "baixo|medio|alto", confidence: 0.7 }],
      nextActions: ["string"],
    },
  };
  try {
    return await generateJson<WhatIfScenario>(SYSTEM, payload, 1800);
  } catch {
    return fallback(input);
  }
}
