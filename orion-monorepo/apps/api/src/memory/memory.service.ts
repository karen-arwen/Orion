import type { ChatMessage } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";

const SHORT_TERM_LIMIT = 20;
const SHORT_TERM_TTL_SECONDS = 60 * 60 * 24;

export type MemoryKind = "fact" | "preference" | "event" | "feedback" | "project" | "relationship";

interface RankedMemory {
  id: string;
  type: string;
  content: string;
  importance: number;
  score: number;
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

function key(userId: string, conversationId: string): string {
  return `memory:short:${userId}:${conversationId}`;
}

async function createEmbedding(text: string): Promise<number[]> {
  if (!env.OPENAI_API_KEY) return [];
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI embeddings ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const body = (await response.json()) as OpenAIEmbeddingResponse;
  return body.data[0]?.embedding ?? [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const memoryService = {
  async getShortTerm(userId: string, conversationId: string): Promise<ChatMessage[]> {
    const raw = await redis.lrange(key(userId, conversationId), -SHORT_TERM_LIMIT, -1);
    return raw
      .map((value: string) => {
        try {
          return JSON.parse(value) as ChatMessage;
        } catch {
          return null;
        }
      })
      .filter((message: ChatMessage | null): message is ChatMessage => message !== null);
  },

  async pushShortTerm(userId: string, conversationId: string, message: ChatMessage): Promise<void> {
    const redisKey = key(userId, conversationId);
    await redis.rpush(redisKey, JSON.stringify(message));
    await redis.ltrim(redisKey, -SHORT_TERM_LIMIT, -1);
    await redis.expire(redisKey, SHORT_TERM_TTL_SECONDS);
  },

  async clearShortTerm(userId: string, conversationId: string): Promise<void> {
    await redis.del(key(userId, conversationId));
  },

  async searchMemoriesBySimilarity(userId: string, query: string, limit = 5): Promise<RankedMemory[]> {
    const queryEmbedding = await createEmbedding(query).catch(() => []);
    const rows = await prisma.memory.findMany({
      where: { userId },
      select: { id: true, type: true, content: true, embedding: true, importance: true },
      orderBy: { importance: "desc" },
      take: queryEmbedding.length > 0 ? 200 : limit,
    });

    const ranked = rows
      .map((memory) => ({
        id: memory.id,
        type: memory.type,
        content: memory.content,
        importance: memory.importance,
        score:
          queryEmbedding.length > 0 && memory.embedding.length > 0
            ? cosineSimilarity(queryEmbedding, memory.embedding) + memory.importance * 0.03
            : memory.importance,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (ranked.length > 0) {
      await prisma.memory.updateMany({
        where: { id: { in: ranked.map((memory) => memory.id) } },
        data: { importance: { increment: 0.05 } },
      });
    }

    return ranked;
  },

  async getLongTermContext(userId: string, query: string): Promise<string> {
    const [preferences, patterns, memories] = await Promise.all([
      prisma.userPreference.findMany({
        where: { userId },
        select: { key: true, value: true, layer: true, confidence: true },
        orderBy: { confidence: "desc" },
        take: 10,
      }),
      prisma.userPattern.findMany({
        where: { userId },
        select: { patternType: true, data: true, confidence: true },
        orderBy: { confidence: "desc" },
        take: 8,
      }),
      this.searchMemoriesBySimilarity(userId, query, 5),
    ]);

    const lines: string[] = [];
    if (preferences.length > 0) {
      lines.push("Preferencias:");
      for (const preference of preferences) {
        lines.push(
          `- ${preference.key}: ${preference.value} (${preference.layer}, conf ${preference.confidence.toFixed(2)})`,
        );
      }
    }

    if (patterns.length > 0) {
      lines.push("Padroes recentes:");
      for (const pattern of patterns) {
        lines.push(
          `- ${pattern.patternType}: ${JSON.stringify(pattern.data)} (conf ${pattern.confidence.toFixed(2)})`,
        );
      }
    }

    if (memories.length > 0) {
      lines.push("Memorias relevantes para esta mensagem:");
      for (const memory of memories) {
        lines.push(`- [${memory.type}] ${memory.content}`);
      }
    }

    return lines.join("\n");
  },

  async remember(userId: string, type: MemoryKind, content: string, importance = 0.5): Promise<void> {
    const embedding = await createEmbedding(content).catch((err) => {
      console.warn("[memory] embedding falhou:", (err as Error).message);
      return [];
    });
    await prisma.memory.create({
      data: { userId, type, content, importance, embedding },
    });
  },
};
