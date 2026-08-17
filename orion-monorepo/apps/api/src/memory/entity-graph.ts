import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";

/* ═══════════════════════════════════════════════════════════════════
   ENTITY GRAPH — grafo de conhecimento pessoal do usuário.

   Em vez de salvar só fatos isolados, o ORION constrói um grafo de:
   - PESSOAS: quem aparece nas conversas, importância, contexto
   - PROJETOS: do que se trata, status implícito, urgência
   - TÓPICOS: áreas de interesse, nível de engajamento
   - PADRÕES: comportamentos recorrentes detectados

   Cada entidade tem:
   - name, type, context, importância (0-1)
   - firstSeenAt, lastMentionedAt, mentionCount
   - relações com outras entidades

   Isso permite ao ORION:
   - "Quando você fala em 'aquele cliente', ele já sabe quem é"
   - "Percebo que você menciona X toda vez que fala de Y"
   - "Essa pessoa apareceu 3x essa semana nas suas conversas"
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ─── Tipos ─────────────────────────────────────────────────────────

export type EntityType = "person" | "project" | "topic" | "place" | "habit_context";

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  context: string;        // como aparece na conversa
  importance: number;     // 0-1
  sentiment?: "positive" | "neutral" | "negative" | "mixed";
  aliases?: string[];     // "minha mãe" → "Mãe", "aquele cliente" → "Cliente X"
}

interface EntityGraph {
  entities: ExtractedEntity[];
  patterns: string[];     // padrões observados na conversa
}

// ─── Extrator via Claude ───────────────────────────────────────────

const ENTITY_EXTRACTOR_PROMPT = `Você é o extrator de entidades do grafo de conhecimento do O.R.I.O.N.

Analise a conversa e extraia:
1. PESSOAS mencionadas (nome real, apelido, relação: "minha mãe", "o cliente da Acme", etc.)
2. PROJETOS ou objetivos mencionados
3. TÓPICOS recorrentes ou importantes
4. PADRÕES comportamentais observados na fala do usuário

REGRAS:
- Só entidades que importam para o contexto de vida do usuário
- Inclua aliases/apelidos quando o usuário usa linguagem vaga ("aquele cara" → provavelmente alguém já conhecido)
- Sentiment: como o usuário parece se sentir em relação à entidade
- Importance: 1.0 = aparece constantemente e parece crítico, 0.3 = mencionado de passagem
- Patterns: comportamentos ou padrões que você percebe na FORMA como o usuário fala (não no conteúdo)

FORMATO JSON PURO:
{
  "entities": [
    {
      "name": "Nome ou descrição",
      "type": "person | project | topic | place | habit_context",
      "context": "como apareceu na conversa",
      "importance": 0.7,
      "sentiment": "positive | neutral | negative | mixed",
      "aliases": ["apelido1", "referência2"]
    }
  ],
  "patterns": [
    "padrão observado na forma de se comunicar"
  ]
}`;

export async function extractEntitiesFromConversation(opts: {
  userId: string;
  userMessage: string;
  assistantMessage: string;
  existingEntities?: string[];
}): Promise<EntityGraph | null> {
  const existing = opts.existingEntities?.length
    ? `\nEntidades já conhecidas (evite duplicar):\n${opts.existingEntities.map((e) => `• ${e}`).join("\n")}`
    : "";

  const prompt = `Conversa para analisar:
USUÁRIO: ${opts.userMessage}
ORION: ${opts.assistantMessage}
${existing}

Extraia entidades e padrões. Se não houver nada relevante, retorne {"entities":[],"patterns":[]}.`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",  // haiku: rápido e barato pra extração
      max_tokens: 800,
      system: ENTITY_EXTRACTOR_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned) as EntityGraph;
  } catch {
    return null;
  }
}

// ─── Persistência do grafo ─────────────────────────────────────────

export async function upsertEntityGraph(userId: string, graph: EntityGraph): Promise<void> {
  for (const entity of graph.entities) {
    if (!entity.name || entity.importance < 0.3) continue;

    // Chave de dedup: userId + type + name normalizado
    const key = `${entity.type}:${entity.name.toLowerCase().slice(0, 60)}`;

    const existing = await prisma.memory.findFirst({
      where: {
        userId,
        type: "fact",
        content: { contains: key },
      },
    }).catch(() => null);

    if (existing) {
      // Incrementa relevância via importance no conteúdo existente
      // (simples: só atualiza updatedAt para manter na top-N por recência)
      await prisma.memory.update({
        where: { id: existing.id },
        data: { importance: Math.min(1, existing.importance + 0.05) },
      }).catch(() => {});
    } else {
      await prisma.memory.create({
        data: {
          userId,
          type: "fact",
          content: `[${entity.type.toUpperCase()}|${key}] ${entity.name}: ${entity.context}${entity.sentiment ? ` (sentimento: ${entity.sentiment})` : ""}${entity.aliases?.length ? ` [aliases: ${entity.aliases.join(", ")}]` : ""}`,
          importance: entity.importance,
        },
      }).catch(() => {});
    }
  }

  // Salva padrões de comunicação como preferências
  for (const pattern of graph.patterns) {
    if (!pattern || pattern.length < 10) continue;
    await prisma.memory.create({
      data: {
        userId,
        type: "preference",
        content: `[PADRÃO] ${pattern}`,
        importance: 0.4,
      },
    }).catch(() => {});
  }
}

// ─── Recuperação contextual ────────────────────────────────────────

export async function getEntityContext(userId: string, query: string): Promise<string> {
  const cacheKey = `entity_ctx:${userId}:${query.toLowerCase().slice(0, 30)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  // Busca entidades relevantes para a query
  const entities = await prisma.memory.findMany({
    where: {
      userId,
      type: "fact",
      content: { contains: "[PERSON" },
      importance: { gte: 0.4 },
    },
    orderBy: { importance: "desc" },
    take: 10,
  }).catch(() => []);

  if (entities.length === 0) return "";

  const context = entities.map((e) => `• ${e.content.replace(/^\[.*?\]\s*/, "")}`).join("\n");
  await redis.set(cacheKey, context, "EX", 300); // cache 5min
  return context;
}

// ─── Geração de insight de padrão ────────────────────────────────

export async function detectBehavioralPatterns(userId: string): Promise<string[]> {
  // Analisa padrões nas memórias para gerar insights de comportamento
  const recentMemories = await prisma.memory.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    },
    orderBy: { importance: "desc" },
    take: 30,
  }).catch(() => []);

  if (recentMemories.length < 5) return [];

  const patternMemories = recentMemories.filter((m) => m.content.includes("[PADRÃO]"));
  return patternMemories.map((m) => m.content.replace("[PADRÃO] ", ""));
}
