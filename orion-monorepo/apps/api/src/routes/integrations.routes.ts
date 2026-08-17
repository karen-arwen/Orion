import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";
import { googleStartHandler } from "../integrations/google-handlers.js";
import { notionStartHandler } from "../integrations/notion-handlers.js";
import { getCapabilityRegistry } from "../integrations/capability-registry.js";

export const integrationsRouter: Router = Router();

/**
 * GET /v1/integrations/google/start
 * Retorna a URL de consent. O frontend faz window.location = url.
 */
integrationsRouter.get("/google/start", googleStartHandler);
integrationsRouter.get("/notion/start", notionStartHandler);

/** Mapa provider → URL pública do MCP server correspondente. */
const MCP_URLS: Record<string, string> = {
  gmail: "https://gmailmcp.googleapis.com/mcp/v1",
  gcal: "https://calendarmcp.googleapis.com/mcp/v1",
  gdrive: "https://drivemcp.googleapis.com/mcp/v1",
  notion: "https://mcp.notion.com/mcp",
  spotify: "https://mcp-gateway.spotify.net/mcp",
  booking: "https://demandapi-mcp.booking.com",
  slack: "https://mcp.slack.com/mcp",
};

/** GET /v1/integrations — status de todas as integrações do usuário. */
integrationsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await prisma.integration.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        provider: true,
        status: true,
        scopes: true,
        mcpUrl: true,
        connectedAt: true,
        lastUsedAt: true,
      },
    });
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

integrationsRouter.get("/capabilities", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "SessÃ£o necessÃ¡ria.");
    res.json({ ok: true, data: await getCapabilityRegistry(req.user.id) });
  } catch (err) {
    next(err);
  }
});

const connectSchema = z.object({
  provider: z.enum(["gmail", "gcal", "gdrive", "notion", "slack", "spotify", "booking"]),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  scopes: z.array(z.string()).default([]),
});

/**
 * POST /v1/integrations/connect
 *
 * Em produção real, isto seria um fluxo OAuth callback. Aqui aceitamos os tokens
 * pra setup manual de dev. Em prod: trocar por callback Clerk OAuth ou Google OAuth direto.
 */
integrationsRouter.post("/connect", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = connectSchema.parse(req.body);
    const mcpUrl = MCP_URLS[body.provider];
    if (!mcpUrl) throw new ApiError(400, "BAD_REQUEST", "Provider sem MCP configurado.");

    const integ = await prisma.integration.upsert({
      where: { userId_provider: { userId: req.user.id, provider: body.provider } },
      create: {
        userId: req.user.id,
        provider: body.provider,
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        scopes: body.scopes,
        mcpUrl,
        status: "connected",
      },
      update: {
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        scopes: body.scopes,
        status: "connected",
      },
      select: { id: true, provider: true, status: true },
    });
    res.json({ ok: true, data: integ });
  } catch (err) {
    next(err);
  }
});

/** DELETE /v1/integrations/:provider — desconecta um provider. */
integrationsRouter.delete("/:provider", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const provider = z
      .enum(["gmail", "gcal", "gdrive", "notion", "slack", "spotify", "booking"])
      .parse(req.params.provider);
    await prisma.integration.deleteMany({ where: { userId: req.user.id, provider } });
    res.json({ ok: true, data: { provider, disconnected: true } });
  } catch (err) {
    next(err);
  }
});
