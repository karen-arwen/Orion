import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import type { AlertPriority } from "@orion/types";

/* ═══════════════════════════════════════════════════════════════════
   DAILY DIGEST — resumo do dia enviado às 22h.

   O que foi feito, o que ficou pendente, insights do dia.
   Funciona como counterpart do Morning Brief.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const DIGEST_SYSTEM = "Voce e o O.R.I.O.N fazendo o encerramento do dia do usuario. Tom de parceiro que se importa. Conciso, max 4 paragrafos. Celebre o que foi feito, aponte pendencias sem culpar, sugira como dormir bem e preparar o amanha. Sem JSON, texto puro.";

export async function generateDailyDigest(userId: string): Promise<string | null> {
  const todayKey = "daily_digest:" + userId + ":" + new Date().toISOString().slice(0, 10);
  const cached = await redis.get(todayKey).catch(() => null);
  if (cached) return cached;

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [user, tasksCompleted, tasksPending, focusSessions, habitLogs, conversations, alertsHandled] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.task.count({ where: { userId, status: "done", updatedAt: { gte: todayStart } } }),
    prisma.task.count({ where: { userId, status: { in: ["todo", "doing"] } } }),
    prisma.focusSession.findMany({ where: { userId, startedAt: { gte: todayStart } }, take: 20 }),
    prisma.habitLog.count({ where: { habit: { userId }, createdAt: { gte: todayStart } } }),
    prisma.conversation.count({ where: { userId, updatedAt: { gte: todayStart } } }),
    prisma.proactiveAlert.count({ where: { userId, dismissed: true, createdAt: { gte: todayStart } } }),
  ]);

  if (!user) return null;

  const focusMin = focusSessions.reduce((s, f) => s + (f.actualMinutes ?? f.duration), 0);
  const focusCompleted = focusSessions.filter((f) => f.completed).length;

  const prompt = "ENCERRAMENTO DO DIA para " + user.name + ":\n" +
    "Tarefas concluidas hoje: " + tasksCompleted + "\n" +
    "Tarefas pendentes: " + tasksPending + "\n" +
    "Foco: " + focusMin + "min em " + focusSessions.length + " sessoes (" + focusCompleted + " completas)\n" +
    "Habitos marcados hoje: " + habitLogs + "\n" +
    "Conversas com ORION hoje: " + conversations + "\n" +
    "Alertas tratados: " + alertsHandled + "\n" +
    "\nGere o encerramento do dia.";

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: DIGEST_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : null;
    if (text) await redis.set(todayKey, text, "EX", 12 * 3600).catch(() => {});
    return text;
  } catch (err) {
    console.warn("[daily-digest] Claude falhou:", (err as Error).message);
    return null;
  }
}

export async function createDailyDigestAlert(userId: string): Promise<void> {
  const digest = await generateDailyDigest(userId);
  if (!digest) return;

  const dedupKey = "daily_digest_" + new Date().toISOString().slice(0, 10);
  const exists = await prisma.proactiveAlert.findFirst({ where: { userId, dedupKey } }).catch(() => null);
  if (exists) return;

  await prisma.proactiveAlert.create({
    data: {
      userId,
      module: "life",
      icon: "DGT",
      color: "#7C3AED",
      title: "Encerramento do dia",
      text: digest,
      action: "Ver LIFE OS",
      priority: "low" as AlertPriority,
      dedupKey,
      expiresAt: new Date(Date.now() + 12 * 3600 * 1000),
    },
  });
}
