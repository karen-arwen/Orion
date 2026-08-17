import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  listTimeline,
  createTimelineEvent,
  updateTimelineEvent,
  deleteTimelineEvent,
  getTimelineStats,
} from "../../modules/timeline.service.js";

export const timelineRouter: Router = Router();

/** GET /v1/m/timeline */
timelineRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const q = req.query;
    const filters = {
      type: typeof q.type === "string" ? q.type : undefined,
      module: typeof q.module === "string" ? q.module : undefined,
      from: typeof q.from === "string" ? new Date(q.from) : undefined,
      to: typeof q.to === "string" ? new Date(q.to) : undefined,
      search: typeof q.search === "string" ? q.search : undefined,
    };
    const limit = typeof q.limit === "string" ? Math.min(Number(q.limit), 200) : 100;
    const offset = typeof q.offset === "string" ? Number(q.offset) : 0;
    const data = await listTimeline(req.user.id, filters, limit, offset);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

/** GET /v1/m/timeline/stats */
timelineRouter.get("/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const stats = await getTimelineStats(req.user.id);
    res.json({ ok: true, data: stats });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  type: z.string(),
  title: z.string().min(1),
  detail: z.string().optional(),
  date: z.string().transform((s) => new Date(s)),
  module: z.string().optional(),
  entityId: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** POST /v1/m/timeline */
timelineRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const data = createSchema.parse(req.body);
    const event = await createTimelineEvent({ userId: req.user.id, ...data });
    res.status(201).json({ ok: true, data: event });
  } catch (err) { next(err); }
});

/** PATCH /v1/m/timeline/:id */
timelineRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const event = await updateTimelineEvent(req.user.id, req.params.id, req.body);
    res.json({ ok: true, data: event });
  } catch (err) { next(err); }
});

/** DELETE /v1/m/timeline/:id */
timelineRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    await deleteTimelineEvent(req.user.id, req.params.id);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) { next(err); }
});
