import type { ChatMessage, ChatResponse, UserProfile } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { callClaude } from "./claude.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { memoryService } from "../memory/memory.service.js";
import { extractAndSaveMemories } from "../memory/memory-extractor.js";
import { searchRelevantMemories, renderMemoriesForPrompt } from "../memory/long-term.service.js";
import {
  getUserPatterns,
  recomputeModuleUsage,
  renderPatternsForPrompt,
} from "../memory/mid-term.service.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";
import { captureBrainSnapshot, renderBrainContext } from "../brain/context.service.js";
import { getToolsForContext, type ToolContext } from "./tools.js";
import { routeInternalAction } from "../decisions/action-router.js";
import {
  buildAgentPlan,
  renderAgentPlanForPrompt,
  renderRoutedActionsForAnswer,
  type RoutedPlannedAction,
} from "./agent-planner.js";
import { captureImplicitIntents, executeIntents } from "../memory/intent-capture.js";
import { getBehavioralProfile } from "../modules/behavioral-profile.service.js";
import type { BehavioralProfile } from "./system-prompt.js";
import { extractEntitiesFromConversation, upsertEntityGraph } from "../memory/entity-graph.js";
import { getModuleContext } from "./module-context.service.js";

/* ═══════════════════════════════════════════════════════════════════
   AI service — orquestra:
   • Brain context (awareness fresco do estado do mundo)
   • Memória 3 camadas:
       SHORT (Redis): últimas 20 msgs da sessão atual
       MID (Postgres): padrões aprendidos do usuário (UserPattern)
       LONG (Postgres+embeddings): top 5 memórias semanticamente relevantes
   • Tools (Gmail / Calendar / Drive / Trends via REST)
   • Extração de memórias + recompute de patterns (fire-and-forget)
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
        github: tokenMap.get("github") !== undefined || Boolean(env.GITHUB_TOKEN),
        microsoft: tokenMap.get("microsoft") !== undefined,
      },
    };

    // 3. Conversa
    const conversation = conversationId
      ? await prisma.conversation.findFirst({ where: { id: conversationId, userId } })
      : await prisma.conversation.create({ data: { userId, moduleId: module ?? null } });
    if (!conversation) throw new Error("Conversa não encontrada");

    // 4. Coleta paralela: brain snapshot + 3 camadas de memória.
    //    SHORT (Redis): histórico curto da sessão.
    //    LONG (embeddings): top 5 memórias semanticamente relacionadas à mensagem.
    //    MID (patterns): hábitos de uso aprendidos.
    const [snapshot, shortHistory, relevantMemories, patterns, preferences, autonomyPolicies, behavioralProfileRaw, moduleContext] = await Promise.all([
      captureBrainSnapshot(userId).catch((err) => {
        console.warn("[brain] falhou:", (err as Error).message);
        return null;
      }),
      memoryService.getShortTerm(userId, conversation.id),
      searchRelevantMemories(userId, message, 5).catch((err) => {
        console.warn("[memory:long] falhou:", (err as Error).message);
        return [];
      }),
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
      getBehavioralProfile(userId).catch(() => null),
      getModuleContext(userId, module).catch(() => undefined),
    ]);

    const agentPlan = buildAgentPlan(message, module);
    const routedPreflight: RoutedPlannedAction[] = [];
    if (agentPlan.autoRoute) {
      for (const planned of agentPlan.actions) {
        const result = await routeInternalAction(userId, planned);
        routedPreflight.push({ planned, result });
      }
    }

    const brainContext = snapshot
      ? renderBrainContext(snapshot)
      : `Hora local: ${new Date().toLocaleString("pt-BR", { timeZone: profile.timezone })}`;

    const memoryContext = [
      renderAgentPlanForPrompt(agentPlan, routedPreflight),
      "",
      "## Memórias relevantes pra esta mensagem:",
      renderMemoriesForPrompt(relevantMemories),
      "",
      "## Preferencias explicitas do usuario:",
      preferences.length
        ? preferences.map((p) => `- ${p.key} (${p.layer}, ${Math.round(p.confidence * 100)}%): ${p.value}`).join("\n")
        : "(nenhuma preferencia explicita calibrada)",
      "",
      "## Politicas de autonomia por modulo:",
      autonomyPolicies.length
        ? autonomyPolicies.map((p) => `- ${p.moduleId}: nivel=${p.level}; confirmacao=${p.requiresConfirmation ? "sim" : "nao"}; limite_diario=${p.maxDailyActions}; regras=${p.rules.join(" | ") || "sem regra"}`).join("\n")
        : "(nenhuma politica de autonomia calibrada)",
      "",
      "## Padrões aprendidos sobre você:",
      renderPatternsForPrompt(patterns),
    ].join("\n");


    // Converte o perfil comportamental salvo nas preferences para o formato do system prompt
    const behavioralProfile: BehavioralProfile | undefined = behavioralProfileRaw && behavioralProfileRaw.confidence >= 0.4
      ? {
          communicationStyle: behavioralProfileRaw.communicationStyle,
          preferredResponseLength: behavioralProfileRaw.preferredResponseLength,
          usesHumor: behavioralProfileRaw.usesHumor,
          technicalLevel: behavioralProfileRaw.technicalLevel,
          emotionalOpenness: behavioralProfileRaw.emotionalOpenness,
          primaryLanguageTone: behavioralProfileRaw.primaryLanguageTone,
        }
      : undefined;

    const userMsg: ChatMessage = { role: "user", content: message };
    const fullHistory: ChatMessage[] = [...shortHistory, userMsg];

    // 5. Inventário de tools ativas (pra logar no system prompt)
    const activeTools: string[] = [];
    if (toolContext.gmailToken) activeTools.push("gmail (listar/ler/rascunhar/enviar/responder)");
    if (toolContext.gcalToken) activeTools.push("calendar (listar/criar)");
    if (toolContext.gdriveToken) activeTools.push("drive (buscar/ler docs)");
    activeTools.push("sleep_log (registrar sono quando o usuário informar horário)");
    activeTools.push("agent_executor (planner deterministico pre-roteia acoes internas explicitas)");
    activeTools.push("orion_action (executa, cria decisao ou bloqueia acoes internas conforme Autonomy Core)");
    activeTools.push("external_action_prepare (prepara acoes externas na Action Queue antes de executar)");
    activeTools.push("workspace_scan / workspace_context_map / workspace_read_file / workspace_prepare_file / workspace_prepare_patch / workspace_prepare_command / workspace_recent_executions / workspace_diagnose_last_execution / workspace_debug_runbook (Dev Executor aprovado)");
    activeTools.push("decision_create (fallback para criar decisao pendente manualmente)");
    if (toolContext.trendsAvailable.tmdb) activeTools.push("trends_movies / trends_series (TMDB)");
    if (toolContext.trendsAvailable.rawg) activeTools.push("trends_games / game_search (RAWG)");
    if (toolContext.webSearchAvailable) activeTools.push("web_search (Brave — busca real-time)");
    if (toolContext.externalConnectors.slack) activeTools.push("slack_history / slack_post_message");
    if (toolContext.externalConnectors.spotify) activeTools.push("spotify_search");
    if (toolContext.externalConnectors.todoist) activeTools.push("todoist_list_tasks / todoist_create_task");
    if (toolContext.externalConnectors.linear) activeTools.push("linear_list_teams / linear_list_issues / linear_create_issue");
    if (toolContext.externalConnectors.github) activeTools.push("github_list_repos / github_list_issues / github_list_prs / github_repo_summary / github_notifications / github_create_issue");
    if (toolContext.externalConnectors.microsoft) activeTools.push("outlook_list_emails / outlook_get_email / outlook_send_email / outlook_list_events / teams_list_teams / teams_list_messages / teams_send_message / onedrive_recent");

    const systemPrompt = buildSystemPrompt({
      profile,
      mode: profile.mode,
      activeTools,
      brainContext,
      memoryContext,
      behavioralProfile,
      moduleContext,
    });

    // 6. Chama Claude (com tool loop)
    // Mensagens longas (planos, análises) precisam de mais espaço de saída
    const dynamicMaxTokens = message.length > 3000 ? 16000 : message.length > 1000 ? 8192 : 4096;
    const result = await callClaude({ systemPrompt, messages: fullHistory, toolContext, maxTokens: dynamicMaxTokens });

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: `${result.text || "(O.R.I.O.N. retornou silêncio.)"}${renderRoutedActionsForAnswer(routedPreflight)}`,
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

    // 8. Pipeline pós-resposta — tudo fire-and-forget (não bloqueia o usuário).

    // 8a. Extração de memórias clássica
    void extractAndSaveMemories({
      userId,
      userMessage: message,
      assistantMessage: assistantMsg.content,
    });

    // 8b. Captura de intenções implícitas — segundo cérebro automático.
    //     Lê a mensagem do usuário e age em intenções que ele não pediu.
    void captureImplicitIntents(message, userId).then((intents) => {
      if (intents.length > 0) {
        void executeIntents(userId, intents);
      }
    }).catch(() => undefined);

    // 8c. Grafo de entidades
    void extractEntitiesFromConversation({
      userId,
      userMessage: message,
      assistantMessage: assistantMsg.content,
    }).then((graph) => {
      if (graph && (graph.entities.length > 0 || graph.patterns.length > 0)) {
        void upsertEntityGraph(userId, graph);
      }
    }).catch(() => undefined);

    // 8d. Recompute de patterns (10%)
    if (Math.random() < 0.1) {
      void recomputeModuleUsage(userId).catch(() => undefined);
    }

    return {
      conversationId: conversation.id,
      message: { role: "assistant" as const, content: result.text },
      toolResults: result.toolCalls.length > 0
        ? result.toolCalls.map((tc) => ({ server: "orion", tool: tc.name, result: tc.ok ? "ok" : "error" }))
        : undefined,
    };
  },
};
