import { prisma } from "../db/prisma.js";
import Anthropic from "@anthropic-ai/sdk";

/* ═══════════════════════════════════════════════════════════════
   PROJECTS ENHANCED SERVICE
   Core project data lives in prisma.project.
   Milestones + metadata stored in UserPattern:
     project_meta_<projectId>    -> ProjectMeta JSON
     project_ms_<projectId>_<id> -> Milestone JSON
     project_update_<projectId>_<ts> -> UpdateLog JSON
═══════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic();

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  dueDate?: string;          // ISO date string
  completed: boolean;
  completedAt?: string;
  order: number;
  createdAt: string;
}

export interface ProjectMeta {
  projectId: string;
  description?: string;
  dueDate?: string;
  startDate?: string;
  tags: string[];
  priority: "low" | "medium" | "high" | "critical";
  lastActivityAt: string;
  stalledDays?: number;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  note: string;
  progressDelta?: number;   // e.g. +10 = went from 30% to 40%
  createdAt: string;
}

export interface ProjectFull {
  id: string;
  name: string;
  color: string;
  progress: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  meta: ProjectMeta;
  milestones: Milestone[];
  updates: ProjectUpdate[];
  isStalled: boolean;
  nextMilestone?: Milestone;
  completedMilestones: number;
  totalMilestones: number;
  stalledDays: number;
}

/* ─── Helpers ─── */

function msKey(projectId: string, msId: string): string {
  return `project_ms_${projectId}_${msId}`;
}

function metaKey(projectId: string): string {
  return `project_meta_${projectId}`;
}

function updateKey(projectId: string, ts: string): string {
  return `project_update_${projectId}_${ts}`;
}

async function getMeta(userId: string, projectId: string): Promise<ProjectMeta> {
  const row = await prisma.userPattern.findUnique({
    where: { userId_patternType: { userId, patternType: metaKey(projectId) } },
  });
  if (row) {
    try { return JSON.parse(row.data as string) as ProjectMeta; } catch { /* fallback */ }
  }
  const now = new Date().toISOString();
  return { projectId, tags: [], priority: "medium", lastActivityAt: now };
}

async function saveMeta(userId: string, meta: ProjectMeta): Promise<void> {
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: metaKey(meta.projectId) } },
    update: { data: JSON.stringify(meta) },
    create: { userId, patternType: metaKey(meta.projectId), data: JSON.stringify(meta) },
  });
}

async function getMilestones(userId: string, projectId: string): Promise<Milestone[]> {
  const rows = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: `project_ms_${projectId}_` } },
    orderBy: { createdAt: "asc" },
  });
  const milestones: Milestone[] = [];
  for (const r of rows) {
    try { milestones.push(JSON.parse(r.data as string) as Milestone); } catch { /* skip */ }
  }
  return milestones.sort((a, b) => a.order - b.order);
}

async function getUpdates(userId: string, projectId: string): Promise<ProjectUpdate[]> {
  const rows = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: `project_update_${projectId}_` } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const updates: ProjectUpdate[] = [];
  for (const r of rows) {
    try { updates.push(JSON.parse(r.data as string) as ProjectUpdate); } catch { /* skip */ }
  }
  return updates;
}

function calcStalledDays(lastActivity: string, updatedAt: Date): number {
  const lastDate = new Date(Math.max(new Date(lastActivity).getTime(), updatedAt.getTime()));
  return Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}

/* ─── Public API ─── */

export async function listProjects(userId: string): Promise<ProjectFull[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  const results: ProjectFull[] = [];
  for (const p of projects) {
    const meta = await getMeta(userId, p.id);
    const milestones = await getMilestones(userId, p.id);
    const updates = await getUpdates(userId, p.id);
    const stalledDays = calcStalledDays(meta.lastActivityAt, p.updatedAt);
    const completedMilestones = milestones.filter(m => m.completed).length;
    const nextMilestone = milestones.find(m => !m.completed);

    results.push({
      id: p.id, name: p.name, color: p.color, progress: p.progress,
      status: p.status, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
      meta, milestones, updates,
      isStalled: stalledDays >= 7 && p.status !== "concluido",
      nextMilestone,
      completedMilestones,
      totalMilestones: milestones.length,
      stalledDays,
    });
  }
  return results;
}

export async function getProject(userId: string, id: string): Promise<ProjectFull | null> {
  const p = await prisma.project.findFirst({ where: { id, userId } });
  if (!p) return null;
  const meta = await getMeta(userId, p.id);
  const milestones = await getMilestones(userId, p.id);
  const updates = await getUpdates(userId, p.id);
  const stalledDays = calcStalledDays(meta.lastActivityAt, p.updatedAt);
  const completedMilestones = milestones.filter(m => m.completed).length;
  const nextMilestone = milestones.find(m => !m.completed);

  return {
    id: p.id, name: p.name, color: p.color, progress: p.progress,
    status: p.status, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    meta, milestones, updates,
    isStalled: stalledDays >= 7 && p.status !== "concluido",
    nextMilestone,
    completedMilestones,
    totalMilestones: milestones.length,
    stalledDays,
  };
}

export async function createProject(
  userId: string,
  input: { name: string; color?: string; description?: string; dueDate?: string; startDate?: string; priority?: "low" | "medium" | "high" | "critical"; tags?: string[] },
): Promise<ProjectFull> {
  const p = await prisma.project.create({
    data: { userId, name: input.name, color: input.color ?? "#00D4FF", progress: 0, status: "ativo" },
  });
  const now = new Date().toISOString();
  const meta: ProjectMeta = {
    projectId: p.id,
    description: input.description,
    dueDate: input.dueDate,
    startDate: input.startDate ?? now.slice(0, 10),
    tags: input.tags ?? [],
    priority: input.priority ?? "medium",
    lastActivityAt: now,
  };
  await saveMeta(userId, meta);
  return {
    id: p.id, name: p.name, color: p.color, progress: p.progress,
    status: p.status, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    meta, milestones: [], updates: [],
    isStalled: false, completedMilestones: 0, totalMilestones: 0, stalledDays: 0,
  };
}

export async function updateProject(
  userId: string,
  id: string,
  patch: { name?: string; color?: string; status?: string; progress?: number; description?: string; dueDate?: string; priority?: "low" | "medium" | "high" | "critical"; tags?: string[]; note?: string },
): Promise<ProjectFull> {
  const owned = await prisma.project.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Not found");

  const coreUpdate: Record<string, unknown> = {};
  if (patch.name) coreUpdate["name"] = patch.name;
  if (patch.color) coreUpdate["color"] = patch.color;
  if (patch.status) coreUpdate["status"] = patch.status;
  if (patch.progress !== undefined) coreUpdate["progress"] = patch.progress;

  const p = Object.keys(coreUpdate).length > 0
    ? await prisma.project.update({ where: { id }, data: coreUpdate })
    : owned;

  const meta = await getMeta(userId, id);
  meta.lastActivityAt = new Date().toISOString();
  if (patch.description !== undefined) meta.description = patch.description;
  if (patch.dueDate !== undefined) meta.dueDate = patch.dueDate;
  if (patch.priority) meta.priority = patch.priority;
  if (patch.tags) meta.tags = patch.tags;
  await saveMeta(userId, meta);

  // Log update if note provided
  if (patch.note) {
    const ts = Date.now().toString();
    const update: ProjectUpdate = {
      id: ts, projectId: id,
      note: patch.note,
      progressDelta: patch.progress !== undefined ? patch.progress - owned.progress : undefined,
      createdAt: new Date().toISOString(),
    };
    await prisma.userPattern.create({
      data: { userId, patternType: updateKey(id, ts), data: JSON.stringify(update) },
    });
  }

  const milestones = await getMilestones(userId, id);
  const updates = await getUpdates(userId, id);
  const stalledDays = calcStalledDays(meta.lastActivityAt, p.updatedAt);
  const completedMilestones = milestones.filter(m => m.completed).length;

  return {
    id: p.id, name: p.name, color: p.color, progress: p.progress,
    status: p.status, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    meta, milestones, updates,
    isStalled: stalledDays >= 7 && p.status !== "concluido",
    nextMilestone: milestones.find(m => !m.completed),
    completedMilestones, totalMilestones: milestones.length, stalledDays,
  };
}

export async function deleteProject(userId: string, id: string): Promise<void> {
  const owned = await prisma.project.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Not found");
  await prisma.project.delete({ where: { id } });
  // Clean up UserPattern keys
  await prisma.userPattern.deleteMany({
    where: { userId, patternType: { startsWith: `project_ms_${id}_` } },
  });
  await prisma.userPattern.deleteMany({
    where: { userId, patternType: { in: [metaKey(id)] } },
  });
  await prisma.userPattern.deleteMany({
    where: { userId, patternType: { startsWith: `project_update_${id}_` } },
  });
}

/* ─── Milestones ─── */

export async function addMilestone(
  userId: string,
  projectId: string,
  input: { title: string; description?: string; dueDate?: string },
): Promise<Milestone> {
  const existing = await getMilestones(userId, projectId);
  const id = `ms_${Date.now()}`;
  const ms: Milestone = {
    id, projectId,
    title: input.title,
    description: input.description,
    dueDate: input.dueDate,
    completed: false,
    order: existing.length,
    createdAt: new Date().toISOString(),
  };
  await prisma.userPattern.create({
    data: { userId, patternType: msKey(projectId, id), data: JSON.stringify(ms) },
  });

  // Update lastActivity
  const meta = await getMeta(userId, projectId);
  meta.lastActivityAt = new Date().toISOString();
  await saveMeta(userId, meta);

  // Auto-recalc progress
  await autoProgress(userId, projectId);

  return ms;
}

export async function completeMilestone(userId: string, projectId: string, msId: string): Promise<Milestone> {
  const row = await prisma.userPattern.findUnique({
    where: { userId_patternType: { userId, patternType: msKey(projectId, msId) } },
  });
  if (!row) throw new Error("Milestone not found");
  const ms = JSON.parse(row.data as string) as Milestone;
  ms.completed = true;
  ms.completedAt = new Date().toISOString();
  await prisma.userPattern.update({ where: { id: row.id }, data: { data: JSON.stringify(ms) } });

  // Update lastActivity
  const meta = await getMeta(userId, projectId);
  meta.lastActivityAt = new Date().toISOString();
  await saveMeta(userId, meta);

  // Auto-recalc progress
  await autoProgress(userId, projectId);

  return ms;
}

export async function deleteMilestone(userId: string, projectId: string, msId: string): Promise<void> {
  await prisma.userPattern.deleteMany({
    where: { userId, patternType: msKey(projectId, msId) },
  });
  await autoProgress(userId, projectId);
}

async function autoProgress(userId: string, projectId: string): Promise<void> {
  const milestones = await getMilestones(userId, projectId);
  if (milestones.length === 0) return;
  const pct = Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100);
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return;
  // Only auto-update if milestones exist and override is significant
  await prisma.project.update({ where: { id: projectId }, data: { progress: pct } });
}

/* ─── AI: stall analysis ─── */

export async function analyzeStalled(userId: string): Promise<Array<{ projectId: string; name: string; stalledDays: number; suggestion: string }>> {
  const projects = await listProjects(userId);
  const stalled = projects.filter(p => p.isStalled && p.status !== "pausado");
  if (stalled.length === 0) return [];

  const prompt = `Voce e o ORION. O usuario tem ${stalled.length} projeto(s) parado(s). Para cada um, gere uma sugestao curta e pratica de como desbloquear.

PROJETOS PARADOS:
${stalled.map(p => `- "${p.name}" (${p.stalledDays} dias parado, progresso: ${p.progress}%, proximo marco: ${p.nextMilestone?.title ?? "nenhum"})`).join("\n")}

Responda APENAS com JSON array:
[{"projectId": "<id>", "suggestion": "<sugestao em 1 frase>"}, ...]

IDs: ${JSON.stringify(stalled.map(p => p.id))}`;

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as Array<{ projectId: string; suggestion: string }>) : [];
    return stalled.map(p => {
      const suggestion = parsed.find(x => x.projectId === p.id)?.suggestion ?? "Defina o proximo passo concreto e coloque no calendario.";
      return { projectId: p.id, name: p.name, stalledDays: p.stalledDays, suggestion };
    });
  } catch {
    return stalled.map(p => ({ projectId: p.id, name: p.name, stalledDays: p.stalledDays, suggestion: "Quebre em tarefas menores e defina um prazo para o proximo marco." }));
  }
}
