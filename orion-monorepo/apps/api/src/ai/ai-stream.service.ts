import type { Response } from "express";
import type { ChatMessage, UserProfile } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { memoryService } from "../memory/memory.service.js";
import { extractAndSaveMemories } from "../memory/memory-extractor.js";
import { searchRelevantMemories, renderMemoriesForPrompt } from "../memory/long-term.service.js";
import { getUserPatterns, renderPatternsForPrompt } from "../memory/mid-term.service.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";
import { setSseHeaders, sseEvent, streamClaudeResponse } from "./streaming.js";
import { captureImplicitIntents, executeIntents } from "../memory/intent-capture.js";
import { extractEntitiesFromConversation, upsertEntityGraph } from "../memory/entity-graph.js";
import type { ToolContext } from "./tools.js";
import { getModuleContext } from "./module-context.service.js";

/* ═══════════════════════════════════════════════════════════════════
   AI stream service — streaming com tool use nativo.

   Agora o stream não cai em fallback quando Claude pede uma ferramenta.
   O loop de tools acontece dentro do stream — o frontend só precisa
   ouvir os eventos e renderizar.

   Eventos SSE emitidos:
   { type: "open" }
   { type: "meta", conversationId: "..." }
   { type: "text", value: "..." }            — delta token-a-token
   { type: "tool_start", tools: ["..."] }    — tool(s) sendo executada(s)
   { type: "tool_done", results: [{...}] }   — resultado das tools
   { type: "done" }                          — fim
   { type: "error", message: "..." }         — erro
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

  const tokenMap = new Map<string, string>();
  await Promise.all(
    user.integrations.map(async (i) => {
      const fresh = await tryEnsureFreshAccessToken(i);
      if (fresh) tokenMap.set(i.provider, fresh);
    }),
  );

  const toolContext: ToolContext = {
    userId,
    gmailToken: tokenMap.get("gmail") ?? null,
    gcalToken: tokenMap.get("gcal") ?? null,
    gdriveToken: tokenMap.get("gdrive") ?? null,
    timezone: profile.timezone,
    trendsAvailable: {
      tmdb: Boolean(env.TMDB_API_KEY),
      rawg: Boolean(env.RAWG_API_KEY),
    },
    webSearchAvailable: Boolean(env.BRAVE_SEARCH_API_KEY),
    externalConnectors: {
      slack: Boolean(env.SLACK_BOT_TOKEN),
      spotify: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
      todoist: Boolean(env.TODOIST_API_TOKEN),
      linear: Boolean(env.LINEAR_API_KEY || env.LINEAR_OAUTH_TOKEN),
      github: Boolean(env.GITHUB_TOKEN),
      microsoft: tokenMap.has("microsoft"),
    },
  };

  const conversation = conversationId
    ? await prisma.conversation.findFirst({ where: { id: conversationId, userId } })
    : await prisma.conversation.create({ data: { userId, moduleId: module ?? null } });
  if (!conversation) {
    sseEvent(res, { type: "error", message: "conversa não encontrada" });
    res.end();
    return;
  }

  const [snapshot, shortHistory, relevantMemories, patterns, preferences, autonomyPolicies, moduleContext] = await Promise.all([
    captureBrainSnapshot(userId).catch(() => null),
    memoryService.getShortTerm(userId, conversation.id),
    searchRelevantMemories(userId, message, 5).catch(() => []),
    getUserPatterns(userId).catch(() => []),
    prisma.userPreference.findMany({
      where: { userId },
      orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
      take: 16,
    }).catch(() => []),
    prisma.autonomyPolicy.findMany({
      where: { userId, enabled: true },
      orderBy: [{ moduleId: "asc" }],
      take: 20,
    }).catch(() => []),
    getModuleContext(userId, module).catch(() => undefined),
  ]);

  const brainContext = snapshot
    ? renderBrainContext(snapshot)
    : `Hora local: ${new Date().toLocaleString("pt-BR", { timeZone: profile.timezone })}`;

  const memoryContext = [
    "## Memórias relevantes:",
    renderMemoriesForPrompt(relevantMemories),
    "",
    "## Preferências:",
    preferences.length
      ? preferences.map((p) => `- ${p.key}: ${p.value}`).join("\n")
      : "(nenhuma)",
    "",
    "## Políticas de autonomia:",
    autonomyPolicies.length
      ? autonomyPolicies.map((p) => `- ${p.moduleId}: ${p.level}`).join("\n")
      : "(padrão)",
    "",
    "## Padrões:",
    renderPatternsForPrompt(patterns),
  ].join("\n");

  const activeTools: string[] = [];
  if (toolContext.gmailToken) activeTools.push("gmail (listar/ler/rascunhar/enviar/responder)");
  if (toolContext.gcalToken) activeTools.push("calendar (listar/criar)");
  if (toolContext.gdriveToken) activeTools.push("drive (buscar/ler docs)");
  activeTools.push("orion_action · external_action_prepare · decision_create");
  activeTools.push("workspace_scan · workspace_read_file · workspace_prepare_file · workspace_prepare_patch · workspace_prepare_command");
  if (toolContext.webSearchAvailable) activeTools.push("web_search (Brave)");
  if (toolContext.trendsAvailable.tmdb) activeTools.push("trends_movies · trends_series");
  if (toolContext.trendsAvailable.rawg) activeTools.push("trends_games · game_search");
  if (toolContext.externalConnectors.slack) activeTools.push("slack_history · slack_post_message");
  if (toolContext.externalConnectors.spotify) activeTools.push("spotify_search");
  if (toolContext.externalConnectors.todoist) activeTools.push("todoist_list_tasks · todoist_create_task");
  if (toolContext.externalConnectors.linear) activeTools.push("linear_list_teams · linear_list_issues · linear_create_issue");
  if (toolContext.externalConnectors.github) activeTools.push("github_list_repos · github_list_issues · github_list_prs · github_repo_summary · github_notifications · github_create_issue");
  if (toolContext.externalConnectors.microsoft) activeTools.push("outlook_list_emails · outlook_get_email · outlook_send_email · outlook_list_events · teams_list_teams · teams_list_messages · teams_send_message · onedrive_recent");

  // Buscar perfil comportamental para personalidade adaptativa
  const behavioralPref = await prisma.userPreference.findFirst({
    where: { userId, key: "behavioral_profile" },
  }).catch(() => null);
  const behavioralProfile = behavioralPref?.value
    ? (() => { try { return JSON.parse(behavioralPref.value); } catch { return undefined; } })()
    : undefined;

  const systemPrompt = buildSystemPrompt({
    profile,
    mode: profile.mode,
    activeTools,
    brainContext,
    memoryContext,
    behavioralProfile,
    moduleContext,
  });

  const userMsg: ChatMessage = { role: "user", content: message };
  const fullHistory: ChatMessage[] = [...shortHistory, userMsg];

  sseEvent(res, { type: "meta", conversationId: conversation.id });

  const dynamicMaxTokens = message.length > 3000 ? 16000 : message.length > 1000 ? 8192 : 4096;

  await streamClaudeResponse({
    systemPrompt,
    messages: fullHistory,
    toolContext,
    maxTokens: dynamicMaxTokens,
    onTextDelta: (text) => sseEvent(res, { type: "text", value: text }),
    onToolStart: (toolNames) => sseEvent(res, { type: "tool_start", tools: toolNames }),
    onToolDone: (results) => sseEvent(res, { type: "tool_done", results }),
    onComplete: (finalText) => {
      sseEvent(res, { type: "done" });
      res.end();

      // Pipeline pós-resposta — fire-and-forget
      void (async () => {
        const assistantMsg: ChatMessage = { role: "assistant", content: finalText };
        try {
          await prisma.$transaction([
            prisma.message.create({ data: { conversationId: conversation.id, role: "user", content: message } }),
            prisma.message.create({ data: { conversationId: conversation.id, role: "assistant", content: finalText } }),
            prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }),
          ]);
          await memoryService.pushShortTerm(userId, conversation.id, userMsg);
          await memoryService.pushShortTerm(userId, conversation.id, assistantMsg);
          void extractAndSaveMemories({ userId, userMessage: message, assistantMessage: finalText });

          void captureImplicitIntents(message, userId).then((intents) => {
            if (intents.length > 0) void executeIntents(userId, intents);
          }).catch(() => undefined);

          void extractEntitiesFromConversation({ userId, userMessage: message, assistantMessage: finalText })
            .then((graph) => { if (graph) void upsertEntityGraph(userId, graph); })
            .catch(() => undefined);
        } catch (err) {
          console.warn("[stream] persist falhou:", (err as Error).message);
        }
      })();
    },
    onError: (err) => {
      sseEvent(res, { type: "error", message: err.message });
      res.end();
    },
  });
}
