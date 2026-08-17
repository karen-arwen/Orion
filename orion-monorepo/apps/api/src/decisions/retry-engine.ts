import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { executeInternalAction } from "./action-executor.js";
import { executeExternalAction } from "./external-action-executor.js";

/* ═══════════════════════════════════════════════════════════════════
   RETRY ENGINE — recuperação inteligente de ações falhadas.

   Quando uma ação externa falha (Slack fora do ar, token expirado,
   API rate limited), o retry engine:

   1. Registra a falha com contexto
   2. Agenda retry com backoff exponencial (30s, 1min, 5min, 15min)
   3. Após 4 tentativas, marca como falha permanente
   4. Notifica o usuário via ProactiveAlert

   Usa Redis para tracking de retries e BullMQ-compatible scheduling.
═══════════════════════════════════════════════════════════════════ */

const MAX_RETRIES = 4;
const BACKOFF_SECONDS = [30, 60, 300, 900]; // 30s, 1min, 5min, 15min

interface RetryRecord {
  decisionId: string;
  userId: string;
  attempt: number;
  lastError: string;
  nextRetryAt: number; // timestamp ms
  payload: Record<string, unknown>;
}

/** Registra uma falha e agenda retry */
export async function scheduleRetry(
  decisionId: string,
  userId: string,
  error: string,
  payload: Record<string, unknown>,
): Promise<{ scheduled: boolean; attempt: number; nextRetryAt: Date | null }> {
  const key = `retry:${decisionId}`;
  const existing = await redis.get(key).catch(() => null);

  let record: RetryRecord;
  if (existing) {
    record = JSON.parse(existing) as RetryRecord;
    record.attempt++;
    record.lastError = error;
  } else {
    record = {
      decisionId,
      userId,
      attempt: 1,
      lastError: error,
      nextRetryAt: 0,
      payload,
    };
  }

  if (record.attempt > MAX_RETRIES) {
    // Permanent failure — notify user
    await redis.del(key);
    await notifyPermanentFailure(userId, decisionId, error);
    return { scheduled: false, attempt: record.attempt, nextRetryAt: null };
  }

  const backoffIndex = Math.min(record.attempt - 1, BACKOFF_SECONDS.length - 1);
  const delaySec = BACKOFF_SECONDS[backoffIndex]!;
  record.nextRetryAt = Date.now() + delaySec * 1000;

  // Store in Redis with TTL
  await redis.set(key, JSON.stringify(record), "EX", delaySec + 60);

  // Also add to retry queue set (sorted by nextRetryAt)
  await redis.zadd("retry:queue", record.nextRetryAt, decisionId);

  console.log(`[retry] Scheduled retry #${record.attempt} for decision ${decisionId} in ${delaySec}s`);

  return {
    scheduled: true,
    attempt: record.attempt,
    nextRetryAt: new Date(record.nextRetryAt),
  };
}

/** Processa retries pendentes (chamado pelo worker a cada 30s) */
export async function processRetryQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = Date.now();
  const dueIds = await redis.zrangebyscore("retry:queue", 0, now, "LIMIT", 0, 10);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const decisionId of dueIds) {
    const key = `retry:${decisionId}`;
    const raw = await redis.get(key).catch(() => null);
    if (!raw) {
      await redis.zrem("retry:queue", decisionId);
      continue;
    }

    const record = JSON.parse(raw) as RetryRecord;
    processed++;

    try {
      // Re-attempt execution
      const decision = await prisma.decisionItem.findUnique({
        where: { id: decisionId },
      });

      if (!decision || decision.status === "executed" || decision.status === "dismissed") {
        await redis.del(key);
        await redis.zrem("retry:queue", decisionId);
        continue;
      }

      const payload = (decision.payload ?? record.payload) as Record<string, unknown>;
      const execution = (await executeInternalAction(record.userId, payload))
        ?? (await executeExternalAction(payload));

      if (execution) {
        // Success!
        await prisma.decisionItem.update({
          where: { id: decisionId },
          data: {
            status: "executed",
            payload: {
              ...payload,
              execution: {
                ...(typeof execution === "object" ? execution : {}),
                executedAt: new Date().toISOString(),
                retryAttempt: record.attempt,
              },
            },
          },
        });
        await redis.del(key);
        await redis.zrem("retry:queue", decisionId);
        succeeded++;
        console.log(`[retry] Decision ${decisionId} succeeded on attempt #${record.attempt}`);
      } else {
        // Still failing — schedule next retry
        await scheduleRetry(decisionId, record.userId, "execution returned null", payload);
        failed++;
      }
    } catch (err) {
      const msg = (err as Error).message;
      await scheduleRetry(decisionId, record.userId, msg, record.payload);
      failed++;
      console.warn(`[retry] Decision ${decisionId} attempt #${record.attempt} failed:`, msg);
    }
  }

  return { processed, succeeded, failed };
}

/** Notifica o usuário sobre falha permanente */
async function notifyPermanentFailure(userId: string, decisionId: string, error: string): Promise<void> {
  const decision = await prisma.decisionItem.findUnique({ where: { id: decisionId } }).catch(() => null);
  const title = decision?.title ?? "Acao externa";

  await prisma.decisionItem.update({
    where: { id: decisionId },
    data: {
      status: "dismissed",
      payload: {
        ...((decision?.payload ?? {}) as Record<string, unknown>),
        failureReason: error,
        failedAt: new Date().toISOString(),
        maxRetriesExceeded: true,
      },
    },
  }).catch(() => {});

  await prisma.proactiveAlert.create({
    data: {
      userId,
      module: "system",
      icon: "ERR",
      color: "#EF4444",
      title: "Acao falhou: " + title.slice(0, 60),
      text: `"${title}" falhou apos ${MAX_RETRIES} tentativas. Ultimo erro: ${error.slice(0, 200)}. Tente novamente manualmente ou verifique a integracao.`,
      action: "Abrir Notificacoes",
      priority: "high",
      dedupKey: `retry_fail_${decisionId}`,
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    },
  }).catch(() => {});

  console.warn(`[retry] PERMANENT FAILURE for decision ${decisionId}: ${error}`);
}

/** Retorna status de retries pendentes para um usuário */
export async function getRetryStatus(userId: string): Promise<Array<{
  decisionId: string;
  attempt: number;
  lastError: string;
  nextRetryAt: Date;
}>> {
  const allKeys = await redis.zrange("retry:queue", 0, -1);
  const results: Array<{ decisionId: string; attempt: number; lastError: string; nextRetryAt: Date }> = [];

  for (const decisionId of allKeys) {
    const raw = await redis.get(`retry:${decisionId}`).catch(() => null);
    if (!raw) continue;
    const record = JSON.parse(raw) as RetryRecord;
    if (record.userId === userId) {
      results.push({
        decisionId: record.decisionId,
        attempt: record.attempt,
        lastError: record.lastError,
        nextRetryAt: new Date(record.nextRetryAt),
      });
    }
  }

  return results;
}
