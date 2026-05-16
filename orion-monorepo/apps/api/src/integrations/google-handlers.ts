import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";
import { exchangeCode, getAuthUrl } from "./google-oauth.js";
import { createState, readState } from "./state-jwt.js";

/* ═══════════════════════════════════════════════════════════════════
   Handlers do fluxo OAuth Google.

   /v1/integrations/google/start    (autenticado)  → 200 { url }
       O frontend chama, recebe a URL do consent, redireciona o browser.

   /v1/integrations/google/callback (PÚBLICO)      → 302 pro frontend
       O Google redireciona o browser pra cá com ?code=... e ?state=...
       Trocamos o code por tokens, salvamos os 3 providers no banco,
       devolvemos o usuário pro app.
═══════════════════════════════════════════════════════════════════ */

const MCP_URLS = {
  gmail: "https://gmailmcp.googleapis.com/mcp/v1",
  gcal: "https://calendarmcp.googleapis.com/mcp/v1",
  gdrive: "https://drivemcp.googleapis.com/mcp/v1",
} as const;

type GoogleProvider = keyof typeof MCP_URLS;
const GOOGLE_PROVIDERS = ["gmail", "gcal", "gdrive"] satisfies GoogleProvider[];

/** Start: monta a URL de consent e devolve pro frontend. */
export async function googleStartHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new ApiError(
        503,
        "OAUTH_NOT_CONFIGURED",
        "Credenciais Google não configuradas no servidor. Veja PASSO_A_PASSO.md → Fase 4.",
      );
    }

    const state = createState(req.user.id);
    const url = getAuthUrl({ state, redirectUri: env.GOOGLE_REDIRECT_URI });
    res.json({ ok: true, data: { url } });
  } catch (err) {
    next(err);
  }
}

/** Callback: troca code por tokens e salva. Sempre redireciona pro frontend. */
export async function googleCallbackHandler(req: Request, res: Response): Promise<void> {
  const webOrigin = env.WEB_ORIGIN;
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const errorParam = typeof req.query.error === "string" ? req.query.error : undefined;

  // Usuário recusou no consent screen do Google
  if (errorParam) {
    res.redirect(`${webOrigin}/integrations?status=denied&reason=${encodeURIComponent(errorParam)}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${webOrigin}/integrations?status=error&reason=missing_params`);
    return;
  }

  try {
    const { userId } = readState(state);

    const tokens = await exchangeCode({ code, redirectUri: env.GOOGLE_REDIRECT_URI });

    // 1 consent → 3 integrações no banco. Mesmo par de tokens, MCP URLs diferentes.
    for (const provider of GOOGLE_PROVIDERS) {
      await prisma.integration.upsert({
        where: { userId_provider: { userId, provider } },
        create: {
          userId,
          provider,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
          mcpUrl: MCP_URLS[provider],
          status: "connected",
        },
        update: {
          accessToken: tokens.accessToken,
          // Só atualiza refresh se o Google mandou um novo
          ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
          expiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
          status: "connected",
          lastUsedAt: new Date(),
        },
      });
    }

    res.redirect(`${webOrigin}/integrations?status=connected`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[oauth] callback falhou:", reason);
    res.redirect(`${webOrigin}/integrations?status=error&reason=${encodeURIComponent(reason)}`);
  }
}
