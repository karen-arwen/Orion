import { Worker, type Job } from "bullmq";
import { redis } from "../db/redis.js";
import { JOB_NAMES } from "./index.js";
import { runAutomation } from "../automations/engine.js";
import { detectForAllUsers, expireOldAlerts } from "../alerts/detector.js";
import { runCognitiveLoopForAll } from "../proactive/cognitive-loop.js";
import type { CycleType } from "../proactive/cognitive-loop.js";
import { runTriggerEngineForAll } from "../proactive/trigger-engine.js";
import { processRetryQueue } from "../decisions/retry-engine.js";

interface AutomationJobData {
  automationId: string;
  manual?: boolean;
  confirmed?: boolean;
}

interface CognitiveJobData {
  cycle: CycleType;
}

let _workers: Worker[] = [];

export function startWorkers(): void {
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
      return { skipped: true };
    },
    { connection: redis, concurrency: 1 },
  );
  alertWorker.on("failed", (job, err) => {
    console.warn(`[worker:alert] ${job?.id} falhou:`, err.message);
  });

  const cognitiveWorker = new Worker(
    "cognitive",
    async (job: Job<CognitiveJobData>) => {
      if (
        job.name === JOB_NAMES.COGNITIVE_MICRO ||
        job.name === JOB_NAMES.COGNITIVE_PULSE ||
        job.name === JOB_NAMES.COGNITIVE_DEEP
      ) {
        const cycle = job.data?.cycle;
        if (!cycle) return { skipped: true };
        const result = await runCognitiveLoopForAll(cycle);
        console.log(
          `[worker:cognitive] ${cycle}: scanned=${result.scanned} executed=${result.executed} actions=${result.totalActions}`
        );
        return result;
      }
      if (job.name === JOB_NAMES.TRIGGER_ENGINE) {
        const result = await runTriggerEngineForAll();
        if (result.fired > 0) {
          console.log(`[worker:cognitive] trigger_engine: scanned=${result.scanned} fired=${result.fired}`);
        }
        return result;
      }
      return { skipped: true };
    },
    { connection: redis, concurrency: 2 },
  );
  cognitiveWorker.on("failed", (job, err) => {
    console.warn(`[worker:cognitive] ${job?.id} falhou:`, err.message);
  });

  const memoryWorker = new Worker(
    "memory",
    async (job: Job) => {
      return { skipped: true, jobName: job.name };
    },
    { connection: redis, concurrency: 2 },
  );

  _workers = [automationWorker, alertWorker, cognitiveWorker, memoryWorker];
  console.log("BullMQ workers ativos: automation, alert, cognitive, memory");
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(_workers.map((w) => w.close()));
  _workers = [];
}
