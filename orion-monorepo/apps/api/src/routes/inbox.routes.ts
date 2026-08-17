import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/error.js";
import {
  listInboxItems,
  getInboxStats,
  createInboxItem,
  markRead,
  markAllRead,
  markActed,
  archiveItem,
  archiveRead,
  syncFromIntegrations,
} from "../modules/inbox.service.js";

export const inboxRouter: Router = Router();

const filtersSchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  urgency: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/** GET /v1/inbox — lista items com filtros */
inboxRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const f = filtersSchema.parse(req.query);
    const data = await listInboxItems(req.user.id, f, f.limit, f.offset);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

/** GET /v1/inbox/stats — contadores rápidos */
inboxRouter.get("/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const stats = await getInboxStats(req.user.id);
    res.json({ ok: true, data: stats });
  } catch (err) { next(err); }
});

/** POST /v1/inbox — criar item manual */
inboxRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const schema = z.object({
      source: z.string(),
      type: z.string(),
      title: z.string().min(1),
      preview: z.string().optional(),
      sender: z.string().optional(),
      urgency: z.enum(["critical", "urgent", "normal", "low"]).default("normal"),
      category: z.string().default("uncategorized"),
      actionable: z.boolean().default(false),
      metadata: z.record(z.unknown()).optional(),
    });
    const data = schema.parse(req.body);
    const item = await createInboxItem({ userId: req.user.id, ...data });
    res.status(201).json({ ok: true, data: item });
  } catch (err) { next(err); }
});

/** POST /v1/inbox/sync — sync com integrações */
inboxRouter.post("/sync", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const results = await syncFromIntegrations(req.user.id);
    res.json({ ok: true, data: results });
  } catch (err) { next(err); }
});

/** PATCH /v1/inbox/:id/read — marcar como lido */
inboxRouter.patch("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const item = await markRead(req.user.id, req.params.id);
    res.json({ ok: true, data: item });
  } catch (err) { next(err); }
});

/** PATCH /v1/inbox/:id/acted — marcar como ação tomada */
inboxRouter.patch("/:id/acted", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const item = await markActed(req.user.id, req.params.id);
    res.json({ ok: true, data: item });
  } catch (err) { next(err); }
});

/** PATCH /v1/inbox/:id/archive — arquivar */
inboxRouter.patch("/:id/archive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const item = await archiveItem(req.user.id, req.params.id);
    res.json({ ok: true, data: item });
  } catch (err) { next(err); }
});

/** POST /v1/inbox/read-all — marcar tudo como lido */
inboxRouter.post("/read-all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const source = typeof req.query.source === "string" ? req.query.source : undefined;
    const result = await markAllRead(req.user.id, source);
    res.json({ ok: true, data: { updated: result.count } });
  } catch (err) { next(err); }
});

/** POST /v1/inbox/archive-read — arquivar todos os lidos */
inboxRouter.post("/archive-read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const result = await archiveRead(req.user.id);
    res.json({ ok: true, data: { archived: result.count } });
  } catch (err) { next(err); }
});
