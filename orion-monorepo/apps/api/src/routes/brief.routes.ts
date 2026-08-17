import { Router, type Request, type Response, type NextFunction } from "express";
import { getDailyBrief } from "../modules/brief.service.js";
import { ApiError } from "../middleware/error.js";

export const briefRouter: Router = Router();

/** GET /v1/brief — Daily Brief do dia */
briefRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const refresh = req.query.refresh === "true";
    const brief = await getDailyBrief(req.user.id, refresh);
    res.json({ ok: true, data: brief });
  } catch (err) {
    next(err);
  }
});
