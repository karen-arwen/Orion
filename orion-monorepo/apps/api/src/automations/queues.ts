import { Queue, Worker, type JobsOptions } from "bullmq";
import { redis } from "../db/redis.js";

export interface AutomationJobData {
  automationId: string;
  userId: string;
  source: "cron" | "event" | "behavioral" | "contextual" | "manual";
}

export interface MemoryJobData {
  userId: string;
  userMessage: string;
  assistantMessage: string;
}

export interface AlertJobData {
  userId: string;
  reason: string;
}

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 1000 },
};

export const automationQueue = new Queue<AutomationJobData>("automation-queue", {
  connection: redis,
  defaultJobOptions,
});

export const memoryQueue = new Queue<MemoryJobData>("memory-queue", {
  connection: redis,
  defaultJobOptions,
});

export const alertQueue = new Queue<AlertJobData>("alert-queue", {
  connection: redis,
  defaultJobOptions,
});

let workersStarted = false;

export function startAutomationWorkers(): void {
  if (workersStarted) return;
  workersStarted = true;

  const worker = new Worker<AutomationJobData>(
    "automation-queue",
    async (job) => {
      const { executeAutomationJob } = await import("./automation.service.js");
      return executeAutomationJob(job.data);
    },
    { connection: redis, concurrency: 3 },
  );

  worker.on("failed", (job, err) => {
    console.warn(`[automation-worker] job ${job?.id ?? "unknown"} falhou:`, err.message);
  });
}
