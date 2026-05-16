import { env } from "../config/env.js";

/* ═══════════════════════════════════════════════════════════════════
   Google OAuth 2.0 — fluxo completo.

   - getAuthUrl: monta a URL pro consent screen do Google
   - exchangeCode: troca o ?code do callback por access + refresh tokens
   - refreshAccessToken: usa o refresh pra pegar novo access (sem o
     usuário precisar fazer nada — é assim que produto real funciona)

   Credenciais vêm de GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
   (criadas pelo dono do projeto no Google Cloud Console — uma vez só).
═══════════════════════════════════════════════════════════════════ */

/** Scopes pedidos em um único consent — destrava Gmail + Calendar + Drive. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "openid",
  "email",
  "profile",
] as const;

/** Endpoint público do Google. */
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
}

function requireOAuthCreds(): { clientId: string; clientSecret: string } {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "GOOGLE_CLIENT_ID/SECRET não configurados no .env. Veja PASSO_A_PASSO.md → Fase 4.",
    );
  }
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

/** Monta a URL onde o usuário vai dar consent. */
export function getAuthUrl(opts: { state: string; redirectUri: string }): string {
  const { clientId } = requireOAuthCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    // offline + consent garantem que o Google sempre devolva refresh_token,
    // mesmo se o usuário já autorizou antes.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state: opts.state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Troca o code do callback por access + refresh tokens. */
export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<RefreshResult> {
  const { clientId, clientSecret } = requireOAuthCreds();
  const body = new URLSearchParams({
    code: opts.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange falhou (${res.status}): ${text}`);
  }

  const json = (await res.json()) as GoogleTokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
    scopes: json.scope.split(" "),
  };
}

/** Renova o access_token usando o refresh_token. */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const { clientId, clientSecret } = requireOAuthCreds();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google refresh falhou (${res.status}): ${text}`);
  }

  const json = (await res.json()) as GoogleTokenResponse;
  return {
    accessToken: json.access_token,
    // Google às vezes rotaciona o refresh_token. Se vier um novo, usamos.
    // Se não vier, mantemos o antigo (responsabilidade do chamador).
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
    scopes: json.scope ? json.scope.split(" ") : [],
  };
}
