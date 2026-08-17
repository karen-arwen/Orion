import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   Behavioral Profile Service — analisa conversas e aprende o estilo.

   Lê o histórico de mensagens do usuário e identifica:
   - communicationStyle: como ele escreve (direto, elaborado, casual...)
   - preferredResponseLength: curto, médio, detalhado
   - usesHumor: usa piadas, ironia, memes
   - technicalLevel: básico, intermediário, expert
   - emotionalOpenness: abre para assuntos pessoais?
   - primaryLanguageTone: descrição livre do tom principal

   O resultado é salvo como UserPreference para ser usado no system prompt.
   Pode ser rodado manualmente (pelo usuário) ou automaticamente a cada 7 dias.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface BehavioralProfileResult {
  communicationStyle: "direct" | "elaborate" | "casual" | "formal" | "unknown";
  preferredResponseLength: "short" | "medium" | "detailed" | "unknown";
  usesHumor: boolean;
  technicalLevel: "beginner" | "intermediate" | "expert" | "unknown";
  emotionalOpenness: "low" | "medium" | "high" | "unknown";
  primaryLanguageTone: string;
  confidence: number;       // 0-1: quão confiante está na análise
  basedOnMessages: number;  // quantas mensagens foram analisadas
  analyzedAt: string;
}

const ANALYZER_SYSTEM = `Você é o analisador de perfil comportamental do O.R.I.O.N.

Analise as mensagens do usuário abaixo e identifique o padrão de comunicação dele.

CAMPOS A IDENTIFICAR:
- communicationStyle: "direct" (vai direto ao ponto, frases curtas) | "elaborate" (explica muito, contexto rico) | "casual" (descontraído, gírias) | "formal" (formal, educado) | "unknown"
- preferredResponseLength: "short" (mensagens muito curtas) | "medium" (equilibrado) | "detailed" (quer explicação completa) | "unknown"
- usesHumor: true se usa piadas, ironia, emoji com tom de brincadeira; false se sempre sério
- technicalLevel: "beginner" | "intermediate" | "expert" (pelo vocabulário técnico que usa) | "unknown"
- emotionalOpenness: "low" (só fala de tarefas/objetivos) | "medium" | "high" (compartilha sentimentos, contexto pessoal) | "unknown"
- primaryLanguageTone: frase curta descrevendo o tom principal (ex: "direto e objetivo", "descontraído e curioso", "técnico mas acessível")
- confidence: 0.0-1.0 — quão confiante você está na análise (depende do volume de mensagens)

IMPORTANTE:
- Se as mensagens são poucas (<5), confidence deve ser <= 0.4
- Baseie-se APENAS no que está nas mensagens, não presuma
- Se não tiver dados suficientes para uma dimensão, use "unknown"

FORMATO JSON PURO:
{
  "communicationStyle": "...",
  "preferredResponseLength": "...",
  "usesHumor": false,
  "technicalLevel": "...",
  "emotionalOpenness": "...",
  "primaryLanguageTone": "...",
  "confidence": 0.7
}`;

export async function analyzeBehavioralProfile(userId: string): Promise<BehavioralProfileResult> {
  // Busca as últimas 60 mensagens do usuário
  const messages = await prisma.message.findMany({
    where: {
      conversation: { userId },
      role: "user",
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { content: true, createdAt: true },
  });

  const basedOnMessages = messages.length;
  const now = new Date().toISOString();

  if (basedOnMessages < 3) {
    return {
      communicationStyle: "unknown",
      preferredResponseLength: "unknown",
      usesHumor: false,
      technicalLevel: "unknown",
      emotionalOpenness: "unknown",
      primaryLanguageTone: "",
      confidence: 0,
      basedOnMessages,
      analyzedAt: now,
    };
  }

  // Prepara amostra (mais recentes primeiro, limita tamanho)
  const sample = messages
    .slice(0, 40)
    .reverse()
    .map((m, i) => `[${i + 1}] ${m.content.slice(0, 200)}`)
    .join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: ANALYZER_SYSTEM,
      messages: [{ role: "user", content: `Mensagens do usuário para análise:\n\n${sample}` }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Omit<BehavioralProfileResult, "basedOnMessages" | "analyzedAt">;

    const result: BehavioralProfileResult = {
      ...parsed,
      basedOnMessages,
      analyzedAt: now,
    };

    // Persiste como UserPreference para o system prompt usar
    await saveProfileAsPreferences(userId, result);

    return result;
  } catch {
    return {
      communicationStyle: "unknown",
      preferredResponseLength: "unknown",
      usesHumor: false,
      technicalLevel: "unknown",
      emotionalOpenness: "unknown",
      primaryLanguageTone: "",
      confidence: 0,
      basedOnMessages,
      analyzedAt: now,
    };
  }
}

async function saveProfileAsPreferences(userId: string, profile: BehavioralProfileResult): Promise<void> {
  const prefs = [
    { key: "behavioral_communication_style", value: profile.communicationStyle },
    { key: "behavioral_response_length", value: profile.preferredResponseLength },
    { key: "behavioral_uses_humor", value: String(profile.usesHumor) },
    { key: "behavioral_technical_level", value: profile.technicalLevel },
    { key: "behavioral_emotional_openness", value: profile.emotionalOpenness },
    { key: "behavioral_language_tone", value: profile.primaryLanguageTone },
    { key: "behavioral_confidence", value: String(profile.confidence) },
    { key: "behavioral_analyzed_at", value: profile.analyzedAt },
    { key: "behavioral_based_on_messages", value: String(profile.basedOnMessages) },
  ];

  await Promise.all(
    prefs.map((p) =>
      prisma.userPreference.upsert({
        where: { userId_key_layer: { userId, key: p.key, layer: "current" } },
        create: { userId, key: p.key, value: p.value, layer: "current", confidence: profile.confidence },
        update: { value: p.value, confidence: profile.confidence },
      }).catch(() => {}),
    ),
  );
}

export async function getBehavioralProfile(userId: string): Promise<BehavioralProfileResult | null> {
  const prefs = await prisma.userPreference.findMany({
    where: { userId, key: { startsWith: "behavioral_" } },
  });

  if (prefs.length === 0) return null;

  const get = (key: string): string => prefs.find((p) => p.key === key)?.value ?? "";

  const confidence = parseFloat(get("behavioral_confidence")) || 0;
  if (confidence === 0) return null;

  return {
    communicationStyle: (get("behavioral_communication_style") || "unknown") as BehavioralProfileResult["communicationStyle"],
    preferredResponseLength: (get("behavioral_response_length") || "unknown") as BehavioralProfileResult["preferredResponseLength"],
    usesHumor: get("behavioral_uses_humor") === "true",
    technicalLevel: (get("behavioral_technical_level") || "unknown") as BehavioralProfileResult["technicalLevel"],
    emotionalOpenness: (get("behavioral_emotional_openness") || "unknown") as BehavioralProfileResult["emotionalOpenness"],
    primaryLanguageTone: get("behavioral_language_tone"),
    confidence,
    basedOnMessages: parseInt(get("behavioral_based_on_messages")) || 0,
    analyzedAt: get("behavioral_analyzed_at"),
  };
}
