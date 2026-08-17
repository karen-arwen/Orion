import { Router, type Request, type Response } from "express";
import { createHmac } from "crypto";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { getOAuthConfig, getAvailableProviders, type OAuthProvider } from "./oauth-registry.js";

/* ═══════════════════════════════════════════════════════════════════
   OAuth Handler Universal — um router que serve todos os provedores.

   GET  /v1/integrations/:provider/connect   → redireciona pro consent
   GET  /v1/integrations/:provider/callback  → troca code por token
   DELETE /v1/integrations/:provider         → desconecta

   Estado é carregado via JWT assinado (state param) para prevenir
   CSRF e associar o callback ao userId correto sem sessão server-side.
═══════════════════════════════════════════════════════════════════ */

const STATE_SECRET = env.CLERK_SECRET_KEY ?? "orion-state-secret";

interface OAuthState {
  userId: string;
  provider: string;
  returnTo?: string;
}

function signState(data: OAuthState): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  const sig = createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyState(token: string): OAuthState | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
    if (expected !== sig) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as OAuthState & { exp: number };
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export const oauthRouter = Router();

/** GET /v1/integrations/available — lista provedores com credenciais configuradas */
oauthRouter.get("/available", (req: Request, res: Response) => {
  const providers = getAvailableProviders();
  res.json({ ok: true, data: providers });
});

/** GET /v1/integrations/:provider/connect — inicia o fluxo OAuth */
oauthRouter.get("/:provider/connect", (req: Request, res: Response) => {
  const provider = req.params.provider as OAuthProvider;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ ok: false, error: { message: "Autenticação necessária" } });
    return;
  }

  const config = getOAuthConfig(provider);
  if (!config) {
    res.status(400).json({ ok: false, error: { message: `Provedor ${provider} não configurado` } });
    return;
  }

  const state = signState({ userId, provider, returnTo: req.query.returnTo as string | undefined });
  const authUrl = config.buildAuthUrl(state);

  res.redirect(authUrl);
});

/** GET /v1/integrations/:provider/callback — recebe o code e salva o token */
oauthRouter.get("/:provider/callback", async (req: Request, res: Response) => {
  const provider = req.params.provider as OAuthProvider;
  const { code, state, error } = req.query as Record<string, string>;

  const frontendUrl = env.FRONTEND_URL ?? "http://localhost:5173";

  // Erro de autorização pelo usuário
  if (error) {
    res.redirect(`${frontendUrl}/integrations?error=${encodeURIComponent(error)}&provider=${provider}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${frontendUrl}/integrations?error=missing_code&provider=${provider}`);
    return;
  }

  // Verifica state JWT
  const stateData = verifyState(state);
  if (!stateData || stateData.provider !== provider) {
    res.redirect(`${frontendUrl}/integrations?error=invalid_state&provider=${provider}`);
    return;
  }

  const config = getOAuthConfig(provider);
  if (!config) {
    res.redirect(`${frontendUrl}/integrations?error=not_configured&provider=${provider}`);
    return;
  }

  try {
    // Troca code por tokens
    const tokenSet = await config.exchangeCode(code);

    // Salva/atualiza no banco — um registro por userId+provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.integration as any).upsert({
      where: { userId_provider: { userId: stateData.userId, provider } },
      create: {
        userId: stateData.userId,
        provider: provider as string,
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        expiresAt: tokenSet.expiresAt,
        scopes: tokenSet.scope ? tokenSet.scope.split(" ") : config.scopes,
        status: "connected",
        meta: tokenSet.extra ?? {},
        mcpUrl: "",
        lastUsedAt: new Date(),
      },
      update: {
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken ?? undefined,
        expiresAt: tokenSet.expiresAt,
        scopes: tokenSet.scope ? tokenSet.scope.split(" ") : config.scopes,
        status: "connected",
        meta: tokenSet.extra ?? {},
        lastUsedAt: new Date(),
      },
    });

    const returnTo = stateData.returnTo ?? "/integrations";
    res.redirect(`${frontendUrl}${returnTo}?connected=${provider}`);
  } catch (err) {
    console.error(`[oauth:${provider}] callback falhou:`, (err as Error).message);
    res.redirect(`${frontendUrl}/integrations?error=exchange_failed&provider=${provider}`);
  }
});

/** DELETE /v1/integrations/:provider — desconecta um provedor */
oauthRouter.delete("/:provider", async (req: Request, res: Response) => {
  const provider = req.params.provider;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ ok: false });
    return;
  }

  await prisma.integration.updateMany({
    where: { userId, provider: provider as any },
    data: { status: "revoked" as any, accessToken: "", refreshToken: null },
  });

  res.json({ ok: true });
});

/** GET /v1/integrations — lista todas as integrações do usuário */
oauthRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ ok: false }); return; }

  const integrations = await prisma.integration.findMany({
    where: { userId },
    select: { provider: true, status: true, scopes: true, lastUsedAt: true, expiresAt: true },
  });

  res.json({ ok: true, data: integrations });
});
