import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  listEntries, getTodayEntry, upsertEntry, getStats,
  generateInsight, getInsight, deleteEntry,
} from "../../modules/journal.service.js";

export const journalRouter: Router = Router();

const entrySchema = z.object({
  mood:        z.number().int().min(1).max(5).optional(),
  energy:      z.number().int().min(1).max(5).optional(),
  gratitude:   z.array(z.string()).max(3).optional(),
  highlight:   z.string().max(500).optional(),
  challenge:   z.string().max(500).optional(),
  reflection:  z.string().max(2000).optional(),
  intentions:  z.array(z.string()).max(5).optional(),
  tags:        z.array(z.string()).max(10).optional(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// GET /m/journal
journalRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const days = Number(req.query["days"] ?? 30);
    const entries = await listEntries(req.user.id, isNaN(days) ? 30 : days);
    res.json(entries);
  } catch (e) { next(e); }
});

// GET /m/journal/today
journalRouter.get("/today", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const entry = await getTodayEntry(req.user.id);
    res.json(entry);
  } catch (e) { next(e); }
});

// GET /m/journal/stats
journalRouter.get("/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const stats = await getStats(req.user.id);
    res.json(stats);
  } catch (e) { next(e); }
});

// GET /m/journal/:date/insight
journalRouter.get("/:date/insight", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const insight = await getInsight(req.user.id, req.params.date!);
    res.json(insight);
  } catch (e) { next(e); }
});

// GET /m/journal/:date
journalRouter.get("/:date", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const entries = await listEntries(req.user.id, 365);
    const entry = entries.find(e => e.date === req.params.date);
    if (!entry) throw new ApiError(404, "NOT_FOUND", "Entrada nao encontrada.");
    res.json(entry);
  } catch (e) { next(e); }
});

// POST /m/journal
journalRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = entrySchema.parse(req.body);
    const { date, ...input } = body;
    const entry = await upsertEntry(req.user.id, input, date);
    res.json(entry);
  } catch (e) { next(e); }
});

// POST /m/journal/:date/insight
journalRouter.post("/:date/insight", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const insight = await generateInsight(req.user.id, req.params.date);
    res.json(insight);
  } catch (e) { next(e); }
});

// DELETE /m/journal/:date
journalRouter.delete("/:date", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await deleteEntry(req.user.id, req.params.date!);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
