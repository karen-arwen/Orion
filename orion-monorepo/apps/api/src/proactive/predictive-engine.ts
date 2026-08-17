import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { getMomentumScore } from "../modules/momentum.service.js";

/* ═══════════════════════════════════════════════════════════════════
   PREDICTIVE ENGINE — ORION preve como sera seu dia.

   Analisa: sono da noite anterior, agenda do dia, padroes historicos,
   carga de tarefas e momentum recente. Gera previsao com Claude Haiku.
   Integra no Morning Brief como bloco de previsao.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface DayPrediction {
  energyForecast: "alta" | "media" | "baixa";
  productivityWindow: string;      // ex: "9h-12h"
  riskFactors: string[];            // ex: ["sono curto", "agenda cheia"]
  recommendation: string;           // frase acionavel
  confidence: number;               // 0-1
}

export async function predictDay(userId: string): Promise<DayPrediction> {
  const cacheKey = `prediction:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return JSON.parse(cached) as DayPrediction;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 3600 * 1000);

  const [momentum, lastSleep, todayTasks, recentPatterns, profile] = await Promise.all([
    getMomentumScore(userId).catch(() => null),
    prisma.sleepLog.findFirst({
      where: { userId, bedTime: { gte: weekAgo } },
      orderBy: { bedTime: "desc" },
    }),
    prisma.task.count({ where: { userId, status: { in: ["todo", "doing"] } } }),
    prisma.userPattern.findMany({
      where: { userId },
      orderBy: { confidence: "desc" },
      take: 5,
    }),
    prisma.userProfile.findUnique({ where: { userId } }),
  ]);

  const sleepHours = lastSleep?.wakeTime && lastSleep?.bedTime
    ? (lastSleep.wakeTime.getTime() - lastSleep.bedTime.getTime()) / 3600000
    : null;
  const sleepQuality = lastSleep?.quality ?? null;
  const dayOfWeek = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][today.getDay()];

  const prompt = `Prever o dia de hoje (${dayOfWeek}, ${todayStr}) para o usuario.

DADOS:
- Momentum score atual: ${momentum?.score ?? "desconhecido"}/100
- Sono ultima noite: ${sleepHours ? sleepHours.toFixed(1) + "h" : "sem registro"}, qualidade: ${sleepQuality ?? "?"}/5
- Tarefas pendentes: ${todayTasks}
- Padroes recentes: ${recentPatterns.map((p) => p.patternType).join("; ") || "nenhum"}
- Bio: ${profile?.bio ?? ""}

Responda APENAS em JSON valido:
{
  "energyForecast": "alta" | "media" | "baixa",
  "productivityWindow": "horario mais produtivo (ex: 9h-12h)",
  "riskFactors": ["fator1", "fator2"],
  "recommendation": "frase curta e acionavel",
  "confidence": 0.0 a 1.0
}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: "Voce e um motor preditivo. Responda APENAS JSON valido, sem explicacao.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const clean = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const prediction = JSON.parse(clean) as DayPrediction;

    await redis.set(cacheKey, JSON.stringify(prediction), "EX", 6 * 3600).catch(() => {});
    return prediction;
  } catch {
    // Fallback baseado em heuristicas simples
    const energy = sleepHours && sleepHours >= 7 ? "alta" : sleepHours && sleepHours >= 5.5 ? "media" : "baixa";
    const risks: string[] = [];
    if (sleepHours && sleepHours < 6) risks.push("sono insuficiente");
    if (todayTasks > 8) risks.push("muitas tarefas pendentes");

    return {
      energyForecast: energy,
      productivityWindow: energy === "alta" ? "9h-13h" : "10h-12h",
      riskFactors: risks,
      recommendation: energy === "baixa"
        ? "Priorize apenas o essencial e descanse mais cedo hoje."
        : "Dia equilibrado — foque nas prioridades na janela produtiva.",
      confidence: 0.4,
    };
  }
}
