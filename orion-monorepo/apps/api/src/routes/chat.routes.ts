import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { aiService } from "../ai/ai.service.js";
import { streamChat } from "../ai/ai-stream.service.js";
import { memoryService } from "../memory/memory.service.js";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";

export const chatRouter: Router = Router();

const sendSchema = z.object({
  message: z.string().min(1).max(8000),
  conversationId: z.string().optional(),
  module: z.string().optional(),
});

/** POST /v1/chat — envia uma mensagem ao núcleo O.R.I.O.N. */
chatRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
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
chatRouter.post("/stream", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = sendSchema.parse(req.body);
    await streamChat({ userId: req.user.id, ...body, res });
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
      take: 30,
    });
    res.json({ ok: true, data: list });
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
