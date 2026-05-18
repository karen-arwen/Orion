import { Queue, type QueueOptions } from "bullmq";
import { redis } from "../db/redis.js";

/* ═══════════════════════════════════════════════════════════════════
   BullMQ queues centrais do O.R.I.O.N.

   Cada queue tem propósito claro:
   - automation:  cron jobs recorrentes + dispatch manual
   - alert:       detecção horária + auto-expiração
   - memory:      extração/recompute em background (futuro)

   Compartilhamos a conexão Redis com o resto da app. BullMQ exige
   que o cliente não use enableReadyCheck/maxRetriesPerRequest=null
   — nosso redis.ts já está com maxRetriesPerRequest:null.
═══════════════════════════════════════════════════════════════════ */

const defaultOpts: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: 24 * 3600, count: 200 },
    removeOnFail: { age: 7 * 24 * 3600, count: 100 },
  },
};

export const automationQueue: Queue = new Queue("automation", defaultOpts);
export const alertQueue: Queue = new Queue("alert", defaultOpts);
export const memoryQueue: Queue = new Queue("memory", defaultOpts);

/** Job names — uma string só pra evitar typos espalhados. */
export const JOB_NAMES = {
  /** Disparo de uma Automation pelo seu ID. data: { automationId, manual } */
  RUN_AUTOMATION: "run_automation",
  /** Verifica timeout de alertas pendentes de confirmação. data: { alertId } */
  CONFIRMATION_TIMEOUT: "confirmation_timeout",
  /** Detector horário que cria alerts pra todos os usuários elegíveis. */
  DETECT_ALERTS: "detect_alerts",
  /** Limpa alerts expirados. */
  EXPIRE_ALERTS: "expire_alerts",
} as const;

/** Repeating jobs do sistema — registrados no boot do server. */
export async function registerRepeatingJobs(): Promise<void> {
  // Detector de alertas: a cada hora cheia
  await alertQueue.add(
    JOB_NAMES.DETECT_ALERTS,
    {},
    {
      repeat: { pattern: "0 * * * *", tz: "America/Sao_Paulo" },
      jobId: "detect_alerts_hourly", // dedup global
    },
  );

  // Expiração de alertas: a cada 15 minutos
  await alertQueue.add(
    JOB_NAMES.EXPIRE_ALERTS,
    {},
    {
      repeat: { pattern: "*/15 * * * *", tz: "America/Sao_Paulo" },
      jobId: "expire_alerts_15min",
    },
  );

  console.log("◉ BullMQ repeating jobs registrados: detect_alerts (1h), expire_alerts (15min)");
}
