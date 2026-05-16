import type { ChatMessage } from "@orion/types";
import { redis } from "../db/redis.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   Sistema de memória em 3 camadas:
   - SHORT (Redis):  últimas N mensagens da conversa atual (volátil)
   - MID (Postgres): padrões da semana / dia
   - LONG (Postgres): perfil aprendido, preferências, feedback
═══════════════════════════════════════════════════════════════════ */

const SHORT_TERM_LIMIT = 20;
const SHORT_TERM_TTL_SECONDS = 60 * 60 * 6; // 6h

function key(userId: string, conversationId: string): string {
  return `orion:chat:${userId}:${conversationId}`;
}

export const memoryService = {
  /** Lê últimas N mensagens da conversa atual no Redis. */
  async getShortTerm(userId: string, conversationId: string): Promise<ChatMessage[]> {
    const raw = await redis.lrange(key(userId, conversationId), -SHORT_TERM_LIMIT, -1);
    return raw
      .map((s: string) => {
        try {
          return JSON.parse(s) as ChatMessage;
        } catch {
          return null;
        }
      })
      .filter((m: ChatMessage | null): m is ChatMessage => m !== null);
  },

  /** Acrescenta uma mensagem no histórico curto. */
  async pushShortTerm(userId: string, conversationId: string, msg: ChatMessage): Promise<void> {
    const k = key(userId, conversationId);
    await redis.rpush(k, JSON.stringify(msg));
    await redis.ltrim(k, -SHORT_TERM_LIMIT, -1);
    await redis.expire(k, SHORT_TERM_TTL_SECONDS);
  },

  /** Limpa o histórico curto (ex: usuário clicou "limpar conversa"). */
  async clearShortTerm(userId: string, conversationId: string): Promise<void> {
    await redis.del(key(userId, conversationId));
  },

  /** Recupera contexto longo-prazo do Postgres: preferências + memórias relevantes. */
  async getLongTermContext(userId: string): Promise<string> {
    const [prefs, memories] = await Promise.all([
      prisma.userPreference.findMany({
        where: { userId },
        orderBy: { confidence: "desc" },
        take: 10,
      }),
      prisma.memory.findMany({
        where: { userId },
        orderBy: { importance: "desc" },
        take: 8,
      }),
    ]);

    const lines: string[] = [];
    if (prefs.length > 0) {
      lines.push("• Preferências:");
      for (const p of prefs) {
        lines.push(`  - ${p.key}: ${p.value} (${p.layer}, conf ${p.confidence.toFixed(2)})`);
      }
    }
    if (memories.length > 0) {
      lines.push("• Memórias:");
      for (const m of memories) {
        lines.push(`  - [${m.type}] ${m.content}`);
      }
    }
    return lines.join("\n");
  },

  /** Registra uma memória (fato, preferência, evento ou feedback). */
  async remember(
    userId: string,
    type: "fact" | "preference" | "event" | "feedback",
    content: string,
    importance = 0.5,
  ): Promise<void> {
    await prisma.memory.create({
      data: { userId, type, content, importance, embedding: [] },
    });
  },
};
