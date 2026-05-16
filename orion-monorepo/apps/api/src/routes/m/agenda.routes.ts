import { Router, type Request, type Response, type NextFunction } from "express";
import { ApiError } from "../../middleware/error.js";
import { prisma } from "../../db/prisma.js";
import { detectConflicts, getToday, getWeek, suggestFocusBlock } from "../../modules/agenda.service.js";

export const agendaRouter: Router = Router();

async function userTimezone(userId: string): Promise<string> {
  const p = await prisma.userProfile.findUnique({ where: { userId } });
  return p?.timezone ?? "America/Sao_Paulo";
}

/** GET /v1/m/agenda/today */
agendaRouter.get("/today", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const events = await getToday(req.user.id);
    res.json({ ok: true, data: { events, conflicts: detectConflicts(events).length } });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/agenda/week — 7 dias agrupados */
agendaRouter.get("/week", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const tz = await userTimezone(req.user.id);
    const days = await getWeek(req.user.id, tz);
    res.json({ ok: true, data: days });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/agenda/focus-suggestion — sugere bloco de foco */
agendaRouter.get("/focus-suggestion", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const tz = await userTimezone(req.user.id);
    const text = await suggestFocusBlock(req.user.id, tz);
    res.json({ ok: true, data: { suggestion: text } });
  } catch (err) {
    next(err);
  }
});
