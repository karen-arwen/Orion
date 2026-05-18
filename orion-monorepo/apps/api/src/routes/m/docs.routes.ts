import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { analyzeDriveDoc, analyzeText, listRecentDriveFiles } from "../../modules/docs.service.js";

export const docsRouter: Router = Router();

const analyzeSchema = z.object({
  text: z.string().min(50).max(60_000),
  hint: z.string().max(500).optional(),
});

/** POST /v1/m/docs/analyze — texto colado direto */
docsRouter.post("/analyze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { text, hint } = analyzeSchema.parse(req.body);
    const analysis = await analyzeText({ userId: req.user.id, text, hint });
    res.json({ ok: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

const driveAnalyzeSchema = z.object({ fileId: z.string().min(1) });

/** POST /v1/m/docs/analyze-drive — arquivo do Drive por fileId */
docsRouter.post("/analyze-drive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { fileId } = driveAnalyzeSchema.parse(req.body);
    const analysis = await analyzeDriveDoc(req.user.id, fileId);
    res.json({ ok: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/docs/recent?q=... — lista arquivos recentes do Drive */
docsRouter.get("/recent", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const files = await listRecentDriveFiles(req.user.id, query);
    res.json({ ok: true, data: files });
  } catch (err) {
    next(err);
  }
});
