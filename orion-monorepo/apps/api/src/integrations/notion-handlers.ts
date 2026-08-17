import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";
import { createState, readState } from "./state-jwt.js";
import { exchangeNotionCode, getNotionAuthUrl } from "./notion-oauth.js";

const NOTION_MCP_URL = "https://mcp.notion.com/mcp";

export async function notionStartHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) {
      throw new ApiError(
        503,
        "OAUTH_NOT_CONFIGURED",
        "Notion OAuth ainda nao configurado. Crie uma public connection e preencha NOTION_CLIENT_ID/SECRET.",
      );
    }

    const state = createState(req.user.id);
    res.json({ ok: true, data: { url: getNotionAuthUrl(state) } });
  } catch (err) {
    next(err);
  }
}

export async function notionCallbackHandler(req: Request, res: Response): Promise<void> {
  const webOrigin = env.WEB_ORIGIN;
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const errorParam = typeof req.query.error === "string" ? req.query.error : undefined;

  if (errorParam) {
    res.redirect(`${webOrigin}/integrations?status=denied&provider=notion&reason=${encodeURIComponent(errorParam)}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${webOrigin}/integrations?status=error&provider=notion&reason=missing_params`);
    return;
  }

  try {
    const { userId } = readState(state);
    const tokens = await exchangeNotionCode(code);
    await prisma.integration.upsert({
      where: { userId_provider: { userId, provider: "notion" } },
      create: {
        userId,
        provider: "notion",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        scopes: [
          `bot:${tokens.botId}`,
          `workspace:${tokens.workspaceId}`,
          ...(tokens.workspaceName ? [`workspace_name:${tokens.workspaceName}`] : []),
        ],
        mcpUrl: NOTION_MCP_URL,
        status: "connected",
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        scopes: [
          `bot:${tokens.botId}`,
          `workspace:${tokens.workspaceId}`,
          ...(tokens.workspaceName ? [`workspace_name:${tokens.workspaceName}`] : []),
        ],
        mcpUrl: NOTION_MCP_URL,
        status: "connected",
        lastUsedAt: new Date(),
      },
    });
    res.redirect(`${webOrigin}/integrations?status=connected&provider=notion`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[oauth:notion] callback falhou:", reason);
    res.redirect(`${webOrigin}/integrations?status=error&provider=notion&reason=${encodeURIComponent(reason)}`);
  }
}
