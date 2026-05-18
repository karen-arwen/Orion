import type { Response } from "express";
import type { ChatMessage, UserProfile } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { aiService } from "./ai.service.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { memoryService } from "../memory/memory.service.js";
import { extractAndSaveMemories } from "../memory/memory-extractor.js";
import { searchRelevantMemories, renderMemoriesForPrompt } from "../memory/long-term.service.js";
import { getUserPatterns, renderPatternsForPrompt } from "../memory/mid-term.service.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";
import { setSseHeaders, sseEvent, streamClaudeResponse } from "./streaming.js";
import type { ToolContext } from "./tools.js";

/* ═══════════════════════════════════════════════════════════════════
   AI stream service — versão streaming do chat.

   Fluxo:
   1. Coleta contexto (brain, memórias, patterns) igual ao non-stream
   2. Abre SSE
   3. Stream Claude → emite deltas via SSE
   4. Se Claude precisar de tool, sinaliza `fallback_to_tools` →
      frontend deve refazer via POST /v1/chat (não-streaming, que faz loop)
   5. Quando termina, persiste no banco + Redis + extrai memórias
═══════════════════════════════════════════════════════════════════ */

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

export interface StreamInput {
  userId: string;
  message: string;
  conversationId?: string;
  module?: string;
  res: Response;
}

export async function streamChat(input: StreamInput): Promise<void> {
  const { userId, message, conversationId, module, res } = input;

  // Setup SSE imediato — frontend vê "conectado"
  setSseHeaders(res);
  sseEvent(res, { type: "open" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, integrations: { where: { status: "connected" } } },
  });
  if (!user) {
    sseEvent(res, { type: "error", message: "usuário não encontrado" });
    res.end();
    return;
  }

  const profile = toProfile(user);

  // Tokens frescos
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
    webSearchAvailable: Boolean(env.BRAVE_SEARCH_API_KEY),
  };

  // Conversa
  const conversation = conversationId
    ? await prisma.conversation.findFirst({ where: { id: conversationId, userId } })
    : await prisma.conversation.create({ data: { userId, moduleId: module ?? null } });
  if (!conversation) {
    sseEvent(res, { type: "error", message: "conversa não encontrada" });
    res.end();
    return;
  }

  // Contexto paralelo
  const [snapshot, shortHistory, relevantMemories, patterns] = await Promise.all([
    captureBrainSnapshot(userId).catch(() => null),
    memoryService.getShortTerm(userId, conversation.id),
    searchRelevantMemories(userId, message, 5).catch(() => []),
    getUserPatterns(userId).catch(() => []),
  ]);

  const brainContext = snapshot
    ? renderBrainContext(snapshot)
    : `Hora local: ${new Date().toLocaleString("pt-BR", { timeZone: profile.timezone })}`;

  const memoryContext = [
    "## Memórias relevantes pra esta mensagem:",
    renderMemoriesForPrompt(relevantMemories),
    "",
    "## Padrões aprendidos sobre você:",
    renderPatternsForPrompt(patterns),
  ].join("\n");

  const activeTools: string[] = [];
  if (toolContext.gmailToken) activeTools.push("gmail (listar/ler/rascunhar/enviar/responder)");
  if (toolContext.gcalToken) activeTools.push("calendar (listar/criar)");
  if (toolContext.gdriveToken) activeTools.push("drive (buscar/ler docs)");
  if (toolContext.trendsAvailable.tmdb) activeTools.push("trends_movies / trends_series");
  if (toolContext.trendsAvailable.rawg) activeTools.push("trends_games / game_search");
  if (toolContext.webSearchAvailable) activeTools.push("web_search (Brave)");

  const systemPrompt = buildSystemPrompt({
    profile,
    mode: profile.mode,
    activeTools,
    brainContext,
    memoryContext,
  });

  const userMsg: ChatMessage = { role: "user", content: message };
  const fullHistory: ChatMessage[] = [...shortHistory, userMsg];

  sseEvent(res, { type: "meta", conversationId: conversation.id });

  // Stream
  let aborted = false;
  await streamClaudeResponse({
    systemPrompt,
    messages: fullHistory,
    toolContext,
    onTextDelta: (text) => sseEvent(res, { type: "text", value: text }),
    onToolUse: () => {
      aborted = true;
      sseEvent(res, {
        type: "fallback_to_tools",
        note: "essa pergunta precisa de ferramenta — refaça via POST /v1/chat",
      });
      res.end();
    },
    onComplete: async (finalText) => {
      sseEvent(res, { type: "done" });
      res.end();

      // Persiste (fire-and-forget pra não bloquear o end())
      const assistantMsg: ChatMessage = { role: "assistant", content: finalText };
      void (async () => {
        try {
          await prisma.$transaction([
            prisma.message.create({
              data: { conversationId: conversation.id, role: "user", content: message },
            }),
            prisma.message.create({
              data: { conversationId: conversation.id, role: "assistant", content: finalText },
            }),
            prisma.conversation.update({
              where: { id: conversation.id },
              data: { updatedAt: new Date() },
            }),
          ]);
          await memoryService.pushShortTerm(userId, conversation.id, userMsg);
          await memoryService.pushShortTerm(userId, conversation.id, assistantMsg);
          void extractAndSaveMemories({
            userId,
            userMessage: message,
            assistantMessage: finalText,
          });
        } catch (err) {
          console.warn("[stream] persist falhou:", (err as Error).message);
        }
      })();
    },
    onError: (err) => {
      if (aborted) return;
      sseEvent(res, { type: "error", message: err.message });
      res.end();
    },
  });

  // Marca aiService como usado pra evitar TS unused warning
  void aiService;
}
