import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * Redis client compartilhado.
 * Usado pra: cache de conversa curta, rate-limit, queues do Bull.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
});

redis.on("error", (err: Error) => {
  console.error("[redis] erro:", err.message);
});

redis.on("connect", () => {
  if (env.NODE_ENV === "development") {
    console.log("◉ Redis conectado");
  }
});
