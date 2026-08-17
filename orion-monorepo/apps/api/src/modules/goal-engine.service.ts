import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   GOAL ENGINE — sistema robusto de metas com milestones,
   decomposicao automatica, recalculo de prazo e deteccao de abandono.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface GoalCreateInput {
  title: string;
  reason?: string;
  category?: string;
  priority?: number;
  deadline?: string;
  metric?: string;
  targetValue?: number;
}

export interface GoalUpdateInput {
  title?: string;
  reason?: string;
  category?: string;
  priority?: number;
  deadline?: string;
  currentValue?: number;
  status?: string;
  progress?: number;
}

export async function createGoal(userId: string, input: GoalCreateInput): Promise<unknown> {
  const goal = await prisma.goal.create({
    data: {
      userId,
      title: input.title,
      reason: input.reason,
      category: input.category ?? "geral",
      priority: input.priority ?? 5,
      deadline: input.deadline ? new Date(input.deadline) : null,
      metric: input.metric,
      targetValue: input.targetValue,
    },
    include: { milestones: true },
  });

  // Auto-decompose into milestones
  await autoDecompose(userId, goal.id, input.title, input.deadline);

  return prisma.goal.findUnique({ where: { id: goal.id }, include: { milestones: { orderBy: { order: "asc" } } } });
}

async function autoDecompose(userId: string, goalId: string, title: string, deadline?: string): Promise<void> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      temperature: 0.5,
      system: "Decomponha esta meta em 3-6 milestones concretos e ordenados. Devolva JSON: [{\"title\":\"milestone\",\"order\":1}]",
      messages: [{ role: "user", content: `Meta: ${title}${deadline ? ` (prazo: ${deadline})` : ""}` }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const first = text.indexOf("[");
    const last = text.lastIndexOf("]");
    if (first >= 0 && last > first) {
      const milestones = JSON.parse(text.slice(first, last + 1)) as Array<{ title: string; order: number }>;
      for (const m of milestones) {
        await prisma.goalMilestone.create({
          data: { goalId, title: m.title, order: m.order },
        });
      }
    }
  } catch {
    // Best-effort decomposition
  }
}

export async function updateGoal(userId: string, goalId: string, input: GoalUpdateInput): Promise<unknown> {
  return prisma.goal.updateMany({
    where: { id: goalId, userId },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.deadline ? { deadline: new Date(input.deadline) } : {}),
      ...(input.currentValue !== undefined ? { currentValue: input.currentValue } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
    },
  });
}

export async function listGoals(userId: string, status?: string): Promise<unknown[]> {
  return prisma.goal.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: { milestones: { orderBy: { order: "asc" } } },
    orderBy: [{ priority: "desc" }, { deadline: "asc" }],
  });
}

export async function completeMilestone(userId: string, milestoneId: string): Promise<void> {
  const milestone = await prisma.goalMilestone.findUnique({
    where: { id: milestoneId },
    include: { goal: true },
  });
  if (!milestone || milestone.goal.userId !== userId) throw new Error("Milestone nao encontrado");

  await prisma.goalMilestone.update({
    where: { id: milestoneId },
    data: { completed: true },
  });

  // Recalculate goal progress
  const allMilestones = await prisma.goalMilestone.findMany({ where: { goalId: milestone.goalId } });
  const completed = allMilestones.filter((m) => m.completed).length;
  const progress = Math.round((completed / allMilestones.length) * 100);

  await prisma.goal.update({
    where: { id: milestone.goalId },
    data: {
      progress,
      ...(progress === 100 ? { status: "completed" } : {}),
    },
  });
}

/** Detect abandoned goals (no progress in 14+ days) */
export async function detectAbandonedGoals(userId: string): Promise<Array<{ id: string; title: string; daysSinceUpdate: number }>> {
  const threshold = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const stale = await prisma.goal.findMany({
    where: {
      userId,
      status: "active",
      updatedAt: { lt: threshold },
    },
    select: { id: true, title: true, updatedAt: true },
  });

  return stale.map((g) => ({
    id: g.id,
    title: g.title,
    daysSinceUpdate: Math.round((Date.now() - g.updatedAt.getTime()) / (24 * 3600 * 1000)),
  }));
}
