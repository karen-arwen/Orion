import Anthropic from "@anthropic-ai/sdk";
import type { TravelPlan, TravelPlanInput } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM = `Você é O.R.I.O.N. em modo TRAVEL ARCHITECT.
Crie roteiros práticos, elegantes e executáveis. Não invente preços exatos.
Se faltar dado, faça suposições explícitas. Evite turismo genérico: organize logística, ritmo,
risco, descanso e próximos passos. Devolva APENAS JSON válido no schema pedido.`;

function fallback(input: TravelPlanInput): TravelPlan {
  return {
    destination: input.destination,
    summary: "Não consegui gerar um roteiro completo agora. Use este esqueleto para continuar pelo chat.",
    assumptions: ["Datas e preferências podem precisar de refinamento."],
    days: Array.from({ length: Math.max(1, input.days) }, (_, i) => ({
      day: i + 1,
      title: `Dia ${i + 1}`,
      morning: "Bloco principal de exploração.",
      afternoon: "Segundo bloco com pausa estratégica.",
      night: "Jantar e retorno sem pressa.",
      logistics: "Validar deslocamento, horários e reservas.",
    })),
    risks: ["Checar clima, segurança e horários antes de fechar."],
    nextActions: ["Definir hospedagem base", "Separar documentos", "Montar orçamento"],
  };
}

export async function planTrip(userId: string, input: TravelPlanInput): Promise<TravelPlan> {
  const [profile, memories] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.memory.findMany({ where: { userId }, orderBy: { importance: "desc" }, take: 6 }),
  ]);
  const prompt = {
    userContext: {
      bio: profile?.bio ?? "",
      timezone: profile?.timezone ?? "America/Sao_Paulo",
      memories: memories.map((m) => `[${m.type}] ${m.content}`),
    },
    request: input,
    schema: {
      destination: "string",
      summary: "string",
      assumptions: ["string"],
      days: [{ day: 1, title: "string", morning: "string", afternoon: "string", night: "string", logistics: "string" }],
      risks: ["string"],
      nextActions: ["string"],
    },
  };
  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 3000,
    temperature: 0.65,
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(prompt) }],
  });
  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Robust JSON extraction
  const strategies = [
    () => JSON.parse(rawText),
    () => JSON.parse(rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()),
    () => {
      const first = rawText.indexOf("{");
      const last = rawText.lastIndexOf("}");
      if (first >= 0 && last > first) return JSON.parse(rawText.slice(first, last + 1));
      throw new Error("no braces");
    },
  ];
  for (const strategy of strategies) {
    try {
      const parsed = strategy() as TravelPlan;
      if (parsed.destination || parsed.days) return parsed;
    } catch { /* next */ }
  }
  return fallback(input);
}
