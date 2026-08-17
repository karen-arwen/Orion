import { Queue, type QueueOptions } from "bullmq";
import { redis } from "../db/redis.js";

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
export const cognitiveQueue: Queue = new Queue("cognitive", defaultOpts);

export const JOB_NAMES = {
  RUN_AUTOMATION: "run_automation",
  CONFIRMATION_TIMEOUT: "confirmation_timeout",
  DETECT_ALERTS: "detect_alerts",
  PROACTIVE_PULSE: "proactive_pulse",
  EXPIRE_ALERTS: "expire_alerts",
  COGNITIVE_MICRO: "cognitive_micro",
  COGNITIVE_PULSE: "cognitive_pulse",
  COGNITIVE_DEEP: "cognitive_deep",
  TRIGGER_ENGINE: "trigger_engine",
} as const;

export async function registerRepeatingJobs(): Promise<void> {
  await alertQueue.add(
    JOB_NAMES.DETECT_ALERTS,
    {},
    { repeat: { pattern: "0 * * * *", tz: "America/Sao_Paulo" }, jobId: "detect_alerts_hourly" },
  );

  await alertQueue.add(
    JOB_NAMES.EXPIRE_ALERTS,
    {},
    { repeat: { pattern: "*/15 * * * *", tz: "America/Sao_Paulo" }, jobId: "expire_alerts_15min" },
  );

  await cognitiveQueue.add(
    JOB_NAMES.COGNITIVE_MICRO,
    { cycle: "micro" },
    { repeat: { pattern: "*/15 * * * *", tz: "America/Sao_Paulo" }, jobId: "cognitive_micro_15min" },
  );

  await cognitiveQueue.add(
    JOB_NAMES.COGNITIVE_PULSE,
    { cycle: "pulse" },
    { repeat: { pattern: "5 * * * *", tz: "America/Sao_Paulo" }, jobId: "cognitive_pulse_1h" },
  );

  await cognitiveQueue.add(
    JOB_NAMES.COGNITIVE_DEEP,
    { cycle: "deep" },
    { repeat: { pattern: "0 7 * * *", tz: "America/Sao_Paulo" }, jobId: "cognitive_deep_7h" },
  );

  await cognitiveQueue.add(
    JOB_NAMES.TRIGGER_ENGINE,
    {},
    { repeat: { pattern: "*/15 * * * *", tz: "America/Sao_Paulo" }, jobId: "trigger_engine_15min" },
  );

  console.log(
    "BullMQ repeating jobs:\n" +
    "  detect_alerts (1h) | expire_alerts (15min)\n" +
    "  cognitive_micro (15min) | cognitive_pulse (1h) | cognitive_deep (7h)\n" +
    "  trigger_engine (15min)"
  );
}
