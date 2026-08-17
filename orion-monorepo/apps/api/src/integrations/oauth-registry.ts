import { env } from "../config/env.js";

/* ═══════════════════════════════════════════════════════════════════
   OAuth Registry — configuração central de todos os provedores.

   Cada provedor define:
   - authUrl: URL do consent screen
   - tokenUrl: URL para trocar code por token
   - scopes: permissões pedidas
   - clientId / clientSecret: credenciais do app
   - buildAuthUrl(): monta a URL completa para o redirect
   - exchangeCode(): troca code por tokens
   - refreshToken(): renova access token

   O token-manager usa esse registry para tratar qualquer provedor
   de forma uniforme — basta adicionar aqui e o resto funciona.
═══════════════════════════════════════════════════════════════════ */

export type OAuthProvider =
  | "google"
  | "microsoft"
  | "github"
  | "notion"
  | "slack"
  | "atlassian"
  | "discord"
  | "figma"
  | "strava"
  | "mercadolivre"
  | "linear"
  | "todoist"
  | "spotify";

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope?: string;
  extra?: Record<string, unknown>;
}

export interface OAuthProviderConfig {
  provider: OAuthProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeSeparator?: string;
  extraAuthParams?: Record<string, string>;
  buildAuthUrl: (state: string) => string;
  exchangeCode: (code: string) => Promise<TokenSet>;
  refreshAccessToken?: (refreshToken: string) => Promise<TokenSet>;
}

// ─── Helpers ──────────────────────────────────────────────────────

function buildStandardAuthUrl(
  config: Pick<OAuthProviderConfig, "authUrl" | "clientId" | "redirectUri" | "scopes" | "scopeSeparator" | "extraAuthParams">,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    state,
    scope: config.scopes.join(config.scopeSeparator ?? " "),
    ...config.extraAuthParams,
  });
  return `${config.authUrl}?${params.toString()}`;
}

async function standardCodeExchange(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
  extraBody?: Record<string, string>,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    ...extraBody,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OAuth token exchange failed (${res.status}): ${err}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scope: data.scope,
  };
}

async function standardRefresh(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

// ─── Registry de provedores ────────────────────────────────────────

function getProviderConfig(provider: OAuthProvider): OAuthProviderConfig | null {
  switch (provider) {

    // ── Microsoft (Outlook + Teams + OneDrive) ────────────────────
    case "microsoft": {
      if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) return null;
      const cfg = {
        provider: "microsoft" as const,
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        redirectUri: env.MICROSOFT_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/microsoft/callback`,
        authUrl: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID ?? "common"}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID ?? "common"}/oauth2/v2.0/token`,
        scopes: [
          "offline_access",
          "User.Read",
          "Mail.ReadWrite",
          "Mail.Send",
          "Calendars.ReadWrite",
          "Files.ReadWrite",
          "Chat.Read",
        ],
        extraAuthParams: { prompt: "consent" },
        scopeSeparator: " " as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: (code) => standardCodeExchange(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, cfg.redirectUri, code),
        refreshAccessToken: (rt) => standardRefresh(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, rt),
      };
    }

    // ── GitHub ─────────────────────────────────────────────────────
    case "github": {
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return null;
      const cfg = {
        provider: "github" as const,
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUri: env.GITHUB_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/github/callback`,
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scopes: ["repo", "user", "read:org", "notifications"],
        scopeSeparator: " " as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: async (code) => {
          const body = new URLSearchParams({
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            code,
            redirect_uri: cfg.redirectUri,
          });
          const res = await fetch(cfg.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
            body: body.toString(),
          });
          const data = await res.json() as { access_token: string; scope: string };
          return { accessToken: data.access_token, refreshToken: null, expiresAt: null, scope: data.scope };
        },
        refreshAccessToken: undefined,
      };
    }

    // ── Notion ─────────────────────────────────────────────────────
    case "notion": {
      if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) return null;
      const cfg = {
        provider: "notion" as const,
        clientId: env.NOTION_CLIENT_ID,
        clientSecret: env.NOTION_CLIENT_SECRET,
        redirectUri: env.NOTION_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/notion/callback`,
        authUrl: "https://api.notion.com/v1/oauth/authorize",
        tokenUrl: "https://api.notion.com/v1/oauth/token",
        scopes: [],
        scopeSeparator: " " as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => {
          const params = new URLSearchParams({
            client_id: cfg.clientId,
            redirect_uri: cfg.redirectUri,
            response_type: "code",
            state,
            owner: "user",
          });
          return `${cfg.authUrl}?${params.toString()}`;
        },
        exchangeCode: async (code) => {
          const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
          const res = await fetch(cfg.tokenUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Basic ${credentials}`,
            },
            body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri }),
          });
          const data = await res.json() as {
            access_token: string;
            workspace_id: string;
            workspace_name: string;
            bot_id: string;
          };
          return {
            accessToken: data.access_token,
            refreshToken: null,
            expiresAt: null,
            extra: { workspace_id: data.workspace_id, workspace_name: data.workspace_name },
          };
        },
        refreshAccessToken: undefined,
      };
    }

    // ── Slack ──────────────────────────────────────────────────────
    case "slack": {
      if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) return null;
      const cfg = {
        provider: "slack" as const,
        clientId: env.SLACK_CLIENT_ID,
        clientSecret: env.SLACK_CLIENT_SECRET,
        redirectUri: env.SLACK_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/slack/callback`,
        authUrl: "https://slack.com/oauth/v2/authorize",
        tokenUrl: "https://slack.com/api/oauth.v2.access",
        scopes: [
          "channels:history", "channels:read",
          "chat:write", "groups:history", "groups:read",
          "im:history", "im:read", "im:write",
          "users:read", "users:read.email",
        ],
        scopeSeparator: "," as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: async (code) => {
          const body = new URLSearchParams({
            code,
            redirect_uri: cfg.redirectUri,
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
          });
          const res = await fetch(cfg.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          const data = await res.json() as {
            ok: boolean;
            access_token: string;
            team: { id: string; name: string };
            authed_user: { id: string };
          };
          if (!data.ok) throw new Error("Slack OAuth falhou");
          return {
            accessToken: data.access_token,
            refreshToken: null,
            expiresAt: null,
            extra: { team_id: data.team?.id, team_name: data.team?.name, user_id: data.authed_user?.id },
          };
        },
        refreshAccessToken: undefined,
      };
    }

    // ── Atlassian (Jira + Confluence) ─────────────────────────────
    case "atlassian": {
      if (!env.ATLASSIAN_CLIENT_ID || !env.ATLASSIAN_CLIENT_SECRET) return null;
      const cfg = {
        provider: "atlassian" as const,
        clientId: env.ATLASSIAN_CLIENT_ID,
        clientSecret: env.ATLASSIAN_CLIENT_SECRET,
        redirectUri: env.ATLASSIAN_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/atlassian/callback`,
        authUrl: "https://auth.atlassian.com/authorize",
        tokenUrl: "https://auth.atlassian.com/oauth/token",
        scopes: [
          "read:jira-work", "write:jira-work", "read:jira-user",
          "read:confluence-content.all", "write:confluence-content",
          "offline_access",
        ],
        extraAuthParams: { audience: "api.atlassian.com", prompt: "consent" },
        scopeSeparator: " " as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: (code) => standardCodeExchange(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, cfg.redirectUri, code),
        refreshAccessToken: (rt) => standardRefresh(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, rt),
      };
    }

    // ── Discord ────────────────────────────────────────────────────
    case "discord": {
      if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return null;
      const cfg = {
        provider: "discord" as const,
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        redirectUri: env.DISCORD_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/discord/callback`,
        authUrl: "https://discord.com/oauth2/authorize",
        tokenUrl: "https://discord.com/api/oauth2/token",
        scopes: ["identify", "email", "guilds", "messages.read"],
        scopeSeparator: " " as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: (code) => standardCodeExchange(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, cfg.redirectUri, code),
        refreshAccessToken: (rt) => standardRefresh(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, rt),
      };
    }

    // ── Figma ──────────────────────────────────────────────────────
    case "figma": {
      if (!env.FIGMA_CLIENT_ID || !env.FIGMA_CLIENT_SECRET) return null;
      const cfg = {
        provider: "figma" as const,
        clientId: env.FIGMA_CLIENT_ID,
        clientSecret: env.FIGMA_CLIENT_SECRET,
        redirectUri: env.FIGMA_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/figma/callback`,
        authUrl: "https://www.figma.com/oauth",
        tokenUrl: "https://www.figma.com/api/oauth/token",
        scopes: ["file_content:read", "file_metadata:read", "org:read"],
        scopeSeparator: " " as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: (code) => standardCodeExchange(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, cfg.redirectUri, code),
        refreshAccessToken: (rt) => standardRefresh("https://www.figma.com/api/oauth/refresh", cfg.clientId, cfg.clientSecret, rt),
      };
    }

    // ── Strava ─────────────────────────────────────────────────────
    case "strava": {
      if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) return null;
      const cfg = {
        provider: "strava" as const,
        clientId: env.STRAVA_CLIENT_ID,
        clientSecret: env.STRAVA_CLIENT_SECRET,
        redirectUri: env.STRAVA_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/strava/callback`,
        authUrl: "https://www.strava.com/oauth/authorize",
        tokenUrl: "https://www.strava.com/oauth/token",
        scopes: ["read,activity:read_all,profile:read_all"],
        scopeSeparator: "," as const,
        extraAuthParams: { approval_prompt: "force" },
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: (code) => standardCodeExchange(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, cfg.redirectUri, code),
        refreshAccessToken: (rt) => standardRefresh(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, rt),
      };
    }

    // ── Mercado Livre ─────────────────────────────────────────────
    case "mercadolivre": {
      if (!env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET) return null;
      const cfg = {
        provider: "mercadolivre" as const,
        clientId: env.ML_CLIENT_ID,
        clientSecret: env.ML_CLIENT_SECRET,
        redirectUri: env.ML_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/mercadolivre/callback`,
        authUrl: "https://auth.mercadolivre.com.br/authorization",
        tokenUrl: "https://api.mercadolibre.com/oauth/token",
        scopes: [],
        scopeSeparator: " " as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => {
          const params = new URLSearchParams({
            response_type: "code",
            client_id: cfg.clientId,
            redirect_uri: cfg.redirectUri,
            state,
          });
          return `${cfg.authUrl}?${params.toString()}`;
        },
        exchangeCode: (code) => standardCodeExchange(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, cfg.redirectUri, code),
        refreshAccessToken: (rt) => standardRefresh(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, rt),
      };
    }

    // ── Linear ──────────────────────────────────────────────────────
    case "linear": {
      if (!env.LINEAR_CLIENT_ID || !env.LINEAR_CLIENT_SECRET) return null;
      const cfg = {
        provider: "linear" as const,
        clientId: env.LINEAR_CLIENT_ID,
        clientSecret: env.LINEAR_CLIENT_SECRET,
        redirectUri: `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/linear/callback`,
        authUrl: "https://linear.app/oauth/authorize",
        tokenUrl: "https://api.linear.app/oauth/token",
        scopes: ["read", "write", "issues:create", "comments:create"],
        scopeSeparator: "," as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: (code) => standardCodeExchange(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, cfg.redirectUri, code),
        refreshAccessToken: (rt) => standardRefresh(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, rt),
      };
    }

    // ── Todoist ─────────────────────────────────────────────────────
    case "todoist": {
      if (!env.TODOIST_CLIENT_ID || !env.TODOIST_CLIENT_SECRET) return null;
      const cfg = {
        provider: "todoist" as const,
        clientId: env.TODOIST_CLIENT_ID,
        clientSecret: env.TODOIST_CLIENT_SECRET,
        redirectUri: `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/todoist/callback`,
        authUrl: "https://todoist.com/oauth/authorize",
        tokenUrl: "https://todoist.com/oauth/access_token",
        scopes: ["data:read_write", "data:delete", "project:delete"],
        scopeSeparator: "," as const,
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: async (code) => {
          const body = new URLSearchParams({
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            code,
            redirect_uri: cfg.redirectUri,
          });
          const res = await fetch(cfg.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          const data = await res.json() as { access_token: string; token_type: string };
          return { accessToken: data.access_token, refreshToken: null, expiresAt: null };
        },
        refreshAccessToken: undefined,
      };
    }

    // ── Spotify ────────────────────────────────────────────────────
    case "spotify": {
      if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return null;
      const cfg = {
        provider: "spotify" as const,
        clientId: env.SPOTIFY_CLIENT_ID,
        clientSecret: env.SPOTIFY_CLIENT_SECRET,
        redirectUri: env.SPOTIFY_REDIRECT_URI ?? `${env.API_URL ?? "http://localhost:3001"}/v1/integrations/oauth/spotify/callback`,
        authUrl: "https://accounts.spotify.com/authorize",
        tokenUrl: "https://accounts.spotify.com/api/token",
        scopes: [
          "user-read-playback-state", "user-modify-playback-state",
          "user-read-currently-playing", "playlist-read-private",
          "playlist-modify-public", "playlist-modify-private",
          "user-library-read", "user-top-read",
        ],
        scopeSeparator: " " as const,
        extraAuthParams: { show_dialog: "true" },
      };
      return {
        ...cfg,
        buildAuthUrl: (state) => buildStandardAuthUrl(cfg, state),
        exchangeCode: (code) => standardCodeExchange(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, cfg.redirectUri, code),
        refreshAccessToken: (rt) => standardRefresh(cfg.tokenUrl, cfg.clientId, cfg.clientSecret, rt),
      };
    }

    default:
      return null;
  }
}

export function getOAuthConfig(provider: OAuthProvider): OAuthProviderConfig | null {
  return getProviderConfig(provider);
}

/** Lista provedores disponiveis (com credenciais configuradas) */
export function getAvailableProviders(): OAuthProvider[] {
  const all: OAuthProvider[] = [
    "google", "microsoft", "github", "notion", "slack",
    "atlassian", "discord", "figma", "strava", "mercadolivre",
    "linear", "todoist", "spotify",
  ];
  return all.filter((p) => getProviderConfig(p) !== null);
}
