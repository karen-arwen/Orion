import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import type { IntelligenceProfile, MemoryListResponse, MemoryRecord, MemoryType } from "@orion/types";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";

export const userRouter: Router = Router();

const memoryTypes = ["fact", "preference", "event", "feedback", "project", "relationship"] as const;

function toMemoryRecord(memory: {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}): MemoryRecord {
  return {
    id: memory.id,
    type: memory.type,
    content: memory.content,
    importance: memory.importance,
    pinned: memory.pinned,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}

/** GET /v1/user/profile — perfil completo do operador autenticado. */
userRouter.get("/profile", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        projects: true,
        modules: true,
        integrations: { select: { provider: true, status: true } },
      },
    });
    res.json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
});

/** GET /v1/user/intelligence — o que o Orion aprendeu e onde ainda falta calibrar. */
userRouter.get("/intelligence", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const [preferences, memories, patterns] = await Promise.all([
      prisma.userPreference.findMany({
        where: { userId: req.user.id },
        orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
        take: 18,
      }),
      prisma.memory.findMany({
        where: { userId: req.user.id },
        orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
      prisma.userPattern.findMany({
        where: { userId: req.user.id },
        orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
        take: 8,
      }),
    ]);

    const layerCounts = preferences.reduce(
      (acc, pref) => {
        acc[pref.layer] += 1;
        return acc;
      },
      { current: 0, nostalgia: 0, exploration: 0 },
    );
    const signals = preferences.length + memories.length + patterns.length * 2;
    const adaptationScore = Math.min(100, Math.round(signals * 5));
    const gaps: string[] = [];
    if (preferences.length < 5) gaps.push("Preferencias explicitas insuficientes");
    if (layerCounts.nostalgia === 0) gaps.push("Camada nostalgia ainda vazia");
    if (layerCounts.exploration === 0) gaps.push("Camada exploracao ainda vazia");
    if (!patterns.some((p) => p.patternType === "energy_peak")) gaps.push("Pico de energia ainda nao estabilizado");
    if (!patterns.some((p) => p.patternType === "module_usage")) gaps.push("Uso de modulos ainda em calibracao");
    if (!memories.some((m) => m.type === "feedback")) gaps.push("Pouco feedback explicito no chat");

    const data: IntelligenceProfile = {
      adaptationScore,
      tasteBlend: { current: 70, nostalgia: 20, exploration: 10 },
      preferences: preferences.map((p) => ({
        key: p.key,
        value: p.value,
        layer: p.layer,
        confidence: p.confidence,
        updatedAt: p.updatedAt.toISOString(),
      })),
      memories: memories.map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        importance: m.importance,
        pinned: m.pinned,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      patterns: patterns.map((p) => ({
        patternType: p.patternType,
        data: p.data && typeof p.data === "object" && !Array.isArray(p.data) ? (p.data as Record<string, unknown>) : {},
        confidence: p.confidence,
        updatedAt: p.updatedAt.toISOString(),
      })),
      gaps: gaps.slice(0, 5),
      nextCalibrationPrompts: [
        "Me diga 3 coisas que voce quer que eu sempre considere antes de sugerir algo.",
        "Quais tipos de alerta voce quer receber mesmo quando estiver ocupada?",
        "Me da um exemplo de resposta minha que pareceu generica para eu ajustar meu estilo.",
      ],
    };
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

const memoryQuerySchema = z.object({
  type: z.enum(memoryTypes).optional(),
  q: z.string().max(120).optional(),
  pinned: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(80).default(40),
});

const memoryCreateSchema = z.object({
  type: z.enum(memoryTypes),
  content: z.string().min(3).max(4000),
  importance: z.number().min(0).max(1).default(0.65),
  pinned: z.boolean().default(false),
});

const memoryUpdateSchema = z.object({
  type: z.enum(memoryTypes).optional(),
  content: z.string().min(3).max(4000).optional(),
  importance: z.number().min(0).max(1).optional(),
  pinned: z.boolean().optional(),
});

/** GET /v1/user/memories — centro de memoria editavel. */
userRouter.get("/memories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const query = memoryQuerySchema.parse(req.query);
    const where = {
      userId: req.user.id,
      ...(query.type ? { type: query.type } : {}),
      ...(query.pinned !== undefined ? { pinned: query.pinned } : {}),
      ...(query.q ? { content: { contains: query.q, mode: "insensitive" as const } } : {}),
    };
    const [items, total, allStats] = await Promise.all([
      prisma.memory.findMany({
        where,
        orderBy: [{ pinned: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
        take: query.limit,
      }),
      prisma.memory.count({ where }),
      prisma.memory.findMany({
        where: { userId: req.user.id },
        select: { type: true, importance: true, pinned: true },
      }),
    ]);

    const byType = Object.fromEntries(memoryTypes.map((type) => [type, 0])) as Record<MemoryType, number>;
    let pinned = 0;
    let totalImportance = 0;
    for (const row of allStats) {
      const t = row.type as MemoryType;
      byType[t] = (byType[t] ?? 0) + 1;
      if (row.pinned) pinned += 1;
      totalImportance += row.importance;
    }
    const data: MemoryListResponse = {
      items: items.map((item) => toMemoryRecord({ ...item, type: item.type as MemoryType })),
      total,
      stats: {
        pinned,
        byType,
        averageImportance: allStats.length ? Math.round((totalImportance / allStats.length) * 100) / 100 : 0,
      },
    };
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/user/memories — cria memoria manual, util para regras pessoais. */
userRouter.post("/memories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = memoryCreateSchema.parse(req.body);
    const memory = await prisma.memory.create({
      data: { ...body, userId: req.user.id, embedding: [] },
    });
    res.json({ ok: true, data: toMemoryRecord({ ...memory, type: memory.type as MemoryType }) });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/user/memories/:id — corrige conteudo/importancia/fixacao. */
userRouter.patch("/memories/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    const body = memoryUpdateSchema.parse(req.body);
    const owned = await prisma.memory.findFirst({ where: { id, userId: req.user.id }, select: { id: true } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Memoria nao encontrada.");
    const memory = await prisma.memory.update({ where: { id }, data: body });
    res.json({ ok: true, data: toMemoryRecord({ ...memory, type: memory.type as MemoryType }) });
  } catch (err) {
    next(err);
  }
});

/** DELETE /v1/user/memories/:id — remove aprendizado incorreto. */
userRouter.delete("/memories/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    const deleted = await prisma.memory.deleteMany({ where: { id, userId: req.user.id } });
    if (deleted.count === 0) throw new ApiError(404, "NOT_FOUND", "Memoria nao encontrada.");
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/user/mode — troca de modo (STARK/NORMAL/SILENCIOSO). */
const modeSchema = z.object({
  mode: z.enum(["SILENCIOSO", "NORMAL", "STARK"]),
});
userRouter.patch("/mode", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { mode } = modeSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { mode },
      select: { id: true, mode: true },
    });
    res.json({ ok: true, data: user });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/user/preferences — atualiza/insere uma preferência. */
const prefSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  layer: z.enum(["current", "nostalgia", "exploration"]).default("current"),
  confidence: z.number().min(0).max(1).default(0.5),
});
userRouter.patch("/preferences", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const data = prefSchema.parse(req.body);
    const pref = await prisma.userPreference.upsert({
      where: { userId_key_layer: { userId: req.user.id, key: data.key, layer: data.layer } },
      create: { ...data, userId: req.user.id },
      update: { value: data.value, confidence: data.confidence },
    });
    res.json({ ok: true, data: pref });
  } catch (err) {
    next(err);
  }
});

export default userRouter;

// ─── Push Notifications ───────────────────────────────────────────

import { savePushSubscription, removePushSubscription, getVapidPublicKey } from "../modules/push.service.js";

userRouter.get("/push/vapid-key", (_req, res) => {
  const key = getVapidPublicKey();
  res.json({ ok: true, data: { publicKey: key } });
});

userRouter.post("/push/subscribe", async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ ok: false }); return; }
    const { endpoint, keys } = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ ok: false, error: "endpoint and keys required" });
      return;
    }
    await savePushSubscription(req.user.id, { endpoint, keys });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

userRouter.delete("/push/subscribe", async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ ok: false }); return; }
    await removePushSubscription(req.user.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Momentum Score ──────────────────────────────────────────────

import { getMomentumScore } from "../modules/momentum.service.js";

userRouter.get("/momentum", async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ ok: false }); return; }
    const data = await getMomentumScore(req.user.id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

// ─── Day Prediction ──────────────────────────────────────────────

import { predictDay } from "../proactive/predictive-engine.js";

userRouter.get("/prediction", async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ ok: false }); return; }
    const data = await predictDay(req.user.id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});
