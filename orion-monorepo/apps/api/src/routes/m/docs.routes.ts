import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  analyzeDriveDoc,
  analyzeText,
  listRecentDriveFiles,
  analyzePdfBuffer,
  listDocHistory,
  deleteDocAnalysis,
} from "../../modules/docs.service.js";

// In-memory storage - no temp files on disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const docsRouter: Router = Router();

const analyzeSchema = z.object({
  text: z.string().min(50).max(60_000),
  hint: z.string().max(500).optional(),
});

/** POST /v1/m/docs/analyze - texto colado direto */
docsRouter.post("/analyze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const { text, hint } = analyzeSchema.parse(req.body);
    const analysis = await analyzeText({ userId: req.user.id, text, hint });
    res.json({ ok: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

const driveAnalyzeSchema = z.object({ fileId: z.string().min(1) });

/** POST /v1/m/docs/analyze-drive - arquivo do Drive por fileId */
docsRouter.post("/analyze-drive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const { fileId } = driveAnalyzeSchema.parse(req.body);
    const analysis = await analyzeDriveDoc(req.user.id, fileId);
    res.json({ ok: true, data: analysis });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/m/docs/recent?q=... - lista arquivos recentes do Drive */
docsRouter.get("/recent", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const files = await listRecentDriveFiles(req.user.id, query);
    res.json({ ok: true, data: files });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/m/docs/upload-pdf - upload direto de arquivo PDF */
docsRouter.post(
  "/upload-pdf",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
      if (!req.file) throw new ApiError(400, "NO_FILE", "Nenhum arquivo enviado.");
      const allowed = ["application/pdf", "text/plain"];
      if (!allowed.includes(req.file.mimetype)) {
        throw new ApiError(400, "INVALID_TYPE", "Apenas PDF ou TXT suportado.");
      }
      let analysis;
      if (req.file.mimetype === "text/plain") {
        const text = req.file.buffer.toString("utf-8");
        analysis = await analyzeText({ userId: req.user.id, text });
        const key = `doc_analysis_${Date.now()}`;
        const { prisma } = await import("../../db/prisma.js");
        await prisma.userPattern.upsert({
          where: { userId_patternType: { userId: req.user.id, patternType: key } },
          update: { patternValue: JSON.stringify({ fileName: req.file.originalname, analysis, createdAt: new Date().toISOString() }) },
          create: { userId: req.user.id, patternType: key, patternValue: JSON.stringify({ fileName: req.file.originalname, analysis, createdAt: new Date().toISOString() }) },
        });
      } else {
        analysis = await analyzePdfBuffer(req.user.id, req.file.originalname, req.file.buffer);
      }
      res.json({ ok: true, data: analysis });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /v1/m/docs/history - lista analises salvas */
docsRouter.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const limit = Number(req.query.limit ?? 20);
    const history = await listDocHistory(req.user.id, limit);
    res.json({ ok: true, data: history });
  } catch (err) {
    next(err);
  }
});

/** DELETE /v1/m/docs/history/:id - deleta analise do historico */
docsRouter.delete("/history/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await deleteDocAnalysis(req.user.id, req.params.id!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
