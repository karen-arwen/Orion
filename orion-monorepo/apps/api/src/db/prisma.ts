import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

/**
 * Singleton do Prisma — em dev evita criar várias conexões a cada hot-reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
