import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   CARREIRA — Coach de carreira especializado.

   Modos: portfólio, entrevista, plano 30/60/90, review.
   Usa memórias do usuário + projetos pra personalizar conselhos.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const CAREER_SYSTEM = `Você é o O.R.I.O.N. em modo COACH DE CARREIRA.

Você não dá conselhos genéricos. Você ouve, faz perguntas precisas, e devolve
recomendações concretas e acionáveis. Cita estratégias específicas baseadas
na trajetória da pessoa.

ESTILO:
- Sofisticado, direto, sem rodeios.
- Sempre concreto — datas, números, ações específicas.
- Confronta racionalizações com cuidado.
- Termina com 1 ação clara pra esta semana.

CAPACIDADES:
- "portfólio": análise + plano de evolução
- "entrevista": prep técnica, behavioral, perguntas pro entrevistador
- "30/60/90": plano de marcos pros próximos 90 dias
- "review": feedback sobre uma situação ou decisão

NUNCA prometa garantia de emprego. NUNCA seja motivacional vazio.`;

export type CareerMode = "portfolio" | "entrevista" | "plano_90" | "review" | "livre";

export interface CoachInput {
  mode?: CareerMode;
  prompt: string;
}

export async function coach(userId: string, input: CoachInput): Promise<string> {
  // Contexto: projetos do usuário + memórias de carreira
  const [projects, memories] = await Promise.all([
    prisma.project.findMany({ where: { userId }, take: 8 }),
    prisma.memory.findMany({
      where: { userId, type: { in: ["fact", "preference"] } },
      orderBy: { importance: "desc" },
      take: 6,
    }),
  ]);

  const ctxLines: string[] = [];
  if (projects.length > 0) {
    ctxLines.push("Projetos atuais:");
    for (const p of projects) ctxLines.push(`  • ${p.name} (${p.progress}%, ${p.status})`);
  }
  if (memories.length > 0) {
    ctxLines.push("", "O que você sabe sobre essa pessoa:");
    for (const m of memories) ctxLines.push(`  • [${m.type}] ${m.content}`);
  }

  const modeHeader = {
    portfolio: "Modo: análise de portfólio.",
    entrevista: "Modo: preparação pra entrevista.",
    plano_90: "Modo: plano 30/60/90.",
    review: "Modo: review de decisão/situação.",
    livre: "Modo livre.",
  }[input.mode ?? "livre"];

  const userMsg =
    (ctxLines.length ? `${ctxLines.join("\n")}\n\n` : "") +
    `${modeHeader}\n\nUsuário diz:\n${input.prompt}`;

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1200,
    temperature: 0.7,
    system: CAREER_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
