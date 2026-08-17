import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { aiService } from "../ai/ai.service.js";
import { streamChat } from "../ai/ai-stream.service.js";
import { memoryService } from "../memory/memory.service.js";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";

import { chatRateLimit, aiHeavyRateLimit } from "../middleware/rate-limit.js";
import { analyzeFile } from "../modules/file-analysis.service.js";
import path from "node:path";
import { promises as fs } from "node:fs";

export const chatRouter: Router = Router();

const sendSchema = z.object({
  message: z.string().min(1).max(50_000),
  conversationId: z.string().optional(),
  module: z.string().optional(),
});

const feedbackSchema = z.object({
  message: z.string().min(1).max(8000),
  helpful: z.boolean(),
  reason: z.string().max(400).optional(),
  conversationId: z.string().optional(),
});

/** POST /v1/chat — envia uma mensagem ao núcleo O.R.I.O.N. */
chatRouter.post("/", chatRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = sendSchema.parse(req.body);
    const result = await aiService.chat({ userId: req.user.id, ...body });
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/chat/stream — versão streaming (SSE token-a-token).
 * Se a IA precisar chamar ferramenta, emite evento "fallback_to_tools"
 * e o frontend refaz a mesma mensagem via POST /v1/chat normal.
 */
chatRouter.post("/stream", chatRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = sendSchema.parse(req.body);
    await streamChat({ userId: req.user.id, ...body, res });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/chat/feedback — grava reação explícita como memória de aprendizado. */
chatRouter.post("/feedback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = feedbackSchema.parse(req.body);
    const sentiment = body.helpful ? "aprovou" : "rejeitou";
    const reason = body.reason ? ` Motivo: ${body.reason}` : "";
    await prisma.memory.create({
      data: {
        userId: req.user.id,
        type: "feedback",
        content: `Usuário ${sentiment} uma resposta do O.R.I.O.N.${reason} Resposta: ${body.message.slice(0, 1200)}`,
        importance: body.helpful ? 0.65 : 0.85,
        embedding: [],
      },
    });
    if (body.conversationId) {
      await prisma.conversation.updateMany({
        where: { id: body.conversationId, userId: req.user.id },
        data: { updatedAt: new Date() },
      });
    }
    res.json({ ok: true, data: { saved: true } });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/chat/history?conversationId=... — histórico de uma conversa. */
chatRouter.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const conversationId = z.string().min(1).parse(req.query.conversationId);
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: req.user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv) throw new ApiError(404, "NOT_FOUND", "Conversa não encontrada.");
    res.json({ ok: true, data: conv });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/chat/conversations — lista as conversas recentes do usuário. */
chatRouter.get("/conversations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await prisma.conversation.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });
    const mapped = list.map(c => ({
      id: c.id,
      title: c.title,
      moduleId: c.moduleId,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      messageCount: c._count.messages,
    }));
    res.json({ ok: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

/** DELETE /v1/chat/:id — limpa uma conversa (curto-prazo + Postgres). */
chatRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const owned = await prisma.conversation.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Conversa não encontrada.");
    await prisma.conversation.delete({ where: { id } });
    await memoryService.clearShortTerm(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});


// ─── File Upload + Analysis ───────────────────────────────────────

chatRouter.post("/analyze-file", aiHeavyRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) { res.status(401).json({ ok: false }); return; }

    // Expect base64 encoded file content + filename
    const { filename, content: fileContent, prompt } = req.body as {
      filename: string;
      content: string;      // base64 encoded
      prompt?: string;
    };

    if (!filename || !fileContent) {
      res.status(400).json({ ok: false, error: "filename and content required" });
      return;
    }

    // Write to temp file
    const tmpDir = path.join(process.cwd(), ".tmp-uploads");
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`);

    const buffer = Buffer.from(fileContent, "base64");
    await fs.writeFile(tmpPath, buffer);

    try {
      const result = await analyzeFile(tmpPath, prompt);
      res.json({ ok: true, data: result });
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  } catch (err) { next(err); }
});