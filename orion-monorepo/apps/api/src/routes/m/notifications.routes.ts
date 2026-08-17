import { Router, type Request, type Response, type NextFunction } from "express";
import { ApiError } from "../../middleware/error.js";
import {
  createSmartNotification,
  listPendingNotifications,
  markDelivered,
  markNotifRead,
  dismissNotif,
  getNotifStats,
  cleanOldNotifications,
} from "../../modules/smart-notifications.service.js";

export const notificationsRouter: Router = Router();

notificationsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 30;
    const data = await listPendingNotifications(req.user.id, limit);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

notificationsRouter.get("/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const stats = await getNotifStats(req.user.id);
    res.json({ ok: true, data: stats });
  } catch (err) { next(err); }
});

notificationsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const notif = await createSmartNotification({ userId: req.user.id, ...req.body });
    res.status(201).json({ ok: true, data: notif });
  } catch (err) { next(err); }
});

notificationsRouter.patch("/:id/delivered", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const n = await markDelivered(req.user.id, req.params.id);
    res.json({ ok: true, data: n });
  } catch (err) { next(err); }
});

notificationsRouter.patch("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const n = await markNotifRead(req.user.id, req.params.id);
    res.json({ ok: true, data: n });
  } catch (err) { next(err); }
});

notificationsRouter.patch("/:id/dismiss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const n = await dismissNotif(req.user.id, req.params.id);
    res.json({ ok: true, data: n });
  } catch (err) { next(err); }
});

notificationsRouter.post("/clean", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const days = typeof req.body.days === "number" ? req.body.days : 7;
    const result = await cleanOldNotifications(req.user.id, days);
    res.json({ ok: true, data: { cleaned: result.count } });
  } catch (err) { next(err); }
});
