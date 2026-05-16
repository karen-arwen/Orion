import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  analyzeDriveDoc,
  analyzeUploadedDoc,
  listDocAnalyses,
  listDriveDocs,
} from "../../modules/docs.service.js";

export const docsRouter: Router = Router();

const listSchema = z.object({
  query: z.string().optional(),
  type: z.string().optional(),
  max: z.coerce.number().int().min(1).max(50).default(20),
});

docsRouter.get("/drive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const query = listSchema.parse(req.query);
    const files = await listDriveDocs(req.user.id, query);
    res.json({ ok: true, data: files });
  } catch (err) {
    next(err);
  }
});

const analyzeDriveSchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  instruction: z.string().max(1000).optional(),
});

docsRouter.post("/analyze-drive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = analyzeDriveSchema.parse(req.body);
    const analysis = await analyzeDriveDoc({ userId: req.user.id, ...body });
    res.json({ ok: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

const uploadSchema = z.object({
  file: z.object({
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    base64: z.string().min(1),
  }),
  instruction: z.string().max(1000).optional(),
});

docsRouter.post("/analyze-upload", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = uploadSchema.parse(req.body);
    const analysis = await analyzeUploadedDoc({ userId: req.user.id, ...body });
    res.json({ ok: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

docsRouter.get("/analyses", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const analyses = await listDocAnalyses(req.user.id);
    res.json({ ok: true, data: analyses });
  } catch (err) {
    next(err);
  }
});
