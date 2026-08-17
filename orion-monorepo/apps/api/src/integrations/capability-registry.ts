import type { CapabilityConnector } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

type ProviderStatus = CapabilityConnector["status"];

const CONNECTORS: Array<Omit<CapabilityConnector, "status"> & { configured: () => boolean }> = [
  {
    provider: "gmail",
    label: "Gmail",
    category: "workspace",
    setupKind: "oauth",
    docsUrl: "https://developers.google.com/gmail/api",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    scopes: ["gmail.readonly", "gmail.compose", "gmail.modify"],
    configured: () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    actions: [
      { id: "gmail.search", label: "Buscar emails", kind: "read", requiresDecision: false },
      { id: "gmail.draft", label: "Criar rascunho", kind: "write", requiresDecision: true },
      { id: "gmail.send", label: "Enviar email", kind: "execute", requiresDecision: true },
    ],
    examples: ["resume meus emails urgentes", "rascunha uma resposta para esse email"],
    notes: "Conectado pelo OAuth Google unificado.",
  },
  {
    provider: "gcal",
    label: "Google Calendar",
    category: "workspace",
    setupKind: "oauth",
    docsUrl: "https://developers.google.com/calendar/api",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    scopes: ["calendar.readonly", "calendar.events"],
    configured: () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    actions: [
      { id: "calendar.list", label: "Ler agenda", kind: "read", requiresDecision: false },
      { id: "calendar.create", label: "Criar evento", kind: "write", requiresDecision: true },
    ],
    examples: ["o que tenho hoje?", "cria um bloco de foco amanha"],
    notes: "Usado por Agenda, Morning Brief e alertas proativos.",
  },
  {
    provider: "gdrive",
    label: "Google Drive",
    category: "workspace",
    setupKind: "oauth",
    docsUrl: "https://developers.google.com/drive/api",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    scopes: ["drive.readonly"],
    configured: () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    actions: [{ id: "drive.read", label: "Ler documentos", kind: "read", requiresDecision: false }],
    examples: ["analisa esse contrato do Drive", "procura meu documento de planejamento"],
    notes: "Leitura primeiro; escrita em Drive deve passar pela Decision Inbox.",
  },
  {
    provider: "github",
    label: "GitHub",
    category: "developer",
    setupKind: "api_key",
    docsUrl: "https://docs.github.com/en/rest",
    envVars: ["GITHUB_TOKEN"],
    scopes: ["repo:read", "issues:write opcional"],
    configured: () => Boolean(env.GITHUB_TOKEN),
    actions: [
      { id: "github.status", label: "Ler repos/issues/PRs", kind: "read", requiresDecision: false },
      { id: "github.issue.create", label: "Criar issue", kind: "write", requiresDecision: true },
    ],
    examples: ["resume meus PRs abertos", "cria uma issue para esse bug"],
    notes: "Preferir fine-grained token com acesso apenas aos repositÃ³rios necessÃ¡rios.",
  },
  {
    provider: "notion",
    label: "Notion",
    category: "productivity",
    setupKind: "oauth",
    docsUrl: "https://developers.notion.com/guides/get-started/authorization",
    envVars: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"],
    scopes: ["read_content", "insert_content", "update_content"],
    configured: () => Boolean((env.NOTION_CLIENT_ID && env.NOTION_CLIENT_SECRET) || env.NOTION_TOKEN),
    actions: [
      { id: "notion.search", label: "Buscar pÃ¡ginas", kind: "read", requiresDecision: false },
      { id: "notion.page.create", label: "Criar pÃ¡gina", kind: "write", requiresDecision: true },
    ],
    examples: ["salva isso no meu Notion", "cria uma pagina com o plano da semana"],
    notes: "OAuth multiusuario para SaaS; NOTION_TOKEN continua aceito como modo local de desenvolvimento.",
  },
  {
    provider: "slack",
    label: "Slack",
    category: "workspace",
    setupKind: "oauth",
    docsUrl: "https://docs.slack.dev/apis/web-api",
    envVars: ["SLACK_BOT_TOKEN"],
    scopes: ["channels:history", "chat:write", "users:read"],
    configured: () => Boolean(env.SLACK_BOT_TOKEN),
    actions: [
      { id: "slack.summary", label: "Resumir canais", kind: "read", requiresDecision: false },
      { id: "slack.message", label: "Enviar mensagem", kind: "execute", requiresDecision: true },
    ],
    examples: ["resume o que perdi no Slack", "prepara uma resposta para essa thread"],
    notes: "Envio sempre passa pela Decision Inbox.",
  },
  {
    provider: "openweather",
    label: "OpenWeather",
    category: "life",
    setupKind: "api_key",
    docsUrl: "https://openweathermap.org/api",
    envVars: ["OPENWEATHER_API_KEY"],
    scopes: ["weather.read"],
    configured: () => Boolean(env.OPENWEATHER_API_KEY),
    actions: [{ id: "weather.forecast", label: "Consultar clima", kind: "read", requiresDecision: false }],
    examples: ["ajusta meu dia considerando o clima", "vou sair as 18h, preciso levar algo?"],
    notes: "Baixo risco e alto valor para Agenda, Travel e rotinas.",
  },
  {
    provider: "spotify",
    label: "Spotify",
    category: "media",
    setupKind: "oauth",
    docsUrl: "https://developer.spotify.com/documentation/web-api",
    envVars: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
    scopes: ["user-read-playback-state", "user-modify-playback-state", "playlist-modify-private"],
    configured: () => Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
    actions: [
      { id: "spotify.recommend", label: "Recomendar playlists", kind: "read", requiresDecision: false },
      { id: "spotify.play", label: "Controlar playback", kind: "execute", requiresDecision: true },
    ],
    examples: ["modo foco com musica", "cria uma rotina de desaceleracao"],
    notes: "Playback em dispositivo do usuÃ¡rio exige confirmaÃ§Ã£o.",
  },
  {
    provider: "todoist",
    label: "Todoist",
    category: "productivity",
    setupKind: "api_key",
    docsUrl: "https://developer.todoist.com/rest/v2/",
    envVars: ["TODOIST_API_TOKEN"],
    scopes: ["tasks:read", "tasks:write"],
    configured: () => Boolean(env.TODOIST_API_TOKEN),
    actions: [
      { id: "todoist.list", label: "Ler tarefas", kind: "read", requiresDecision: false },
      { id: "todoist.create", label: "Criar tarefa", kind: "write", requiresDecision: true },
    ],
    examples: ["transforma isso em tarefa no Todoist"],
    notes: "Precisa deduplicar com Life OS.",
  },
  {
    provider: "linear",
    label: "Linear",
    category: "developer",
    setupKind: "api_key",
    docsUrl: "https://developers.linear.app/docs/graphql/working-with-the-graphql-api",
    envVars: ["LINEAR_API_KEY"],
    scopes: ["issues:read", "issues:write"],
    configured: () => Boolean(env.LINEAR_API_KEY),
    actions: [
      { id: "linear.list", label: "Ler issues", kind: "read", requiresDecision: false },
      { id: "linear.create", label: "Criar issue", kind: "write", requiresDecision: true },
    ],
    examples: ["cria uma issue no Linear com contexto"],
    notes: "Bom para produto/SaaS; escrita sempre aprovada.",
  },
];

export async function getCapabilityRegistry(userId: string): Promise<CapabilityConnector[]> {
  const integrations = await prisma.integration.findMany({
    where: { userId, status: "connected" },
    select: { provider: true },
  });
  const connected = new Set<string>(integrations.map((i) => i.provider));
  return CONNECTORS.map(({ configured, ...connector }) => {
    let status: ProviderStatus = "setup_required";
    if (connected.has(connector.provider)) status = "connected";
    else if (configured()) status = "configured";
    return { ...connector, status };
  });
}

