import { Router, type Request, type Response, type NextFunction } from "express";
import { ApiError } from "../../middleware/error.js";
import { getClassifiedInbox, summarizeInbox } from "../../modules/comms.service.js";

export const commsRouter: Router = Router();

/** GET /v1/m/comms/inbox — inbox classificada por urgência */
commsRouter.get("/inbox", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await getClassifiedInbox(req.user.id, { max: 20 });
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/comms/summary — resumo executivo gerado por IA */
commsRouter.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const text = await summarizeInbox(req.user.id);
    res.json({ ok: true, data: { summary: text } });
  } catch (err) {
    next(err);
  }
});
