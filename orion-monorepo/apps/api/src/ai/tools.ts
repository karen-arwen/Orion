import type Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import {
  calendarCreate,
  calendarList,
  driveReadDoc,
  driveSearch,
  gmailDraft,
  gmailList,
  gmailRead,
  gmailReply,
  gmailSend,
} from "../integrations/google-api.js";
import {
  rawgSearchGame,
  rawgTrendingGames,
  rawgUpcomingGames,
  tmdbTrendingMovies,
  tmdbTrendingShows,
  tmdbUpcomingMovies,
} from "../integrations/trends.js";
import { braveSearch } from "../integrations/brave-search.js";
import {
  linearCreateIssue,
  linearListIssues,
  linearListTeams,
  slackHistory,
  slackPostMessage,
  spotifySearch,
  todoistCreateTask,
  todoistListTasks,
} from "../integrations/external-connectors.js";
import { logSleep } from "../modules/sleep.service.js";
import {
  buildDebugRunbook,
  diagnoseWorkspaceExecution,
  getCodeContextMap,
  getWorkspaceSummary,
  prepareWorkspaceCommand,
  prepareWorkspacePatch,
  readWorkspaceFile,
} from "../modules/dev.service.js";
import { createDecision, listDecisions } from "../decisions/decision.service.js";
import { routeInternalAction } from "../decisions/action-router.js";
import type { ExternalActionType, InternalActionType } from "@orion/types";
import { searchRelevantMemories, renderMemoriesForPrompt } from "../memory/long-term.service.js";
import { generateEmailDraft, createGmailDraft } from "../modules/email-drafting.service.js";
import { detectConflicts, prepareMeetingBrief, findFreeSlots, analyzeWeeklyLoad } from "../modules/calendar-intelligence.service.js";
import { autoCategorize, getMonthlyCategorySpend, checkBudgetLimits, calculateBurnRate, detectUnusedSubscriptions } from "../modules/financial-autopilot.service.js";
import { analyzeHabits } from "../modules/habit-intelligence.service.js";
import { buildAgentPlan, renderAgentPlanForPrompt } from "./agent-planner.js";
import { getNudges } from "../modules/social.service.js";
import { getPersonalizedRecommendations, suggestMusic } from "../modules/content-recommendations.service.js";
import { planTrip } from "../modules/travel.service.js";
import {
  githubListRepos,
  githubListIssues,
  githubListPRs,
  githubRepoSummary,
  githubListNotifications,
  githubCreateIssue,
} from "../integrations/github-handlers.js";
import {
  outlookListEmails,
  outlookGetEmail,
  outlookSendEmail,
  outlookListEvents,
  teamsListTeams,
  teamsListMessages,
  teamsSendMessage,
  onedriveListRecent,
} from "../integrations/microsoft-handlers.js";

/* ═══════════════════════════════════════════════════════════════════
   Definição das ferramentas que o Claude pode chamar.

   - tools[] = schema (vai pro Claude)
   - executeTool() = dispatcher que recebe nome+args, executa e retorna
     o resultado como string (texto que o Claude lê no próximo turno).

   ToolContext carrega o que o executor precisa pra agir em nome do
   usuário: o access_token de cada provider (já renovado pelo
   token-manager) e o timezone pra interpretar datas relativas.
═══════════════════════════════════════════════════════════════════ */

export interface ToolContext {
  userId: string;
  gmailToken: string | null;
  gcalToken: string | null;
  gdriveToken: string | null;
  timezone: string;
  /** APIs públicas — disponíveis se configuradas no env */
  trendsAvailable: { tmdb: boolean; rawg: boolean };
  webSearchAvailable: boolean;
  externalConnectors: {
    slack: boolean;
    spotify: boolean;
    todoist: boolean;
    linear: boolean;
    github: boolean;
    microsoft: boolean;
  };
}

type ToolSchema = Anthropic.Tool;

/** Define o conjunto de tools que o Claude vê. */
export function getToolsForContext(ctx: ToolContext): ToolSchema[] {
  const tools: ToolSchema[] = [];

  if (ctx.gmailToken) {
    tools.push(
      {
        name: "gmail_list",
        description:
          "Lista os emails mais recentes da caixa de entrada do usuário. Use 'query' com sintaxe do Gmail (ex: 'is:unread', 'from:joao@x.com', 'newer_than:2d', 'has:attachment'). Sem query = últimos emails recebidos. Retorna metadados (não o corpo completo).",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Filtro estilo Gmail. Ex: 'is:unread newer_than:1d'. Deixe vazio pra últimos emails.",
            },
            max: {
              type: "number",
              description: "Quantidade de emails (1-25). Padrão 10.",
            },
          },
        },
      },
      {
        name: "gmail_read",
        description:
          "Lê o corpo completo de um email específico. Use o ID retornado por gmail_list. Útil quando o usuário quer detalhes ou pra rascunhar uma resposta.",
        input_schema: {
          type: "object",
          properties: {
            message_id: { type: "string", description: "ID da mensagem (vem de gmail_list)" },
          },
          required: ["message_id"],
        },
      },
      {
        name: "gmail_draft",
        description:
          "Cria um RASCUNHO de email — não envia. Útil quando o usuário quer revisar antes. Rascunho fica na pasta Rascunhos do Gmail.",
        input_schema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Email do destinatário" },
            subject: { type: "string", description: "Assunto" },
            body: { type: "string", description: "Corpo do email em texto plano" },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "gmail_send",
        description:
          "ENVIA um email direto da conta do usuário. AÇÃO IRREVERSÍVEL — SEMPRE confirme com o usuário (mostrando destinatário, assunto e corpo) ANTES de chamar. Se o usuário pediu pra 'enviar' diretamente, ainda assim mostre o rascunho final e pergunte 'Posso enviar?' antes de chamar essa tool.",
        input_schema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Email do destinatário" },
            subject: { type: "string", description: "Assunto" },
            body: { type: "string", description: "Corpo do email em texto plano" },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "gmail_reply",
        description:
          "Responde uma thread de email mantendo o histórico. Use após gmail_read pra pegar thread_id, message_id e from. AÇÃO IRREVERSÍVEL — confirme com o usuário ANTES de chamar.",
        input_schema: {
          type: "object",
          properties: {
            thread_id: { type: "string", description: "ID da thread (de gmail_list/read)" },
            message_id: { type: "string", description: "ID do email original (de gmail_list/read)" },
            to: { type: "string", description: "Email pra quem responder (geralmente o from do original)" },
            subject: { type: "string", description: "Assunto original (prefixo 'Re:' é adicionado se faltar)" },
            body: { type: "string", description: "Corpo da resposta" },
          },
          required: ["thread_id", "message_id", "to", "subject", "body"],
        },
      },
    );
  }

  if (ctx.gcalToken) {
    tools.push(
      {
        name: "calendar_list",
        description:
          "Lista eventos do calendário entre duas datas. Use ISO 8601 com timezone. Pra 'hoje', 'amanhã', 'esta semana' — calcule as datas concretas no timezone do usuário antes de chamar.",
        input_schema: {
          type: "object",
          properties: {
            time_min: { type: "string", description: "Início (ISO 8601, ex: 2026-05-15T00:00:00-03:00)" },
            time_max: { type: "string", description: "Fim (ISO 8601)" },
            max: { type: "number", description: "Máximo de eventos. Padrão 20." },
          },
          required: ["time_min", "time_max"],
        },
      },
      {
        name: "calendar_create",
        description:
          "Cria um evento no calendário do usuário. CONFIRME COM O USUÁRIO antes de criar (mostre data/hora completas). USE SEMPRE O ANO ATUAL (vide bloco DATA ATUAL no system prompt) — nunca crie em anos passados. Se o usuário disser 'amanhã' ou 'sexta', calcule a data exata no ano atual.",
        input_schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Título do evento" },
            start_iso: {
              type: "string",
              description:
                "Início no formato ISO 8601 com timezone, ex: 2026-05-18T14:00:00-03:00. ANO DEVE SER O ATUAL.",
            },
            end_iso: {
              type: "string",
              description:
                "Fim no formato ISO 8601 com timezone. ANO DEVE SER O ATUAL.",
            },
            description: { type: "string", description: "Descrição opcional" },
            location: { type: "string", description: "Local opcional" },
            attendees: {
              type: "array",
              items: { type: "string" },
              description: "Emails dos convidados (opcional)",
            },
          },
          required: ["summary", "start_iso", "end_iso"],
        },
      },
    );
  }

  if (ctx.gdriveToken) {
    tools.push(
      {
        name: "drive_search",
        description:
          "Busca arquivos no Google Drive por nome ou conteúdo. Retorna lista com IDs e nomes.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Termo de busca" },
            max: { type: "number", description: "Máximo de resultados. Padrão 10." },
          },
          required: ["query"],
        },
      },
      {
        name: "drive_read_doc",
        description:
          "Lê o texto de um Google Doc. Use o ID retornado por drive_search. Funciona só pra Google Docs (não PDFs/Sheets).",
        input_schema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "ID do arquivo (de drive_search)" },
          },
          required: ["file_id"],
        },
      },
    );
  }

  // ── TENDÊNCIAS CULTURAIS (filmes / séries / jogos) ─────────────
  if (ctx.trendsAvailable.tmdb) {
    tools.push(
      {
        name: "trends_movies",
        description:
          "Filmes em alta agora (TMDB). Use quando o usuário pergunta 'o que tá bombando', 'filme pra assistir esse fim de semana', 'que filme tá em alta', 'o que assistir'. Devolve top 10 com nota e sinopse.",
        input_schema: {
          type: "object",
          properties: {
            window: {
              type: "string",
              enum: ["day", "week"],
              description: "Janela temporal — 'day' = hoje, 'week' = semana. Padrão week.",
            },
            kind: {
              type: "string",
              enum: ["trending", "upcoming"],
              description: "'trending' = em alta agora. 'upcoming' = próximos lançamentos no BR.",
            },
          },
        },
      },
      {
        name: "trends_series",
        description:
          "Séries em alta agora (TMDB). Use pra 'série pra maratonar', 'o que tá bombando em séries', recomendação de série.",
        input_schema: {
          type: "object",
          properties: {
            window: {
              type: "string",
              enum: ["day", "week"],
              description: "'day' ou 'week'. Padrão week.",
            },
          },
        },
      },
    );
  }

  if (ctx.trendsAvailable.rawg) {
    tools.push(
      {
        name: "trends_games",
        description:
          "Jogos em alta ou próximos lançamentos (RAWG). Use pra 'jogo novo pra jogar', 'lançamento de jogo', 'jogo bombando agora'.",
        input_schema: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["trending", "upcoming"],
              description: "'trending' = populares últimos 60 dias. 'upcoming' = próximos 60 dias.",
            },
          },
        },
      },
      {
        name: "game_search",
        description:
          "Busca um jogo específico por nome no banco da RAWG. Útil quando o usuário pergunta sobre um jogo específico.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Nome do jogo" },
          },
          required: ["query"],
        },
      },
    );
  }

  // ── BUSCA NA WEB (Brave Search) ────────────────────────────────
  if (ctx.webSearchAvailable) {
    tools.push({
      name: "web_search",
      description:
        "Busca na web em tempo real (via Brave Search). Use SEMPRE que precisar de informação ATUAL que você não tem certeza absoluta — notícias, vagas, eventos, lançamentos, preços, status de empresas, cotações, qualquer coisa que muda com o tempo. NÃO use pra conhecimento estabelecido (matemática, história antiga, conceitos clássicos).",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca em linguagem natural" },
          freshness: {
            type: "string",
            enum: ["pd", "pw", "pm", "py"],
            description:
              "Filtro de recência: pd=24h, pw=semana, pm=mês, py=ano. Use pd/pw pra notícias quentes.",
          },
          count: {
            type: "number",
            description: "Quantidade de resultados (1-15). Padrão 8.",
          },
        },
        required: ["query"],
      },
    });
  }

  if (ctx.externalConnectors.slack) {
    tools.push(
      {
        name: "slack_history",
        description:
          "Lê mensagens recentes de um canal/conversa do Slack. Precisa do channel_id (C..., G..., D...). Use para resumir contexto real do Slack quando o usuário informar o canal.",
        input_schema: {
          type: "object",
          properties: {
            channel_id: { type: "string", description: "ID do canal/conversa Slack, ex: C0123..." },
            limit: { type: "number", description: "Quantidade de mensagens, 1-25. Padrão 10." },
          },
          required: ["channel_id"],
        },
      },
      {
        name: "slack_post_message",
        description:
          "Envia mensagem no Slack. AÇÃO EXTERNA — confirme com o usuário antes de chamar, mostrando canal e texto final.",
        input_schema: {
          type: "object",
          properties: {
            channel_id: { type: "string", description: "ID do canal/conversa Slack." },
            text: { type: "string", description: "Mensagem final a enviar." },
          },
          required: ["channel_id", "text"],
        },
      },
    );
  }

  if (ctx.externalConnectors.spotify) {
    tools.push({
      name: "spotify_search",
      description:
        "Busca playlists ou faixas no Spotify via Web API. Use para modo foco, relax, gaming, treino, descoberta musical e recomendações culturais.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Busca em linguagem natural, ex: focus cyberpunk instrumental." },
          type: { type: "string", enum: ["playlist", "track"], description: "Tipo de busca. Padrão playlist." },
          limit: { type: "number", description: "Quantidade, 1-10. Padrão 8." },
        },
        required: ["query"],
      },
    });
  }

  if (ctx.externalConnectors.todoist) {
    tools.push(
      {
        name: "todoist_list_tasks",
        description:
          "Lista tarefas abertas do Todoist. Use quando o usuário quiser cruzar o Life OS com tarefas externas.",
        input_schema: {
          type: "object",
          properties: {
            filter: { type: "string", description: "Filtro Todoist opcional, ex: today, overdue, p1." },
            limit: { type: "number", description: "Quantidade, 1-30. Padrão 12." },
          },
        },
      },
      {
        name: "todoist_create_task",
        description:
          "Cria tarefa no Todoist. AÇÃO EXTERNA — confirme antes quando o usuário não pediu criação explicitamente.",
        input_schema: {
          type: "object",
          properties: {
            content: { type: "string", description: "Título da tarefa." },
            description: { type: "string", description: "Descrição opcional." },
            due_string: { type: "string", description: "Prazo natural aceito pelo Todoist, ex: tomorrow 10am." },
            priority: { type: "number", description: "Prioridade Todoist 1-4." },
          },
          required: ["content"],
        },
      },
    );
  }

  if (ctx.externalConnectors.linear) {
    tools.push(
      {
        name: "linear_list_teams",
        description:
          "Lista times do Linear e seus IDs. Use antes de criar issue quando o team_id não estiver claro.",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "linear_list_issues",
        description:
          "Lista issues recentes do Linear. Pode filtrar localmente por texto.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Filtro textual opcional por título/identificador." },
            limit: { type: "number", description: "Quantidade, 1-25. Padrão 10." },
          },
        },
      },
      {
        name: "linear_create_issue",
        description:
          "Cria issue no Linear. AÇÃO EXTERNA — confirme com o usuário antes, mostrando time, título e descrição final. Se faltar team_id, chame linear_list_teams antes.",
        input_schema: {
          type: "object",
          properties: {
            team_id: { type: "string", description: "ID do time Linear." },
            title: { type: "string", description: "Título da issue." },
            description: { type: "string", description: "Descrição em Markdown." },
          },
          required: ["team_id", "title"],
        },
      },
    );
  }


  if (ctx.externalConnectors.github) {
    tools.push(
      {
        name: "github_list_repos",
        description: "Lista repositorios do usuario no GitHub (mais recentes primeiro). Use para entender quais projetos existem.",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "github_list_issues",
        description: "Lista issues abertas de um repositorio GitHub. Use para ver o que esta pendente num projeto.",
        input_schema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repositorio no formato owner/nome. Ex: karen/orion-monorepo" },
            state: { type: "string", enum: ["open", "closed", "all"], description: "Estado das issues. Padrao: open" },
          },
          required: ["repo"],
        },
      },
      {
        name: "github_list_prs",
        description: "Lista pull requests de um repositorio GitHub. Mostre PRs abertos para revisar ou priorizar.",
        input_schema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repositorio no formato owner/nome." },
            state: { type: "string", enum: ["open", "closed", "all"], description: "Estado dos PRs. Padrao: open" },
          },
          required: ["repo"],
        },
      },
      {
        name: "github_repo_summary",
        description: "Resumo rapido de um repo: issues abertas, PRs pendentes, status do ultimo CI/build.",
        input_schema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repositorio no formato owner/nome." },
          },
          required: ["repo"],
        },
      },
      {
        name: "github_notifications",
        description: "Lista notificacoes nao lidas do GitHub (issues mencionadas, PRs aguardando review, etc).",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "github_create_issue",
        description: "Cria uma issue no GitHub. ACAO EXTERNA — mostre titulo, descricao e repo antes de confirmar.",
        input_schema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repositorio no formato owner/nome." },
            title: { type: "string", description: "Titulo da issue." },
            body: { type: "string", description: "Descricao da issue em Markdown." },
            labels: { type: "array", items: { type: "string" }, description: "Labels opcionais." },
          },
          required: ["repo", "title", "body"],
        },
      },
    );
  }

  if (ctx.externalConnectors.microsoft) {
    tools.push(
      {
        name: "outlook_list_emails",
        description: "Lista emails recentes do Outlook. Equivalente ao gmail_list mas para usuarios Microsoft.",
        input_schema: {
          type: "object",
          properties: {
            folder: { type: "string", enum: ["inbox", "sent", "drafts"], description: "Pasta. Padrao: inbox" },
            top: { type: "number", description: "Quantos emails. Padrao: 20" },
            unread_only: { type: "boolean", description: "Somente nao lidos. Padrao: false" },
          },
        },
      },
      {
        name: "outlook_get_email",
        description: "Le o corpo completo de um email do Outlook pelo ID.",
        input_schema: {
          type: "object",
          properties: {
            message_id: { type: "string", description: "ID do email retornado por outlook_list_emails." },
          },
          required: ["message_id"],
        },
      },
      {
        name: "outlook_send_email",
        description: "Envia email pelo Outlook. ACAO EXTERNA — mostre destinatario, assunto e corpo antes de confirmar.",
        input_schema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Email do destinatario." },
            subject: { type: "string", description: "Assunto do email." },
            body: { type: "string", description: "Corpo do email em texto simples." },
            cc: { type: "string", description: "Email em copia (opcional)." },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "outlook_list_events",
        description: "Lista eventos do Outlook Calendar. Equivalente ao calendar_list para usuarios Microsoft.",
        input_schema: {
          type: "object",
          properties: {
            days: { type: "number", description: "Quantos dias a frente. Padrao: 7" },
          },
        },
      },
      {
        name: "teams_list_teams",
        description: "Lista equipes do Microsoft Teams que o usuario participa.",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "teams_list_messages",
        description: "Lista mensagens recentes de um canal do Teams.",
        input_schema: {
          type: "object",
          properties: {
            team_id: { type: "string", description: "ID do time (de teams_list_teams)." },
            channel_id: { type: "string", description: "ID do canal." },
          },
          required: ["team_id", "channel_id"],
        },
      },
      {
        name: "teams_send_message",
        description: "Envia mensagem em um canal do Teams. ACAO EXTERNA — confirme antes.",
        input_schema: {
          type: "object",
          properties: {
            team_id: { type: "string", description: "ID do time." },
            channel_id: { type: "string", description: "ID do canal." },
            content: { type: "string", description: "Mensagem a enviar." },
          },
          required: ["team_id", "channel_id", "content"],
        },
      },
      {
        name: "onedrive_recent",
        description: "Lista arquivos recentes do OneDrive. Equivalente ao drive_search para usuarios Microsoft.",
        input_schema: { type: "object", properties: {} },
      },
    );
  }

  tools.push(
    {
      name: "workspace_scan",
      description:
        "Escaneia o workspace local do Orion e lista arquivos relevantes. Use quando o usuário pedir para entender o projeto, localizar arquivos, planejar alteração ou agir como Claude Code/Codex.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "workspace_context_map",
      description:
        "Retorna um mapa tecnico do monorepo: rotas API, services, AI core, integrações, paginas, hooks, componentes, stores e tipos compartilhados. Use antes de decidir onde implementar algo.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "workspace_read_file",
      description:
        "Lê um arquivo dentro do workspace local do Orion. Não lê fora do projeto. Use antes de propor alterações.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho relativo dentro do workspace, ex: apps/web/src/App.tsx." },
        },
        required: ["path"],
      },
    },
    {
      name: "workspace_prepare_file",
      description:
        "Prepara criação/substituição completa de arquivo no workspace via Action Queue. NÃO escreve direto; cria uma decisão externa workspace.write_file com preview. Para editar trecho específico, prefira workspace_prepare_patch.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto da mudança." },
          summary: { type: "string", description: "Resumo do motivo e do impacto." },
          path: { type: "string", description: "Caminho relativo dentro do workspace." },
          content: { type: "string", description: "Conteúdo completo do arquivo após a mudança." },
          mode: { type: "string", enum: ["create", "replace"], description: "create falha se existir; replace substitui." },
        },
        required: ["title", "summary", "path", "content"],
      },
    },
    {
      name: "workspace_prepare_patch",
      description:
        "Prepara um patch search/replace em arquivo existente via Action Queue. Use para edições cirúrgicas. Primeiro leia o arquivo com workspace_read_file e use um bloco search EXATO; se não for único, use replace_all ou leia mais contexto.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto da mudança." },
          summary: { type: "string", description: "Resumo do motivo e do impacto." },
          path: { type: "string", description: "Caminho relativo dentro do workspace." },
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                search: { type: "string", description: "Trecho exato atual do arquivo." },
                replace: { type: "string", description: "Trecho novo que substituirá search." },
                replaceAll: { type: "boolean", description: "Use true apenas para substituições repetidas intencionais." },
              },
              required: ["search", "replace"],
            },
            description: "Até 10 operações search/replace aplicadas em ordem.",
          },
        },
        required: ["title", "summary", "path", "operations"],
      },
    },
    {
      name: "workspace_prepare_command",
      description:
        "Prepara um comando seguro de verificacao para Action Queue. Nao executa direto. Permitidos: npm run <script> ... e git status/diff/log/show/branch. Use para typecheck, build, testes e inspeções git depois de propor mudanças.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto da execução." },
          summary: { type: "string", description: "Resumo do motivo." },
          command: { type: "string", enum: ["npm", "git"] },
          args: {
            type: "array",
            items: { type: "string" },
            description: "Argumentos sem shell. Ex: ['run','typecheck','--workspace','apps/api'].",
          },
          cwd: { type: "string", description: "Caminho relativo opcional dentro do workspace. Padrão raiz." },
        },
        required: ["title", "summary", "command", "args"],
      },
    },
    {
      name: "workspace_recent_executions",
      description:
        "Consulta as execuções recentes da Action Queue, incluindo comandos, patches e escritas. Use quando o usuário perguntar o que aconteceu no último comando, build, typecheck ou ação aprovada.",
      input_schema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade de execuções, 1-10. Padrão 5." },
        },
      },
    },
    {
      name: "workspace_diagnose_last_execution",
      description:
        "Analisa a ultima execucao da Action Queue e extrai erro principal, arquivos provaveis, linhas, codigos TS e proximos passos. Use depois de build/typecheck/teste falhar para planejar patch.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "workspace_debug_runbook",
      description:
        "Gera um runbook de debug baseado na ultima execucao: inspecionar arquivo, preparar patch, revalidar e revisar diff. Use quando o usuario pedir para continuar corrigindo uma falha.",
      input_schema: { type: "object", properties: {} },
    },
  );

  tools.push({
    name: "orion_action",
    description:
      "Roteia uma acao interna do Orion respeitando o Autonomy Core. Use esta ferramenta como caminho preferido quando a conversa deve virar acao em modulo interno. Ela executa direto se a politica permitir; caso contrario cria uma decisao pendente; se a politica bloquear, retorna o motivo. Nunca use para acoes externas como enviar email, comprar, pagar ou alterar contas externas.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titulo curto da acao." },
        summary: { type: "string", description: "Resumo do motivo e impacto." },
        proposed_action: { type: "string", description: "Frase clara do que sera executado." },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Prioridade da acao.",
        },
        action_type: {
          type: "string",
          enum: [
            "memory.create",
            "task.create",
            "alert.create",
            "project.create",
            "project.update",
            "social.contact.create",
            "finance.transaction.create",
            "finance.subscription.create",
            "finance.goal.create",
            "shop.wishlist.create",
            "media.item.create",
            "security.finding.create",
            "habit.create",
          ],
          description: "Tipo de acao interna.",
        },
        action_input: {
          type: "object",
          description:
            "Payload da acao. Mesmos formatos de decision_create: tarefa, memoria, alerta, projeto, social, finance, shop, media, security ou habit.",
        },
      },
      required: ["title", "summary", "proposed_action", "action_type", "action_input"],
    },
  });

  tools.push({
    name: "external_action_prepare",
    description:
      "Prepara uma acao externa para aprovacao do usuario na Action Queue. Use antes de enviar Slack, criar Todoist ou criar Linear quando houver qualquer risco, ambiguidade ou quando quiser mostrar preview profissional. Nao executa nada; apenas deixa pronto para EXECUTAR.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titulo curto da decisao." },
        summary: { type: "string", description: "Resumo do motivo/impacto." },
        proposed_action: { type: "string", description: "Frase clara do que sera executado ao aprovar." },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
        },
        action_type: {
          type: "string",
          enum: [
            "slack.post_message",
            "todoist.create_task",
            "linear.create_issue",
            "workspace.write_file",
            "workspace.patch_file",
            "workspace.run_command",
          ],
        },
        action_input: {
          type: "object",
          description:
            "slack.post_message: channelId,text. todoist.create_task: content,description,dueString,priority. linear.create_issue: teamId,title,description. workspace.write_file: path,content,mode(create|replace). workspace.patch_file: path,operations[{search,replace,replaceAll}]. workspace.run_command: command,args,cwd.",
        },
        preview: {
          type: "object",
          description:
            "Resumo visual para o usuario: provider,title,destination,body,risk(low|medium|high).",
        },
      },
      required: ["title", "summary", "proposed_action", "action_type", "action_input"],
    },
  });

  tools.push({
    name: "decision_create",
    description:
      "Cria uma decisao pendente na Decision Inbox para uma acao interna do Orion que precisa de aprovacao do usuario antes de executar. Use quando a conversa deve virar tarefa, memoria, alerta, projeto, contato, registro financeiro, wishlist, midia, achado de seguranca ou habito. Nao use para enviar email, compras reais ou acoes externas.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titulo curto da decisao." },
        summary: { type: "string", description: "Resumo do motivo e impacto." },
        proposed_action: { type: "string", description: "Frase clara do que sera executado ao aprovar." },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Prioridade da decisao.",
        },
        action_type: {
          type: "string",
          enum: [
            "memory.create",
            "task.create",
            "alert.create",
            "project.create",
            "project.update",
            "social.contact.create",
            "finance.transaction.create",
            "finance.subscription.create",
            "finance.goal.create",
            "shop.wishlist.create",
            "media.item.create",
            "security.finding.create",
            "habit.create",
          ],
          description: "Tipo de acao interna a executar depois da aprovacao.",
        },
        action_input: {
          type: "object",
          description:
            "Payload da acao. task.create: title, notes, priority 1-3, energy 1-3, estMinutes. memory.create: type, content, importance, pinned. alert.create: module,title,text,action,priority. project.create: name,color,progress,status. social.contact.create: name,context,nextStep,importance. finance.transaction.create: type,amount,category,merchant,note. finance.subscription.create: name,amount,category,billingDay. finance.goal.create: name,targetAmount,currentAmount,deadline. shop.wishlist.create: name,url,targetPrice,currentPrice,notes. media.item.create: title,kind,status,genres,mood,tasteLayer,rating. security.finding.create: title,detail,action,risk. habit.create: name,frequency,color,icon.",
        },
      },
      required: ["title", "summary", "proposed_action", "action_type", "action_input"],
    },
  });

  tools.push({
    name: "sleep_log",
    description:
      "Registra uma noite de sono no módulo Sleep quando o usuário informar horário de dormir e acordar. Use ISO 8601 com timezone do usuário. Se o usuário disser 'ontem', 'hoje' ou 'amanhã', calcule datas concretas usando a data atual do system prompt. Se faltar qualidade, peça uma nota de 1 a 5 antes de registrar.",
    input_schema: {
      type: "object",
      properties: {
        bed_time: {
          type: "string",
          description: "Horário de dormir em ISO 8601 com timezone, ex: 2026-05-18T23:30:00-03:00.",
        },
        wake_time: {
          type: "string",
          description: "Horário de acordar em ISO 8601 com timezone, depois de bed_time.",
        },
        quality: {
          type: "number",
          description: "Qualidade subjetiva do sono de 1 a 5.",
        },
        notes: {
          type: "string",
          description: "Observação opcional do usuário.",
        },
      },
      required: ["bed_time", "wake_time", "quality"],
    },
  });

  // ── Sprint C: Intelligence tools (sempre disponíveis) ──────────

  tools.push(
    {
      name: "smart_email_draft",
      description:
        "Gera um rascunho de resposta inteligente para um email. Le o email original, analisa o contexto (remetente, historico, projeto) e produz uma resposta personalizada no tom do usuario. O rascunho vai pra Decision Inbox para aprovacao antes de ser criado no Gmail. Use quando o usuario pedir pra responder um email ou quando detectar email importante.",
      input_schema: {
        type: "object",
        properties: {
          message_id: { type: "string", description: "ID do email original (de gmail_list)" },
          instructions: { type: "string", description: "Instrucoes especificas do usuario sobre o tom ou conteudo da resposta" },
        },
        required: ["message_id"],
      },
    },
    {
      name: "calendar_intelligence",
      description:
        "Analisa a agenda do usuario de forma inteligente. Pode: detectar conflitos de horario, preparar briefing para uma reuniao (quem sao os participantes, historico, pauta sugerida), encontrar horarios livres, ou analisar a carga de reunioes da semana. Use quando o usuario perguntar sobre agenda, reunioes ou disponibilidade.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["conflicts", "meeting_prep", "free_slots", "weekly_load"],
            description: "Tipo de analise: conflicts (detectar conflitos), meeting_prep (preparar reuniao), free_slots (horarios livres), weekly_load (carga semanal)",
          },
          event_id: { type: "string", description: "ID do evento (obrigatorio para meeting_prep)" },
          date: { type: "string", description: "Data alvo em ISO 8601 (para free_slots)" },
          duration_minutes: { type: "number", description: "Duracao desejada em minutos (para free_slots, padrao 60)" },
        },
        required: ["action"],
      },
    },
    {
      name: "financial_analysis",
      description:
        "Analisa as financas do usuario de forma inteligente. Pode: categorizar transacoes automaticamente, verificar limites de orcamento por categoria, calcular burn rate mensal com projecao, ou detectar assinaturas duplicadas/nao usadas. Use quando o usuario perguntar sobre gastos, orcamento, ou quando detectar alerta financeiro.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["auto_categorize", "budget_check", "burn_rate", "unused_subscriptions", "category_spend"],
            description: "Tipo de analise financeira",
          },
        },
        required: ["action"],
      },
    },
    {
      name: "habit_analysis",
      description:
        "Analisa habitos do usuario e retorna insights: streaks quebrados, consistencia baixa, sugestoes de ajuste de frequencia, e celebracoes de conquistas. Use quando o usuario perguntar sobre habitos ou quando quiser um checkup geral de rotina.",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "plan_multi_step",
      description:
        "Cria um plano de multiplos passos para uma tarefa complexa. Analisa a intencao, identifica modulos envolvidos, avalia risco, e propoe acoes sequenciais. Cada acao e roteada pelo Autonomy Core — acoes seguras executam direto, acoes de risco vao pra Decision Inbox. Use quando o usuario pedir algo que envolve multiplas acoes coordenadas. Ex: 'le meus emails, resume os importantes e cria tarefas'.",
      input_schema: {
        type: "object",
        properties: {
          intent: { type: "string", description: "Descricao do que o usuario quer realizar" },
          module: { type: "string", description: "Modulo de contexto atual (se houver)" },
        },
        required: ["intent"],
      },
    },
  );

  // ── Sprint D: Social + Content + Travel tools ─────────────────

  tools.push(
    {
      name: "social_nudges",
      description:
        "Analisa contatos do CRM pessoal e retorna sugestoes de reconexao. Detecta contatos importantes que o usuario nao fala ha muito tempo e sugere mensagens contextuais. Use quando o usuario perguntar sobre networking, contatos ou relacionamentos.",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "content_recommend",
      description:
        "Gera recomendacoes personalizadas de filmes, series ou jogos baseadas no perfil do usuario (historico de avaliacoes, generos favoritos, humor atual). Usa dados reais do TMDB e RAWG. Use quando o usuario pedir sugestao de entretenimento.",
      input_schema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["movie", "series", "game"],
            description: "Tipo de conteudo. Omita para receber mix de tudo.",
          },
        },
      },
    },
    {
      name: "music_for_activity",
      description:
        "Sugere musica baseada na atividade atual do usuario. Integra com Spotify se conectado. Use quando o usuario pedir musica pra focar, relaxar, treinar, criar ou dormir.",
      input_schema: {
        type: "object",
        properties: {
          activity: {
            type: "string",
            enum: ["focus", "relax", "workout", "creative", "sleep"],
            description: "Atividade atual",
          },
        },
        required: ["activity"],
      },
    },
    {
      name: "travel_plan",
      description:
        "Gera um roteiro de viagem completo e personalizado com Claude. Inclui dia a dia (manha/tarde/noite), logistica, riscos e proximos passos. Usa preferencias aprendidas e memorias do usuario. Use quando o usuario pedir pra planejar uma viagem.",
      input_schema: {
        type: "object",
        properties: {
          destination: { type: "string", description: "Destino da viagem" },
          days: { type: "number", description: "Numero de dias" },
          budget: { type: "string", description: "Orcamento aproximado (ex: 'R$ 5000', 'economico', 'luxo')" },
          interests: { type: "string", description: "Interesses especificos (ex: 'gastronomia, historia, natureza')" },
        },
        required: ["destination", "days"],
      },
    },
  );

  return tools;
}

// ── EXECUTOR ───────────────────────────────────────────────────────

interface ExecResult {
  ok: boolean;
  result: string;
}

/** Despacha uma tool_use call do Claude pra implementação real. */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ExecResult> {
  try {
    switch (name) {
      case "gmail_list": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const list = await gmailList(ctx.gmailToken, {
          query: typeof input.query === "string" ? input.query : undefined,
          maxResults: typeof input.max === "number" ? input.max : 10,
        });
        if (list.length === 0) return { ok: true, result: "Nenhum email encontrado pra esse filtro." };
        return {
          ok: true,
          result: list
            .map(
              (m, i) =>
                `${i + 1}. [${m.unread ? "NÃO LIDO" : "LIDO"}] ${m.subject}\n` +
                `   De: ${m.from}\n   Em: ${m.date}\n   ID: ${m.id}\n   Snippet: ${m.snippet}`,
            )
            .join("\n\n"),
        };
      }

      case "gmail_read": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const id = typeof input.message_id === "string" ? input.message_id : "";
        if (!id) return { ok: false, result: "message_id obrigatório." };
        const msg = await gmailRead(ctx.gmailToken, id);
        return {
          ok: true,
          result: `Assunto: ${msg.subject}\nDe: ${msg.from}\nData: ${msg.date}\n\n${msg.body}`,
        };
      }

      case "gmail_draft": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const to = typeof input.to === "string" ? input.to : "";
        const subject = typeof input.subject === "string" ? input.subject : "";
        const body = typeof input.body === "string" ? input.body : "";
        if (!to || !subject || !body) {
          return { ok: false, result: "to, subject e body são obrigatórios." };
        }
        const r = await gmailDraft(ctx.gmailToken, { to, subject, body });
        return { ok: true, result: `Rascunho criado (id: ${r.id}). Está na pasta Rascunhos do Gmail.` };
      }

      case "gmail_send": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const to = typeof input.to === "string" ? input.to : "";
        const subject = typeof input.subject === "string" ? input.subject : "";
        const body = typeof input.body === "string" ? input.body : "";
        if (!to || !subject || !body) {
          return { ok: false, result: "to, subject e body são obrigatórios." };
        }
        const r = await gmailSend(ctx.gmailToken, { to, subject, body });
        return { ok: true, result: `Email enviado pra ${to} (id: ${r.id}).` };
      }

      case "gmail_reply": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const threadId = typeof input.thread_id === "string" ? input.thread_id : "";
        const messageId = typeof input.message_id === "string" ? input.message_id : "";
        const to = typeof input.to === "string" ? input.to : "";
        const subject = typeof input.subject === "string" ? input.subject : "";
        const body = typeof input.body === "string" ? input.body : "";
        if (!threadId || !messageId || !to || !subject || !body) {
          return { ok: false, result: "thread_id, message_id, to, subject e body são obrigatórios." };
        }
        const r = await gmailReply(ctx.gmailToken, { threadId, messageId, to, subject, body });
        return { ok: true, result: `Resposta enviada pra ${to} (id: ${r.id}).` };
      }

      case "calendar_list": {
        if (!ctx.gcalToken) return { ok: false, result: "Calendar não conectado." };
        const timeMin = typeof input.time_min === "string" ? input.time_min : "";
        const timeMax = typeof input.time_max === "string" ? input.time_max : "";
        if (!timeMin || !timeMax) return { ok: false, result: "time_min e time_max obrigatórios (ISO 8601)." };
        const events = await calendarList(ctx.gcalToken, {
          timeMin,
          timeMax,
          maxResults: typeof input.max === "number" ? input.max : 20,
        });
        if (events.length === 0) return { ok: true, result: "Nenhum evento nesse período." };
        return {
          ok: true,
          result: events
            .map(
              (e, i) =>
                `${i + 1}. ${e.summary}\n   ${e.start} → ${e.end}` +
                (e.location ? `\n   Local: ${e.location}` : "") +
                (e.meetingUrl ? `\n   Vídeo: ${e.meetingUrl}` : "") +
                (e.attendees.length ? `\n   Com: ${e.attendees.join(", ")}` : ""),
            )
            .join("\n\n"),
        };
      }

      case "calendar_create": {
        if (!ctx.gcalToken) return { ok: false, result: "Calendar não conectado." };
        const summary = typeof input.summary === "string" ? input.summary : "";
        const startISO = typeof input.start_iso === "string" ? input.start_iso : "";
        const endISO = typeof input.end_iso === "string" ? input.end_iso : "";
        if (!summary || !startISO || !endISO) {
          return { ok: false, result: "summary, start_iso e end_iso obrigatórios." };
        }
        // ── Guard contra criação em ano passado ───────────────────
        // Bug recorrente: Claude às vezes infere ano errado quando user fala "amanhã".
        // Aqui rejeitamos com mensagem clara — Claude vê o erro e corrige no próximo turno.
        const startDate = new Date(startISO);
        const now = new Date();
        if (isNaN(startDate.getTime())) {
          return { ok: false, result: `start_iso "${startISO}" inválido — precisa ser ISO 8601.` };
        }
        // Tolerância: se o evento começa mais de 1 dia ATRÁS, é provável erro de ano
        if (startDate.getTime() < now.getTime() - 24 * 3600 * 1000) {
          const currentYear = now.getFullYear();
          return {
            ok: false,
            result: `Data ${startISO} parece estar no passado. O ano atual é ${currentYear}. Confirme com o usuário e recrie usando o ano correto.`,
          };
        }
        const r = await calendarCreate(ctx.gcalToken, {
          summary,
          startISO,
          endISO,
          description: typeof input.description === "string" ? input.description : undefined,
          location: typeof input.location === "string" ? input.location : undefined,
          attendees: Array.isArray(input.attendees)
            ? input.attendees.filter((a): a is string => typeof a === "string")
            : undefined,
        });
        return { ok: true, result: `Evento criado: ${r.htmlLink}` };
      }

      case "drive_search": {
        if (!ctx.gdriveToken) return { ok: false, result: "Drive não conectado." };
        const q = typeof input.query === "string" ? input.query : "";
        if (!q) return { ok: false, result: "query obrigatório." };
        const files = await driveSearch(
          ctx.gdriveToken,
          q,
          typeof input.max === "number" ? input.max : 10,
        );
        if (files.length === 0) return { ok: true, result: "Nenhum arquivo encontrado." };
        return {
          ok: true,
          result: files
            .map(
              (f, i) =>
                `${i + 1}. ${f.name}\n   Tipo: ${f.mimeType}\n   Modificado: ${f.modifiedTime}\n   ID: ${f.id}`,
            )
            .join("\n\n"),
        };
      }

      case "drive_read_doc": {
        if (!ctx.gdriveToken) return { ok: false, result: "Drive não conectado." };
        const id = typeof input.file_id === "string" ? input.file_id : "";
        if (!id) return { ok: false, result: "file_id obrigatório." };
        const text = await driveReadDoc(ctx.gdriveToken, id);
        return { ok: true, result: text || "(documento vazio)" };
      }

      case "trends_movies": {
        if (!env.TMDB_API_KEY) return { ok: false, result: "TMDB não configurada." };
        const kind = input.kind === "upcoming" ? "upcoming" : "trending";
        const win = input.window === "day" ? "day" : "week";
        const movies =
          kind === "upcoming" ? await tmdbUpcomingMovies(10) : await tmdbTrendingMovies(win, 10);
        if (movies.length === 0) return { ok: true, result: "Nenhum filme encontrado." };
        return {
          ok: true,
          result: movies
            .map(
              (m, i) =>
                `${i + 1}. ${m.title}` +
                (m.releaseDate ? ` (${m.releaseDate})` : "") +
                ` — nota ${m.voteAverage.toFixed(1)}\n   ${m.overview.slice(0, 200)}`,
            )
            .join("\n\n"),
        };
      }

      case "trends_series": {
        if (!env.TMDB_API_KEY) return { ok: false, result: "TMDB não configurada." };
        const win = input.window === "day" ? "day" : "week";
        const shows = await tmdbTrendingShows(win, 10);
        if (shows.length === 0) return { ok: true, result: "Nenhuma série encontrada." };
        return {
          ok: true,
          result: shows
            .map(
              (s, i) =>
                `${i + 1}. ${s.name}` +
                (s.firstAirDate ? ` (estreou ${s.firstAirDate})` : "") +
                ` — nota ${s.voteAverage.toFixed(1)}\n   ${s.overview.slice(0, 200)}`,
            )
            .join("\n\n"),
        };
      }

      case "trends_games": {
        if (!env.RAWG_API_KEY) return { ok: false, result: "RAWG não configurada." };
        const kind = input.kind === "upcoming" ? "upcoming" : "trending";
        const games = kind === "upcoming" ? await rawgUpcomingGames(10) : await rawgTrendingGames(10);
        if (games.length === 0) return { ok: true, result: "Nenhum jogo encontrado." };
        return {
          ok: true,
          result: games
            .map(
              (g, i) =>
                `${i + 1}. ${g.name}` +
                (g.released ? ` (${g.released})` : "") +
                ` — nota ${g.rating.toFixed(1)}` +
                (g.metacritic ? `, Metacritic ${g.metacritic}` : "") +
                `\n   Plataformas: ${g.platforms.slice(0, 4).join(", ")}` +
                `\n   Gêneros: ${g.genres.join(", ")}`,
            )
            .join("\n\n"),
        };
      }

      case "game_search": {
        if (!env.RAWG_API_KEY) return { ok: false, result: "RAWG não configurada." };
        const q = typeof input.query === "string" ? input.query : "";
        if (!q) return { ok: false, result: "query obrigatório." };
        const games = await rawgSearchGame(q, 5);
        if (games.length === 0) return { ok: true, result: `Nenhum resultado pra "${q}".` };
        return {
          ok: true,
          result: games
            .map(
              (g, i) =>
                `${i + 1}. ${g.name}` +
                (g.released ? ` (${g.released})` : "") +
                ` — nota ${g.rating.toFixed(1)}\n   Plataformas: ${g.platforms.slice(0, 4).join(", ")}\n   Gêneros: ${g.genres.join(", ")}`,
            )
            .join("\n\n"),
        };
      }

      case "web_search": {
        if (!env.BRAVE_SEARCH_API_KEY) return { ok: false, result: "Brave Search não configurada." };
        const q = typeof input.query === "string" ? input.query : "";
        if (!q) return { ok: false, result: "query obrigatório." };
        const freshness =
          input.freshness === "pd" || input.freshness === "pw" || input.freshness === "pm" || input.freshness === "py"
            ? (input.freshness as "pd" | "pw" | "pm" | "py")
            : undefined;
        const count = typeof input.count === "number" ? input.count : 8;
        const results = await braveSearch(q, { count, freshness });
        if (results.length === 0) return { ok: true, result: `Nenhum resultado pra "${q}".` };
        return {
          ok: true,
          result: results
            .map(
              (r, i) =>
                `${i + 1}. ${r.title}${r.age ? ` (${r.age})` : ""}\n   ${r.url}\n   ${r.description.slice(0, 250)}`,
            )
            .join("\n\n"),
        };
      }

      case "slack_history": {
        const channelId = typeof input.channel_id === "string" ? input.channel_id.trim() : "";
        if (!channelId) return { ok: false, result: "channel_id obrigatorio." };
        const result = await slackHistory({
          channelId,
          limit: typeof input.limit === "number" ? input.limit : 10,
        });
        return { ok: true, result };
      }

      case "slack_post_message": {
        const channelId = typeof input.channel_id === "string" ? input.channel_id.trim() : "";
        const text = typeof input.text === "string" ? input.text.trim() : "";
        if (!channelId || !text) return { ok: false, result: "channel_id e text obrigatorios." };
        const result = await slackPostMessage({ channelId, text });
        return { ok: true, result };
      }

      case "spotify_search": {
        const query = typeof input.query === "string" ? input.query.trim() : "";
        if (!query) return { ok: false, result: "query obrigatorio." };
        const type = input.type === "track" ? "track" : "playlist";
        const result = await spotifySearch({
          query,
          type,
          limit: typeof input.limit === "number" ? input.limit : 8,
        });
        return { ok: true, result };
      }

      case "todoist_list_tasks": {
        const result = await todoistListTasks({
          filter: typeof input.filter === "string" ? input.filter : undefined,
          limit: typeof input.limit === "number" ? input.limit : 12,
        });
        return { ok: true, result };
      }

      case "todoist_create_task": {
        const content = typeof input.content === "string" ? input.content.trim() : "";
        if (!content) return { ok: false, result: "content obrigatorio." };
        const result = await todoistCreateTask({
          content,
          description: typeof input.description === "string" ? input.description : undefined,
          dueString: typeof input.due_string === "string" ? input.due_string : undefined,
          priority: typeof input.priority === "number" ? input.priority : undefined,
        });
        return { ok: true, result };
      }

      case "linear_list_teams": {
        const result = await linearListTeams();
        return { ok: true, result };
      }

      case "linear_list_issues": {
        const result = await linearListIssues({
          query: typeof input.query === "string" ? input.query : undefined,
          limit: typeof input.limit === "number" ? input.limit : 10,
        });
        return { ok: true, result };
      }

      case "linear_create_issue": {
        const teamId = typeof input.team_id === "string" ? input.team_id.trim() : "";
        const title = typeof input.title === "string" ? input.title.trim() : "";
        if (!teamId || !title) return { ok: false, result: "team_id e title obrigatorios." };
        const result = await linearCreateIssue({
          teamId,
          title,
          description: typeof input.description === "string" ? input.description : undefined,
        });
        return { ok: true, result };
      }


      case "github_list_repos": {
        const { repos } = await githubListRepos(ctx.userId);
        if (!repos.length) return { ok: true, result: "Nenhum repositorio encontrado." };
        const lines = repos.map((r) => `${r.full_name} | ${r.language ?? "?"} | ${r.open_issues_count} issues | ${r.stargazers_count}★ | ${r.description?.slice(0, 60) ?? ""}`).join("\n");
        return { ok: true, result: `Repositorios (${repos.length}):\n${lines}` };
      }

      case "github_list_issues": {
        const repo = input.repo as string;
        const state = (input.state as "open" | "closed" | "all") ?? "open";
        const { issues } = await githubListIssues(ctx.userId, repo, state);
        if (!issues.length) return { ok: true, result: `Nenhuma issue ${state} em ${repo}.` };
        const lines = issues.map((i) => `#${i.number} ${i.title} [${i.state}] | ${i.labels.map((l) => l.name).join(", ")} | ${i.comments} comentarios`).join("\n");
        return { ok: true, result: `Issues de ${repo} (${issues.length}):\n${lines}` };
      }

      case "github_list_prs": {
        const repo = input.repo as string;
        const state = (input.state as "open" | "closed" | "all") ?? "open";
        const { prs } = await githubListPRs(ctx.userId, repo, state);
        if (!prs.length) return { ok: true, result: `Nenhum PR ${state} em ${repo}.` };
        const lines = prs.map((p) => `#${p.number} ${p.title} [${p.draft ? "DRAFT" : p.state}] | ${p.head.ref} → ${p.base.ref} | ${p.requested_reviewers.map((r) => r.login).join(", ") || "sem reviewers"}`).join("\n");
        return { ok: true, result: `PRs de ${repo} (${prs.length}):\n${lines}` };
      }

      case "github_repo_summary": {
        const repo = input.repo as string;
        const summary = await githubRepoSummary(ctx.userId, repo);
        return { ok: true, result: `${repo}\nIssues abertas: ${summary.openIssues}\nPRs abertos: ${summary.openPRs}\nUltimo build: ${summary.lastBuildStatus ?? "sem CI"} (${summary.lastBuild ? new Date(summary.lastBuild).toLocaleString("pt-BR") : "?"})\nURL: ${summary.url}` };
      }

      case "github_notifications": {
        const notifications = await githubListNotifications(ctx.userId);
        if (!notifications.length) return { ok: true, result: "Nenhuma notificacao nao lida no GitHub." };
        const lines = notifications.map((n) => `[${n.type}] ${n.title} | ${n.repo} | ${n.reason}`).join("\n");
        return { ok: true, result: `Notificacoes GitHub (${notifications.length}):\n${lines}` };
      }

      case "github_create_issue": {
        const repo = input.repo as string;
        const title = input.title as string;
        const body = input.body as string;
        const labels = (input.labels as string[]) ?? [];
        const result = await githubCreateIssue(ctx.userId, repo, title, body, labels);
        return { ok: true, result: `Issue criada: #${result.number}\nURL: ${result.html_url}` };
      }

      case "outlook_list_emails": {
        const { emails } = await outlookListEmails(ctx.userId, {
          folder: (input.folder as "inbox" | "sent" | "drafts") ?? "inbox",
          top: (input.top as number) ?? 20,
          unreadOnly: (input.unread_only as boolean) ?? false,
        });
        if (!emails.length) return { ok: true, result: "Nenhum email encontrado." };
        const lines = emails.map((e) => `[${e.isRead ? "lido" : "NOVO"}][${e.importance}] ${e.from.emailAddress.name}: ${e.subject} | ${new Date(e.receivedDateTime).toLocaleString("pt-BR")}`).join("\n");
        return { ok: true, result: `Emails Outlook (${emails.length}):\n${lines}` };
      }

      case "outlook_get_email": {
        const email = await outlookGetEmail(ctx.userId, input.message_id as string);
        if (!email) return { ok: false, result: "Email nao encontrado." };
        return { ok: true, result: `De: ${email.from}\nAssunto: ${email.subject}\nRecebido: ${new Date(email.receivedAt).toLocaleString("pt-BR")}\n\n${email.body}` };
      }

      case "outlook_send_email": {
        await outlookSendEmail(ctx.userId, {
          to: input.to as string,
          subject: input.subject as string,
          body: input.body as string,
          cc: input.cc as string | undefined,
        });
        return { ok: true, result: `Email enviado para ${input.to}.` };
      }

      case "outlook_list_events": {
        const { events } = await outlookListEvents(ctx.userId, (input.days as number) ?? 7);
        if (!events.length) return { ok: true, result: "Nenhum evento encontrado." };
        const lines = events.map((e) => `${e.subject} | ${new Date(e.start.dateTime).toLocaleString("pt-BR")} → ${new Date(e.end.dateTime).toLocaleString("pt-BR")} | ${e.location.displayName || "sem local"}`).join("\n");
        return { ok: true, result: `Eventos Outlook (${events.length}):\n${lines}` };
      }

      case "teams_list_teams": {
        const teams = await teamsListTeams(ctx.userId);
        if (!teams.length) return { ok: true, result: "Nenhum time encontrado no Teams." };
        const lines = teams.map((t) => `${t.id} | ${t.displayName} | ${t.description?.slice(0, 60) ?? ""}`).join("\n");
        return { ok: true, result: `Times do Teams (${teams.length}):\n${lines}` };
      }

      case "teams_list_messages": {
        const { messages } = await teamsListMessages(ctx.userId, input.team_id as string, input.channel_id as string);
        if (!messages.length) return { ok: true, result: "Nenhuma mensagem encontrada." };
        const lines = messages.map((m) => `[${new Date(m.createdAt).toLocaleString("pt-BR")}] ${m.from}: ${m.content}`).join("\n");
        return { ok: true, result: `Mensagens Teams:\n${lines}` };
      }

      case "teams_send_message": {
        await teamsSendMessage(ctx.userId, input.team_id as string, input.channel_id as string, input.content as string);
        return { ok: true, result: "Mensagem enviada no Teams." };
      }

      case "onedrive_recent": {
        const files = await onedriveListRecent(ctx.userId);
        if (!files.length) return { ok: true, result: "Nenhum arquivo recente no OneDrive." };
        const lines = files.map((f) => `${f.name} | ${f.mimeType ?? "?"} | ${new Date(f.lastModified).toLocaleString("pt-BR")} | ${f.webUrl}`).join("\n");
        return { ok: true, result: `Arquivos recentes OneDrive (${files.length}):\n${lines}` };
      }

      case "workspace_scan": {
        const summary = await getWorkspaceSummary();
        const topExt = Object.entries(summary.counts.byExt)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ext, count]) => `${ext}: ${count}`)
          .join(", ");
        const files = summary.files
          .slice(0, 80)
          .map((file, index) => `${index + 1}. ${file.path} (${Math.round(file.size / 1024)} KB)`)
          .join("\n");
        return {
          ok: true,
          result: `Workspace: ${summary.root}\nArquivos indexados: ${summary.counts.total}\nExtensoes: ${topExt}\n\nArquivos principais:\n${files}`,
        };
      }

      case "workspace_context_map": {
        const map = await getCodeContextMap();
        const section = (title: string, entries: Array<{ path: string; name: string }>, max = 16) =>
          `${title} (${entries.length})\n${entries.slice(0, max).map((entry) => `- ${entry.name}: ${entry.path}`).join("\n") || "- nenhum"}`;
        return {
          ok: true,
          result: [
            `Gerado em: ${map.generatedAt}`,
            `Totais: ${map.totals.files} arquivos | ${map.totals.apiRoutes} rotas API | ${map.totals.apiServices} services | ${map.totals.webPages} paginas | ${map.totals.webHooks} hooks | ${map.totals.sharedTypes} tipos`,
            "",
            section("API routes", map.api.routes),
            "",
            section("API services", map.api.services),
            "",
            section("AI core", map.api.ai),
            "",
            section("Web module pages", map.web.modulePages),
            "",
            section("Web hooks", map.web.hooks),
            "",
            section("Shared types", map.shared.types),
            "",
            "Recomendacoes:",
            map.recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n"),
          ].join("\n"),
        };
      }

      case "workspace_read_file": {
        const filePath = typeof input.path === "string" ? input.path.trim() : "";
        if (!filePath) return { ok: false, result: "path obrigatorio." };
        const file = await readWorkspaceFile(filePath);
        return {
          ok: true,
          result: `Arquivo: ${file.path}${file.truncated ? " (truncado)" : ""}\n\n${file.content}`,
        };
      }

      case "workspace_prepare_file": {
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const summary = typeof input.summary === "string" ? input.summary.trim() : "";
        const filePath = typeof input.path === "string" ? input.path.trim() : "";
        const content = typeof input.content === "string" ? input.content : "";
        const mode = input.mode === "create" ? "create" : "replace";
        if (!title || !summary || !filePath) return { ok: false, result: "title, summary e path obrigatorios." };
        const proposal = await prepareWorkspacePatch(ctx.userId, {
          title,
          summary,
          path: filePath,
          content,
          mode,
        });
        return {
          ok: true,
          result: `Proposta enviada para Action Queue (id: ${proposal.decisionId}). Arquivo: ${proposal.path}. Modo: ${proposal.mode}. Nada foi escrito ainda.\n\nPreview:\n${proposal.preview.slice(0, 3000)}`,
        };
      }

      case "workspace_prepare_patch": {
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const summary = typeof input.summary === "string" ? input.summary.trim() : "";
        const filePath = typeof input.path === "string" ? input.path.trim() : "";
        const rawOperations = Array.isArray(input.operations) ? input.operations : [];
        const operations = rawOperations
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
          .map((item) => ({
            search: typeof item.search === "string" ? item.search : "",
            replace: typeof item.replace === "string" ? item.replace : "",
            replaceAll: item.replaceAll === true,
          }))
          .filter((item) => item.search.length > 0);
        if (!title || !summary || !filePath || operations.length === 0) {
          return { ok: false, result: "title, summary, path e operations validas sao obrigatorios." };
        }
        const proposal = await prepareWorkspacePatch(ctx.userId, {
          title,
          summary,
          path: filePath,
          mode: "patch",
          operations,
        });
        return {
          ok: true,
          result: `Patch preparado na Action Queue (id: ${proposal.decisionId}). Arquivo: ${proposal.path}. Nada foi escrito ainda.\n\nDiff:\n${proposal.preview.slice(0, 3000)}`,
        };
      }

      case "workspace_prepare_command": {
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const summary = typeof input.summary === "string" ? input.summary.trim() : "";
        const command = input.command === "npm" || input.command === "git" ? input.command : null;
        const args = Array.isArray(input.args)
          ? input.args.filter((arg): arg is string => typeof arg === "string" && arg.length > 0)
          : [];
        const cwd = typeof input.cwd === "string" ? input.cwd : undefined;
        if (!title || !summary || !command || args.length === 0) {
          return { ok: false, result: "title, summary, command e args validos sao obrigatorios." };
        }
        const proposal = await prepareWorkspaceCommand(ctx.userId, { title, summary, command, args, cwd });
        return {
          ok: true,
          result: `Comando preparado na Action Queue (id: ${proposal.decisionId}). CWD: ${proposal.cwd}. Nada foi executado ainda.\n$ ${proposal.commandLine}`,
        };
      }

      case "workspace_recent_executions": {
        const limit = typeof input.limit === "number" ? Math.min(Math.max(Math.round(input.limit), 1), 10) : 5;
        const executed = await listDecisions(ctx.userId, "executed");
        if (executed.length === 0) return { ok: true, result: "Nenhuma execucao recente registrada." };
        return {
          ok: true,
          result: executed
            .slice(0, limit)
            .map((decision, index) => {
              const execution =
                decision.payload.execution && typeof decision.payload.execution === "object" && !Array.isArray(decision.payload.execution)
                  ? (decision.payload.execution as Record<string, unknown>)
                  : null;
              const label = typeof execution?.label === "string" ? execution.label : decision.title;
              const summary = typeof execution?.summary === "string" ? execution.summary : decision.proposedAction;
              return `${index + 1}. ${label}\n   Quando: ${decision.updatedAt}\n   Acao: ${decision.proposedAction}\n   Resultado: ${summary.slice(0, 2000)}`;
            })
            .join("\n\n"),
        };
      }

      case "workspace_diagnose_last_execution": {
        const diagnosis = await diagnoseWorkspaceExecution(ctx.userId);
        if (!diagnosis.hasExecution) {
          return { ok: true, result: diagnosis.suggestedNextSteps.join("\n") };
        }
        const files = diagnosis.files.length
          ? diagnosis.files
              .map(
                (file, index) =>
                  `${index + 1}. ${file.path}${file.line ? `:${file.line}` : ""}${file.column ? `:${file.column}` : ""}${file.code ? ` ${file.code}` : ""}\n   ${file.message}`,
              )
              .join("\n")
          : "Nenhum arquivo especifico identificado.";
        return {
          ok: true,
          result: [
            `Execucao: ${diagnosis.label}`,
            `Exit: ${diagnosis.exitCode ?? "desconhecido"}`,
            `Erro principal: ${diagnosis.primaryError ?? "nao identificado"}`,
            "",
            "Arquivos provaveis:",
            files,
            "",
            "Proximos passos:",
            diagnosis.suggestedNextSteps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
            "",
            "Resumo bruto:",
            diagnosis.rawSummary.slice(0, 2500),
          ].join("\n"),
        };
      }

      case "workspace_debug_runbook": {
        const runbook = await buildDebugRunbook(ctx.userId);
        return {
          ok: true,
          result: [
            `Runbook: ${runbook.title}`,
            `Status: ${runbook.status}`,
            `Erro: ${runbook.diagnosis.primaryError ?? "nenhum"}`,
            "",
            "Passos:",
            runbook.steps
              .map((step, index) => {
                const command = step.command ? `\n   Comando sugerido: ${step.command.command} ${step.command.args.join(" ")}` : "";
                const target = step.target ? `\n   Alvo: ${step.target}` : "";
                return `${index + 1}. [${step.kind}] ${step.label}\n   ${step.detail}${target}${command}`;
              })
              .join("\n"),
          ].join("\n"),
        };
      }

      case "sleep_log": {
        const bedTime = typeof input.bed_time === "string" ? input.bed_time : "";
        const wakeTime = typeof input.wake_time === "string" ? input.wake_time : "";
        const quality = typeof input.quality === "number" ? input.quality : 0;
        const notes = typeof input.notes === "string" ? input.notes : undefined;
        if (!bedTime || !wakeTime) return { ok: false, result: "bed_time e wake_time obrigatorios." };
        if (quality < 1 || quality > 5) return { ok: false, result: "quality deve ser 1 a 5." };
        await logSleep({ userId: ctx.userId, bedTime, wakeTime, quality, notes });
        return { ok: true, result: `Sono registrado: ${bedTime} -> ${wakeTime}, qualidade ${quality}/5.` };
      }

      case "orion_action": {
        const title = typeof input.title === "string" ? input.title : "";
        const summary = typeof input.summary === "string" ? input.summary : "";
        const proposedAction = typeof input.proposed_action === "string" ? input.proposed_action : "";
        const priority = typeof input.priority === "string" ? input.priority as "low" | "medium" | "high" | "critical" : "medium";
        const actionType = typeof input.action_type === "string" ? input.action_type as InternalActionType : "task.create" as InternalActionType;
        const actionInput = typeof input.action_input === "object" && input.action_input ? input.action_input as Record<string, unknown> : {};

        if (!title || !summary || !proposedAction) {
          return { ok: false, result: "title, summary e proposed_action obrigatorios." };
        }

        const routed = await routeInternalAction(ctx.userId, {
          title,
          summary,
          proposedAction,
          priority,
          actionType,
          actionInput,
        });

        if (routed.status === "executed") {
          return {
            ok: true,
            result: `Executado pelo Autonomy Core no modulo ${routed.moduleId}: ${routed.execution?.summary ?? "ok"}`,
          };
        }
        if (routed.status === "decision") {
          return {
            ok: true,
            result: `Decisao criada na Decision Inbox (id: ${routed.decisionId}). Ao aprovar, o Orion executa: ${proposedAction}`,
          };
        }

        return { ok: false, result: `Roteamento retornou status inesperado: ${routed.status}` };
      }

      case "analyze_uploaded_file": {
        return { ok: true, result: "Analise de arquivo deve ser feita via endpoint /chat/analyze-file. Peca ao usuario para enviar o arquivo pela interface." };
      }

      case "memory_search": {
        const query = typeof input.query === "string" ? input.query : "";
        const limit = typeof input.limit === "number" ? input.limit : 8;
        if (!query) return { ok: false, result: "query obrigatorio." };
        const memories = await searchRelevantMemories(ctx.userId, query, limit);
        if (!memories.length) return { ok: true, result: "Nenhuma memoria encontrada sobre esse tema." };
        const formatted = memories.map((m, i) => {
          const date = new Date(m.createdAt).toLocaleDateString("pt-BR");
          return `${i + 1}. [${m.type}] ${m.content} (importancia: ${m.importance.toFixed(2)}, ${date})`;
        }).join("\n");
        return { ok: true, result: `Memorias encontradas (${memories.length}):\n${formatted}` };
      }

      // ── Sprint C: Intelligence executors ─────────────────────────

      case "smart_email_draft": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail nao conectado." };
        const messageId = typeof input.message_id === "string" ? input.message_id : "";
        if (!messageId) return { ok: false, result: "message_id obrigatorio." };
        const instructions = typeof input.instructions === "string" ? input.instructions : undefined;
        const draft = await generateEmailDraft({
          userId: ctx.userId,
          accessToken: ctx.gmailToken,
          emailId: messageId,
          instructions,
        });
        if (!draft) return { ok: false, result: "Nao consegui gerar o rascunho. Tente novamente." };

        await createDecision(ctx.userId, {
          source: "comms",
          title: `Responder: ${draft.suggestedSubject}`,
          summary: `Para: ${draft.originalFrom}\n\n${draft.draftBody.slice(0, 300)}...`,
          proposedAction: `Criar rascunho no Gmail para ${draft.originalFrom}`,
          priority: "medium",
          payload: { to: draft.originalFrom, subject: draft.suggestedSubject, body: draft.draftBody, type: "email.draft" },
        });

        return {
          ok: true,
          result: `Rascunho gerado (confianca: ${draft.confidence}):\nPara: ${draft.originalFrom}\nAssunto: ${draft.suggestedSubject}\n\n${draft.draftBody}\n\n-> Enviado para Decision Inbox para aprovacao.`,
        };
      }

      case "calendar_intelligence": {
        if (!ctx.gmailToken) return { ok: false, result: "Google Calendar nao conectado." };
        const calAction = typeof input.action === "string" ? input.action : "";

        switch (calAction) {
          case "conflicts": {
            const conflicts = await detectConflicts(ctx.gmailToken);
            if (!conflicts.hasConflicts) return { ok: true, result: "Nenhum conflito de horario detectado na agenda." };
            const lines = conflicts.conflicts.map((c) => `- ${c.event1} X ${c.event2} (${c.overlapMinutes}min de sobreposicao)`);
            return { ok: true, result: `${conflicts.conflicts.length} conflito(s) detectado(s):\n${lines.join("\n")}` };
          }
          case "meeting_prep": {
            const eventId = typeof input.event_id === "string" ? input.event_id : "";
            if (!eventId) return { ok: false, result: "event_id obrigatorio para meeting_prep." };
            const prep = await prepareMeetingBrief(ctx.userId, ctx.gmailToken, eventId);
            if (!prep) return { ok: false, result: "Nao encontrei o evento." };
            return {
              ok: true,
              result: `BRIEFING: ${prep.eventTitle}\nParticipantes: ${prep.attendees.join(", ")}\n\nContexto: ${prep.context}\nPauta sugerida: ${prep.suggestedAgenda}\nHistorico relevante: ${prep.relevantHistory}`,
            };
          }
          case "free_slots": {
            const duration = typeof input.duration_minutes === "number" ? input.duration_minutes : 60;
            const slots = await findFreeSlots(ctx.gmailToken, 3, duration);
            if (!slots.length) return { ok: true, result: `Sem horarios livres de ${duration}min nos proximos 3 dias.` };
            const lines = slots.map((s: { start: string; end: string }) => `- ${s.start} ate ${s.end}`);
            return { ok: true, result: `Horarios livres (${duration}min):\n${lines.join("\n")}` };
          }
          case "weekly_load": {
            const load = await analyzeWeeklyLoad(ctx.gmailToken);
            return {
              ok: true,
              result: `Carga semanal: ${load.totalMeetings} reunioes, ${Math.round(load.totalMinutes / 60)}h.\nDia mais cheio: ${load.busiestDay} (media ${load.averagePerDay.toFixed(1)} reunioes/dia).\n${load.recommendation}`,
            };
          }
          default:
            return { ok: false, result: `Acao desconhecida: ${calAction}. Use: conflicts, meeting_prep, free_slots, weekly_load.` };
        }
      }

      case "financial_analysis": {
        const finAction = typeof input.action === "string" ? input.action : "";

        switch (finAction) {
          case "auto_categorize": {
            const result = await autoCategorize(ctx.userId);
            return { ok: true, result: `${result.categorized} transacao(es) categorizada(s) automaticamente.` };
          }
          case "category_spend": {
            const spend = await getMonthlyCategorySpend(ctx.userId);
            if (!spend.length) return { ok: true, result: "Sem transacoes este mes." };
            const lines = spend.map((s) => `- ${s.category}: R$ ${s.spent.toFixed(2)} (${s.count} transacoes)`);
            return { ok: true, result: `Gastos por categoria este mes:\n${lines.join("\n")}` };
          }
          case "budget_check": {
            const alerts = await checkBudgetLimits(ctx.userId);
            const active = alerts.filter((a) => a.alert !== "ok");
            if (!active.length) return { ok: true, result: "Todas as categorias dentro do orcamento." };
            const lines = active.map((a) => `- [${a.alert.toUpperCase()}] ${a.category}: R$ ${a.spent.toFixed(2)} / R$ ${a.limit.toFixed(2)} (${a.percentUsed}%)`);
            return { ok: true, result: `Alertas de orcamento:\n${lines.join("\n")}` };
          }
          case "burn_rate": {
            const br = await calculateBurnRate(ctx.userId);
            return {
              ok: true,
              result: `Burn rate: R$ ${br.dailyAverage.toFixed(2)}/dia\nGasto ate agora: R$ ${br.totalSpentThisMonth.toFixed(2)}\nProjecao fim do mes: R$ ${br.projectedMonthTotal.toFixed(2)}\nDias restantes: ${br.daysRemaining}\nTendencia: ${br.trend}`,
            };
          }
          case "unused_subscriptions": {
            const unused = await detectUnusedSubscriptions(ctx.userId);
            if (!unused.length) return { ok: true, result: "Nenhuma assinatura suspeita encontrada." };
            const lines = unused.map((u) => `- ${u.name}: R$ ${u.amount.toFixed(2)}/mes — ${u.lastUsedHint}`);
            return { ok: true, result: `Assinaturas suspeitas:\n${lines.join("\n")}` };
          }
          default:
            return { ok: false, result: `Acao desconhecida: ${finAction}. Use: auto_categorize, budget_check, burn_rate, unused_subscriptions, category_spend.` };
        }
      }

      case "habit_analysis": {
        const insights = await analyzeHabits(ctx.userId);
        if (!insights.length) return { ok: true, result: "Todos os habitos estao em dia. Nenhum alerta." };
        const lines = insights.map((i) => `[${i.type}] ${i.habitName}: ${i.message}`);
        return { ok: true, result: `Analise de habitos (${insights.length} insight(s)):\n${lines.join("\n")}` };
      }

      case "plan_multi_step": {
        const intent = typeof input.intent === "string" ? input.intent : "";
        if (!intent) return { ok: false, result: "intent obrigatorio." };
        const module = typeof input.module === "string" ? input.module : undefined;
        const plan = buildAgentPlan(intent, module);

        if (!plan.actions.length) {
          return { ok: true, result: `Plano para "${intent}": nenhuma acao concreta identificada. Reformule com mais detalhes.` };
        }

        const results: string[] = [`PLANO: ${plan.intent}`, `Modulos: ${plan.targetModules.join(", ")}`, `Risco: ${plan.risk} | Confianca: ${(plan.confidence * 100).toFixed(0)}%`, `Razao: ${plan.rationale}`, ""];

        for (const action of plan.actions) {
          const routed = await routeInternalAction(ctx.userId, {
            title: action.title,
            summary: action.summary,
            proposedAction: action.proposedAction,
            priority: action.priority,
            actionType: action.actionType,
            actionInput: action.actionInput,
          });
          if (routed.status === "executed") {
            results.push(`[OK] ${action.title} — executado`);
          } else if (routed.status === "decision") {
            results.push(`[?] ${action.title} — aguardando aprovacao (Decision Inbox)`);
          } else {
            results.push(`[X] ${action.title} — ${routed.status}`);
          }
        }

        return { ok: true, result: results.join("\n") };
      }


      case "social_nudges": {
        const nudges = await getNudges(ctx.userId);
        if (!nudges.length) return { ok: true, result: "Todos os contatos importantes estao em dia. Nenhum nudge pendente." };
        const lines = nudges.map((n) => `- ${n.name}: ${n.reason}\n  Sugestao: ${n.messageDraft}`);
        return { ok: true, result: `Contatos para reconectar (${nudges.length}):\n${lines.join("\n")}` };
      }

      case "content_recommend": {
        const type = typeof input.type === "string" ? input.type as "movie" | "series" | "game" : undefined;
        const recs = await getPersonalizedRecommendations(ctx.userId, type);
        if (!recs.length) return { ok: true, result: "Sem recomendacoes no momento. Avalie mais conteudos pra melhorar as sugestoes." };
        const lines = recs.map((r) => `- [${r.type}] ${r.title} (${r.reason}) — fit: ${r.score}%`);
        return { ok: true, result: `Recomendacoes personalizadas:\n${lines.join("\n")}` };
      }

      case "music_for_activity": {
        const activity = typeof input.activity === "string" ? input.activity as "focus" | "relax" | "workout" | "creative" | "sleep" : "focus";
        const result = await suggestMusic(ctx.userId, activity);
        return {
          ok: true,
          result: `Musica para ${activity}:\n${result.reason}\n\nPlaylists: ${result.query}`,
        };
      }

      case "travel_plan": {
        const destination = typeof input.destination === "string" ? input.destination : "";
        const days = typeof input.days === "number" ? input.days : 3;
        if (!destination) return { ok: false, result: "destination obrigatorio." };
        const budgetStr = typeof input.budget === "string" ? input.budget.toLowerCase() : "medio";
        const budgetMap: Record<string, "baixo" | "medio" | "alto"> = { economico: "baixo", baixo: "baixo", medio: "medio", luxo: "alto", alto: "alto" };
        const plan = await planTrip(ctx.userId, {
          destination,
          days,
          budget: budgetMap[budgetStr] ?? "medio",
          pace: "equilibrado",
          interests: typeof input.interests === "string" ? input.interests.split(",").map((s) => s.trim()) : ["geral"],
        });
        const dayLines = plan.days.map((d) => `DIA ${d.day}: ${d.title}\n  Manha: ${d.morning}\n  Tarde: ${d.afternoon}\n  Noite: ${d.night}\n  Logistica: ${d.logistics}`);
        return {
          ok: true,
          result: `ROTEIRO: ${plan.destination}\n${plan.summary}\n\nPremissas: ${plan.assumptions.join("; ")}\n\n${dayLines.join("\n\n")}\n\nRiscos: ${plan.risks.join("; ")}\nProximos passos: ${plan.nextActions.join("; ")}`,
        };
      }

      default:
        return { ok: false, result: `Ferramenta desconhecida: ${name}` };
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[executeTool] ${name} falhou:`, reason);
    return { ok: false, result: `Erro ao executar ${name}: ${reason}` };
  }
}
