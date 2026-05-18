import { Worker, type Job } from "bullmq";
import { redis } from "../db/redis.js";
import { JOB_NAMES } from "./index.js";
import { runAutomation } from "../automations/engine.js";
import { detectForAllUsers, expireOldAlerts } from "../alerts/detector.js";

/* ═══════════════════════════════════════════════════════════════════
   Workers BullMQ — rodam no MESMO processo do server.

   Decisão: 1 worker por queue. Concurrency limitada pra não estourar
   limites das APIs externas (Anthropic, Google).
═══════════════════════════════════════════════════════════════════ */

interface AutomationJobData {
  automationId: string;
  manual?: boolean;
  confirmed?: boolean;
}

let _workers: Worker[] = [];

export function startWorkers(): void {
  // ── Automation worker ─────────────────────────────────────────
  const automationWorker = new Worker(
    "automation",
    async (job: Job<AutomationJobData>) => {
      if (job.name === JOB_NAMES.RUN_AUTOMATION) {
        const log = await runAutomation(job.data.automationId, {
          manual: job.data.manual,
          confirmed: job.data.confirmed,
        });
        return { logId: log.id, status: log.status };
      }
      return { skipped: true };
    },
    { connection: redis, concurrency: 3 },
  );

  automationWorker.on("failed", (job, err) => {
    console.warn(`[worker:automation] ${job?.id} falhou:`, err.message);
  });

  // ── Alert worker ──────────────────────────────────────────────
  const alertWorker = new Worker(
    "alert",
    async (job: Job) => {
      if (job.name === JOB_NAMES.DETECT_ALERTS) {
        const result = await detectForAllUsers();
        console.log(`[worker:alert] detect_alerts: ${result.scanned} scanned, ${result.failed} failed`);
        return result;
      }
      if (job.name === JOB_NAMES.EXPIRE_ALERTS) {
        const result = await expireOldAlerts();
        if (result.expired > 0) console.log(`[worker:alert] expirou ${result.expired} alertas`);
        return result;
      }
      if (job.name === JOB_NAMES.CONFIRMATION_TIMEOUT) {
        // Timeout de confirmação — placeholder (engine já trata via expiresAt do alert)
        return { skipped: true };
      }
      return { skipped: true };
    },
    { connection: redis, concurrency: 1 },
  );

  alertWorker.on("failed", (job, err) => {
    console.warn(`[worker:alert] ${job?.id} falhou:`, err.message);
  });

  // ── Memory worker (placeholder pra futuras tarefas pesadas) ───
  const memoryWorker = new Worker(
    "memory",
    async (job: Job) => {
      // Extração de memória ainda roda inline em ai.service via fire-and-forget.
      // Quando for ficar pesada (>10k memórias), migra pra cá.
      return { skipped: true, jobName: job.name };
    },
    { connection: redis, concurrency: 2 },
  );

  _workers = [automationWorker, alertWorker, memoryWorker];
  console.log("◉ BullMQ workers ativos: automation, alert, memory");
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(_workers.map((w) => w.close()));
  _workers = [];
}
