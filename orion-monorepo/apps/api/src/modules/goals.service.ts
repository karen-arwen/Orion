import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   GOAL TRACKING — metas de longo prazo com milestones.
   Uses Project model for core + UserPreference for metadata.
═══════════════════════════════════════════════════════════════════ */

interface GoalMilestone {
  id: string;
  title: string;
  targetDate: string | null;
  completed: boolean;
  completedAt: string | null;
}

interface Goal {
  id: string;
  name: string;
  description: string;
  category: string;
  progress: number;
  targetDate: string | null;
  milestones: GoalMilestone[];
  createdAt: string;
  status: string;
}

async function getGoalMeta(userId: string, goalId: string): Promise<Record<string, unknown>> {
  const pref = await prisma.userPreference.findFirst({
    where: { userId, key: "goal_meta_" + goalId },
  }).catch(() => null);
  if (!pref) return {};
  try { return JSON.parse(pref.value) as Record<string, unknown>; } catch { return {}; }
}

async function setGoalMeta(userId: string, goalId: string, meta: Record<string, unknown>): Promise<void> {
  const key = "goal_meta_" + goalId;
  await prisma.userPreference.upsert({
    where: { userId_key_layer: { userId, key, layer: "current" } },
    update: { value: JSON.stringify(meta) },
    create: { userId, key, value: JSON.stringify(meta), layer: "current", confidence: 1 },
  });
}

export async function listGoals(userId: string): Promise<Goal[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  const goals: Goal[] = [];
  for (const p of projects) {
    const meta = await getGoalMeta(userId, p.id);
    goals.push({
      id: p.id,
      name: p.name,
      description: (meta.description as string) ?? "",
      category: (meta.category as string) ?? "personal",
      progress: p.progress,
      targetDate: (meta.targetDate as string) ?? null,
      milestones: (meta.milestones as GoalMilestone[]) ?? [],
      createdAt: p.createdAt.toISOString(),
      status: p.progress >= 100 ? "completed" : p.status === "archived" ? "paused" : "active",
    });
  }
  return goals;
}

export async function createGoal(userId: string, input: {
  name: string;
  description?: string;
  category?: string;
  targetDate?: string;
  milestones?: Array<{ title: string; targetDate?: string }>;
  color?: string;
}): Promise<Goal> {
  const milestones: GoalMilestone[] = (input.milestones ?? []).map((m, i) => ({
    id: "ms_" + Date.now() + "_" + i,
    title: m.title,
    targetDate: m.targetDate ?? null,
    completed: false,
    completedAt: null,
  }));

  const project = await prisma.project.create({
    data: {
      userId,
      name: input.name,
      color: input.color ?? "#00D4FF",
      progress: 0,
      status: "active",
    },
  });

  await setGoalMeta(userId, project.id, {
    description: input.description ?? "",
    category: input.category ?? "personal",
    targetDate: input.targetDate ?? null,
    milestones,
    isGoal: true,
  });

  return {
    id: project.id,
    name: project.name,
    description: input.description ?? "",
    category: input.category ?? "personal",
    progress: 0,
    targetDate: input.targetDate ?? null,
    milestones,
    createdAt: project.createdAt.toISOString(),
    status: "active",
  };
}

export async function completeMilestone(userId: string, goalId: string, milestoneId: string): Promise<void> {
  const meta = await getGoalMeta(userId, goalId);
  const milestones = (meta.milestones as GoalMilestone[]) ?? [];
  const updated = milestones.map((m) =>
    m.id === milestoneId ? { ...m, completed: true, completedAt: new Date().toISOString() } : m,
  );
  const completedCount = updated.filter((m) => m.completed).length;
  const newProgress = updated.length > 0 ? Math.round((completedCount / updated.length) * 100) : 0;

  await setGoalMeta(userId, goalId, { ...meta, milestones: updated });
  await prisma.project.updateMany({
    where: { id: goalId, userId },
    data: { progress: newProgress, status: newProgress >= 100 ? "completed" : "active" },
  });
}

export async function getGoalInsights(userId: string, goalId: string): Promise<{
  daysActive: number;
  progressPerWeek: number;
  estimatedCompletion: string | null;
  onTrack: boolean;
}> {
  const project = await prisma.project.findFirst({ where: { id: goalId, userId } });
  if (!project) return { daysActive: 0, progressPerWeek: 0, estimatedCompletion: null, onTrack: false };

  const daysActive = Math.max(1, Math.floor((Date.now() - project.createdAt.getTime()) / (24 * 3600 * 1000)));
  const progressPerWeek = (project.progress / daysActive) * 7;
  const remaining = 100 - project.progress;
  const daysToComplete = progressPerWeek > 0 ? Math.ceil((remaining / progressPerWeek) * 7) : null;
  const estimatedCompletion = daysToComplete
    ? new Date(Date.now() + daysToComplete * 24 * 3600 * 1000).toISOString().slice(0, 10)
    : null;

  const meta = await getGoalMeta(userId, goalId);
  const targetDate = meta.targetDate as string | null;
  const onTrack = !targetDate || !estimatedCompletion || estimatedCompletion <= targetDate;

  return { daysActive, progressPerWeek: Math.round(progressPerWeek * 10) / 10, estimatedCompletion, onTrack };
}
