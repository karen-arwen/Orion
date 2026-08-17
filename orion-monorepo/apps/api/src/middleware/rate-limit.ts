import type { Request, Response, NextFunction } from "express";
import { redis } from "../db/redis.js";

/* ═══════════════════════════════════════════════════════════════════
   RATE LIMITING — protege rotas críticas contra abuso.

   Usa Redis sliding window. Cada rota pode ter seu próprio limite.
   Headers padrão: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After.

   Limites por plano:
   FREE:       20 msgs/min chat, 5 execuções/h dev, 100 push/dia
   PRO:        60 msgs/min chat, 20 execuções/h dev, 500 push/dia
   ENTERPRISE: 200 msgs/min chat, 100 execuções/h dev, unlimited push
═══════════════════════════════════════════════════════════════════ */

interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
}

const PLAN_MULTIPLIER: Record<string, number> = {
  FREE: 1,
  PRO: 3,
  ENTERPRISE: 10,
};

function getLimit(base: number, plan?: string): number {
  return base * (PLAN_MULTIPLIER[plan ?? "FREE"] ?? 1);
}

export function rateLimit(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) { next(); return; }

    const plan = (req.user as Record<string, unknown> | undefined)?.plan as string | undefined;
    const limit = getLimit(config.maxRequests, plan);
    const key = `rl:${config.keyPrefix}:${userId}`;
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    try {
      // Sliding window with Redis sorted set
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, now - windowMs);
      pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
      pipeline.zcard(key);
      pipeline.expire(key, config.windowSeconds + 10);
      const results = await pipeline.exec();

      const count = (results?.[2]?.[1] as number) ?? 0;
      const remaining = Math.max(0, limit - count);

      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000));

      if (count > limit) {
        const retryAfter = Math.ceil(config.windowSeconds / 2);
        res.setHeader("Retry-After", retryAfter);
        res.status(429).json({
          ok: false,
          error: "Rate limit exceeded",
          retryAfter,
          limit,
          windowSeconds: config.windowSeconds,
        });
        return;
      }
    } catch (err) {
      // If Redis fails, allow the request (fail open)
      console.warn("[rate-limit] Redis error, allowing request:", (err as Error).message);
    }

    next();
  };
}

// ─── Pre-configured rate limiters ─────────────────────────────────

/** Chat: 20 msgs/min (FREE), 60 (PRO), 200 (ENTERPRISE) */
export const chatRateLimit = rateLimit({
  keyPrefix: "chat",
  windowSeconds: 60,
  maxRequests: 20,
});

/** DEV Executor: 5 executions/hour */
export const devExecutorRateLimit = rateLimit({
  keyPrefix: "dev",
  windowSeconds: 3600,
  maxRequests: 5,
});

/** Push subscription: 10/min (prevent spam) */
export const pushRateLimit = rateLimit({
  keyPrefix: "push",
  windowSeconds: 60,
  maxRequests: 10,
});

/** General API: 120 requests/min */
export const generalRateLimit = rateLimit({
  keyPrefix: "api",
  windowSeconds: 60,
  maxRequests: 120,
});

/** Claude-heavy endpoints: 10/min (morning brief, weekly review, behavioral analysis) */
export const aiHeavyRateLimit = rateLimit({
  keyPrefix: "ai_heavy",
  windowSeconds: 60,
  maxRequests: 10,
});
