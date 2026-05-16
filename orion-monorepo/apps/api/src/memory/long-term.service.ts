import { prisma } from "../db/prisma.js";
import { cosineSimilarity, embed } from "../embeddings/openai.js";

/* ═══════════════════════════════════════════════════════════════════
   Long-term memory — busca semântica por cosine similarity.

   Estratégia hoje: Float[] no Postgres + cosine em Node.
   Funciona até ~10k memórias por usuário com latência <50ms.
   Migração futura pra pgvector é trivial (campo já existe).

   Quando OPENAI_API_KEY ausente: cai pra busca por importance
   (top N memórias mais importantes). Sistema NUNCA falha.
═══════════════════════════════════════════════════════════════════ */

export interface RankedMemory {
  id: string;
  type: string;
  content: string;
  importance: number;
  similarity: number;
  createdAt: string;
}

const MIN_SIMILARITY = 0.3;

/** Busca top N memórias relevantes pra um query. */
export async function searchRelevantMemories(
  userId: string,
  query: string,
  topN = 5,
): Promise<RankedMemory[]> {
  const queryEmbedding = await embed(query);

  // Sem embedding: cai pra ranking por importance (degradação graciosa)
  if (!queryEmbedding) {
    const rows = await prisma.memory.findMany({
      where: { userId },
      orderBy: { importance: "desc" },
      take: topN,
      select: {
        id: true,
        type: true,
        content: true,
        importance: true,
        createdAt: true,
      },
    });
    return rows.map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      importance: m.importance,
      similarity: 0,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  // Com embedding: rank por similaridade
  const all = await prisma.memory.findMany({
    where: { userId, embedding: { isEmpty: false } },
    select: {
      id: true,
      type: true,
      content: true,
      importance: true,
      embedding: true,
      createdAt: true,
    },
  });

  const ranked: RankedMemory[] = all
    .map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      importance: m.importance,
      similarity: cosineSimilarity(queryEmbedding, m.embedding),
      createdAt: m.createdAt.toISOString(),
    }))
    .filter((m) => m.similarity >= MIN_SIMILARITY)
    .sort((a, b) => {
      // Score combina similarity + importance (50/50)
      const scoreA = a.similarity * 0.5 + a.importance * 0.5;
      const scoreB = b.similarity * 0.5 + b.importance * 0.5;
      return scoreB - scoreA;
    })
    .slice(0, topN);

  // Boost de importance: memórias que apareceram como relevantes ganham peso
  if (ranked.length > 0) {
    void prisma.memory.updateMany({
      where: { id: { in: ranked.map((m) => m.id) } },
      data: { importance: { increment: 0.05 } },
    }).catch(() => undefined);
  }

  return ranked;
}

/** Formata memórias rankeadas pra inclusão em system prompt. */
export function renderMemoriesForPrompt(memories: RankedMemory[]): string {
  if (memories.length === 0) return "(ainda aprendendo — sem memórias persistentes relevantes)";
  return memories
    .map((m) => `• [${m.type}] ${m.content}`)
    .join("\n");
}
