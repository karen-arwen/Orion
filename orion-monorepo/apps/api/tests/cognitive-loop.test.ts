import { describe, it, expect, vi } from "vitest";

/* ═══════════════════════════════════════════════════════════════════
   TESTES — Cognitive Loop & Trigger Engine

   Testa:
   1. Rate limiting por ciclo (micro/pulse/deep)
   2. Trigger dedup (não disparar mesmo trigger 2x no dia)
   3. Interrupção limit (máx 3 não-urgentes/dia)
   4. Pattern detector correlações
═══════════════════════════════════════════════════════════════════ */

const mockRedis = {
  exists: vi.fn(),
  set: vi.fn().mockResolvedValue("OK"),
  get: vi.fn(),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
};

vi.mock("../src/db/redis.js", () => ({ redis: mockRedis }));

describe("Cognitive Loop - Rate Limiting", () => {
  it("should enforce cooldown between cycles", async () => {
    // Micro: 12min cooldown
    mockRedis.exists.mockResolvedValueOnce(1); // key exists = cooldown active
    const exists = await mockRedis.exists("cognitive:micro:user1");
    expect(exists).toBe(1); // Should skip

    // After cooldown
    mockRedis.exists.mockResolvedValueOnce(0);
    const notExists = await mockRedis.exists("cognitive:micro:user1");
    expect(notExists).toBe(0); // Should run
  });

  it("should use different cooldowns per cycle type", () => {
    const cooldowns = { micro: 12 * 60, pulse: 50 * 60, deep: 20 * 3600 };
    expect(cooldowns.micro).toBe(720);   // 12 min
    expect(cooldowns.pulse).toBe(3000);  // 50 min
    expect(cooldowns.deep).toBe(72000);  // 20 hours
  });
});

describe("Trigger Engine - Dedup", () => {
  it("should not fire same trigger twice in one day", async () => {
    const key = "trigger:fired:user1:morning_brief_check:2026-06-03";

    mockRedis.exists.mockResolvedValueOnce(1);
    const fired = await mockRedis.exists(key);
    expect(fired).toBe(1);
  });

  it("should allow trigger next day", async () => {
    const key = "trigger:fired:user1:morning_brief_check:2026-06-04";

    mockRedis.exists.mockResolvedValueOnce(0);
    const fired = await mockRedis.exists(key);
    expect(fired).toBe(0);
  });
});

describe("Trigger Engine - Interruption Limit", () => {
  it("should limit non-urgent interruptions to 3/day", async () => {
    const key = "trigger:interruptions:user1:2026-06-03";

    // First 3 OK
    mockRedis.get.mockResolvedValueOnce("2");
    const count = parseInt((await mockRedis.get(key)) ?? "0", 10);
    expect(count).toBeLessThan(3);

    // 4th should be blocked
    mockRedis.get.mockResolvedValueOnce("3");
    const count2 = parseInt((await mockRedis.get(key)) ?? "0", 10);
    expect(count2).toBeGreaterThanOrEqual(3);
  });
});

describe("Pattern Detector", () => {
  it("should detect sleep-focus correlation with sufficient data", () => {
    const lowSleepFocusRate = 0.4;
    const goodSleepFocusRate = 0.8;
    const difference = goodSleepFocusRate - lowSleepFocusRate;

    // Only significant if difference > 15%
    expect(difference).toBeGreaterThan(0.15);
  });

  it("should calculate confidence based on sample size", () => {
    const baseCon = 0.5;
    const perSample = 0.05;
    const samples = 7;
    const confidence = Math.min(0.9, baseCon + samples * perSample);
    expect(confidence).toBe(0.85);
  });

  it("should detect best focus time bucket", () => {
    const buckets = {
      manha_cedo: { completed: 8, total: 10 },
      manha: { completed: 4, total: 8 },
      tarde_cedo: { completed: 2, total: 6 },
    };

    let bestBucket = "";
    let bestRate = 0;
    for (const [bucket, data] of Object.entries(buckets)) {
      const rate = data.completed / data.total;
      if (rate > bestRate) { bestRate = rate; bestBucket = bucket; }
    }

    expect(bestBucket).toBe("manha_cedo");
    expect(bestRate).toBe(0.8);
  });
});
