import type { ChatMessage, ChatResponse, UserProfile } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { callClaude } from "./claude.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { memoryService } from "../memory/memory.service.js";
import { extractAndSaveMemories } from "../memory/memory-extractor.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";
import { getToolsForContext, type ToolContext } from "./tools.js";

/* ═══════════════════════════════════════════════════════════════════
   AI service — orquestra:
   • Brain context (awareness fresco)
   • Memória (curta no Redis, longa no Postgres)
   • Tools (Gmail / Calendar / Drive via REST)
   • Extração de memórias (fire-and-forget após responder)
═══════════════════════════════════════════════════════════════════ */

export interface ProcessChatInput {
  userId: string;
  message: string;
  conversationId?: string;
  module?: string;
}

function toProfile(user: {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarColor: string;
  mode: "SILENCIOSO" | "NORMAL" | "STARK";
  plan: "FREE" | "PRO" | "ENTERPRISE";
  createdAt: Date;
  profile: {
    bio: string;
    timezone: string;
    language: string;
    themePrimary: string;
    themeSecondary: string;
    themeAccent: string;
    onboardedAt: Date | null;
  } | null;
}): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? user.name.slice(0, 2).toUpperCase(),
    avatarColor: user.avatarColor,
    bio: user.profile?.bio ?? "",
    mode: user.mode,
    plan: user.plan,
    timezone: user.profile?.timezone ?? "America/Sao_Paulo",
    language: user.profile?.language ?? "pt-BR",
    theme: {
      primary: user.profile?.themePrimary ?? "#00D4FF",
      secondary: user.profile?.themeSecondary ?? "#7C3AED",
      accent: user.profile?.themeAccent ?? "#F59E0B",
    },
    onboardedAt: user.profile?.onboardedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export const aiService = {
  async chat({ userId, message, conversationId, module }: ProcessChatInput): Promise<ChatResponse> {
    // 1. Carrega usuário + integrações conectadas
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, integrations: { where: { status: "connected" } } },
    });
    if (!user) throw new Error(`Usuário ${userId} não encontrado`);

    const profile = toProfile(user);

    // 2. Tokens frescos pra cada integração
    const tokenMap = new Map<string, string>();
    await Promise.all(
      user.integrations.map(async (i) => {
        const fresh = await tryEnsureFreshAccessToken(i);
        if (fresh) tokenMap.set(i.provider, fresh);
      }),
    );

    const toolContext: ToolContext = {
      gmailToken: tokenMap.get("gmail") ?? null,
      gcalToken: tokenMap.get("gcal") ?? null,
      gdriveToken: tokenMap.get("gdrive") ?? null,
      timezone: profile.timezone,
      trendsAvailable: {
        tmdb: Boolean(env.TMDB_API_KEY),
        rawg: Boolean(env.RAWG_API_KEY),
      },
    };

    // 3. Conversa
    const conversation = conversationId
      ? await prisma.conversation.findFirst({ where: { id: conversationId, userId } })
      : await prisma.conversation.create({ data: { userId, moduleId: module ?? null } });
    if (!conversation) throw new Error("Conversa não encontrada");

    // 4. Coleta paralela: brain snapshot, histórico curto, contexto longo
    const [snapshot, shortHistory, longContext] = await Promise.all([
      captureBrainSnapshot(userId).catch((err) => {
        console.warn("[brain] falhou:", (err as Error).message);
        return null;
      }),
      memoryService.getShortTerm(userId, conversation.id),
      memoryService.getLongTermContext(userId),
    ]);

    const brainContext = snapshot
      ? renderBrainContext(snapshot)
      : `Hora local: ${new Date().toLocaleString("pt-BR", { timeZone: profile.timezone })}`;

    const userMsg: ChatMessage = { role: "user", content: message };
    const fullHistory: ChatMessage[] = [...shortHistory, userMsg];

    // 5. Inventário de tools ativas (pra logar no system prompt)
    const activeTools: string[] = [];
    if (toolContext.gmailToken) activeTools.push("gmail (listar/ler/rascunhar/enviar/responder)");
    if (toolContext.gcalToken) activeTools.push("calendar (listar/criar)");
    if (toolContext.gdriveToken) activeTools.push("drive (buscar/ler docs)");
    if (toolContext.trendsAvailable.tmdb) activeTools.push("trends_movies / trends_series (TMDB)");
    if (toolContext.trendsAvailable.rawg) activeTools.push("trends_games / game_search (RAWG)");

    const systemPrompt = buildSystemPrompt({
      profile,
      mode: profile.mode,
      activeTools,
      brainContext,
      memoryContext: longContext || undefined,
    });

    // 6. Chama Claude (com tool loop)
    const result = await callClaude({ systemPrompt, messages: fullHistory, toolContext });

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: result.text || "(O.R.I.O.N. retornou silêncio.)",
    };

    if (result.toolCalls.length > 0) {
      console.log(
        `[orion] ${result.toolCalls.length} tool call(s):`,
        result.toolCalls.map((t) => `${t.name}${t.ok ? "✓" : "✗"}`).join(", "),
      );
    }

    // 7. Persiste turno
    await prisma.$transaction([
      prisma.message.create({
        data: { conversationId: conversation.id, role: "user", content: message },
      }),
      prisma.message.create({
        data: { conversationId: conversation.id, role: "assistant", content: assistantMsg.content },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    await memoryService.pushShortTerm(userId, conversation.id, userMsg);
    await memoryService.pushShortTerm(userId, conversation.id, assistantMsg);

    // 8. Extração de memórias — fire-and-forget (não bloqueia a resposta)
    void extractAndSaveMemories({
      userId,
      userMessage: message,
      assistantMessage: assistantMsg.content,
    });

    return {
      conversationId: conversation.id,
      message: assistantMsg,
      toolResults: result.toolCalls.map((t) => ({
        server: "google",
        tool: t.name,
        result: t.ok ? "ok" : "error",
      })),
    };
  },
};
