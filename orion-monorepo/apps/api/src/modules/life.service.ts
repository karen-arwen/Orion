import Anthropic from "@anthropic-ai/sdk";
import type { TaskCreateInput, TaskUpdateInput, EnergyLevel, Priority } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   LIFE OS — Módulo de tarefas + timeboxing inteligente.

   - CRUD de Task com sub-tarefas, recorrência e due dates
   - suggestNext: IA sugere a melhor tarefa para o momento
   - listByDate: agrupa tarefas por data (scheduled + due)
   - completeRecurring: conclui e spawna próxima ocorrência
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

function clampEnergy(n: number | undefined): EnergyLevel {
  if (n === 1 || n === 2 || n === 3) return n;
  return 2;
}
function clampPriority(n: number | undefined): Priority {
  if (n === 1 || n === 2 || n === 3) return n;
  return 2;
}

/** Inclui subtasks nested nos resultados */
const taskInclude = {
  subtasks: {
    where: { status: { not: "archived" as const } },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function listTasks(userId: string): Promise<unknown[]> {
  return prisma.task.findMany({
    where: { userId, status: { in: ["todo", "doing"] }, parentId: null },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: taskInclude,
  });
}

export async function listAllTasks(userId: string): Promise<unknown[]> {
  return prisma.task.findMany({
    where: { userId, parentId: null },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    include: taskInclude,
    take: 200,
  });
}

/** Tarefas com dueAt ou scheduledFor numa data específica */
export async function listTasksByDate(userId: string, date: string): Promise<unknown[]> {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);

  return prisma.task.findMany({
    where: {
      userId,
      status: { not: "archived" },
      parentId: null,
      OR: [
        { dueAt: { gte: start, lte: end } },
        { scheduledFor: { gte: start, lte: end } },
      ],
    },
    orderBy: [{ dueAt: "asc" }, { scheduledFor: "asc" }, { priority: "desc" }],
    include: taskInclude,
  });
}

/** Tarefas atrasadas (dueAt no passado, status != done/archived) */
export async function listOverdueTasks(userId: string): Promise<unknown[]> {
  return prisma.task.findMany({
    where: {
      userId,
      status: { in: ["todo", "doing"] },
      parentId: null,
      dueAt: { lt: new Date() },
    },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
    include: taskInclude,
  });
}

export async function createTask(userId: string, input: TaskCreateInput): Promise<unknown> {
  return prisma.task.create({
    data: {
      userId,
      title: input.title,
      notes: input.notes ?? null,
      status: input.status ?? "todo",
      energy: clampEnergy(input.energy),
      priority: clampPriority(input.priority),
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      estMinutes: input.estMinutes ?? null,
      projectId: input.projectId ?? null,
      parentId: input.parentId ?? null,
      isRecurring: input.isRecurring ?? false,
      recurrenceRule: input.recurrenceRule ?? null,
    },
    include: taskInclude,
  });
}

export async function updateTask(userId: string, input: TaskUpdateInput): Promise<unknown> {
  const owned = await prisma.task.findFirst({ where: { id: input.id, userId } });
  if (!owned) throw new Error("Task não encontrada");

  const completedAt =
    input.status === "done" && owned.status !== "done" ? new Date() : undefined;

  return prisma.task.update({
    where: { id: input.id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.energy !== undefined && { energy: clampEnergy(input.energy) }),
      ...(input.priority !== undefined && { priority: clampPriority(input.priority) }),
      ...(input.scheduledFor !== undefined && {
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
      }),
      ...(input.dueAt !== undefined && { dueAt: input.dueAt ? new Date(input.dueAt) : null }),
      ...(input.estMinutes !== undefined && { estMinutes: input.estMinutes }),
      ...(input.isRecurring !== undefined && { isRecurring: input.isRecurring }),
      ...(input.recurrenceRule !== undefined && { recurrenceRule: input.recurrenceRule }),
      ...(completedAt && { completedAt }),
    },
    include: taskInclude,
  });
}

/** Conclui tarefa recorrente e cria a próxima ocorrência */
export async function completeRecurring(userId: string, taskId: string): Promise<unknown> {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new Error("Task não encontrada");

  // Marca como done
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "done", completedAt: new Date() },
  });

  // Calcula próxima data
  const base = task.dueAt ?? task.scheduledFor ?? new Date();
  const next = new Date(base);
  switch (task.recurrenceRule) {
    case "daily":    next.setDate(next.getDate() + 1); break;
    case "weekdays": {
      next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
      break;
    }
    case "weekly":   next.setDate(next.getDate() + 7); break;
    case "monthly":  next.setMonth(next.getMonth() + 1); break;
    default:         next.setDate(next.getDate() + 1);
  }

  // Cria nova ocorrência
  return prisma.task.create({
    data: {
      userId,
      title: task.title,
      notes: task.notes,
      status: "todo",
      energy: task.energy as EnergyLevel,
      priority: task.priority as Priority,
      scheduledFor: task.scheduledFor ? next : null,
      dueAt: task.dueAt ? next : null,
      estMinutes: task.estMinutes,
      projectId: task.projectId,
      isRecurring: true,
      recurrenceRule: task.recurrenceRule,
    },
  });
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const owned = await prisma.task.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Task não encontrada");
  // Deleta subtasks primeiro (cascade pode não funcionar com self-ref NoAction)
  await prisma.task.deleteMany({ where: { parentId: id, userId } });
  await prisma.task.delete({ where: { id } });
}

export async function suggestNext(
  userId: string,
  ctx: { currentEnergy: EnergyLevel; timezone: string },
): Promise<string> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { in: ["todo", "doing"] }, parentId: null },
    orderBy: [{ priority: "desc" }],
    take: 15,
  });
  if (tasks.length === 0) return "Lista vazia. Aproveita o respiro.";

  const now = new Date().toLocaleString("pt-BR", { timeZone: ctx.timezone });
  const lines = tasks
    .map(
      (t, i) =>
        `${i + 1}. [E:${t.energy} P:${t.priority}] ${t.title}${t.estMinutes ? ` (~${t.estMinutes}min)` : ""}${t.dueAt ? ` [vence: ${new Date(t.dueAt).toLocaleDateString("pt-BR")}]` : ""}`,
    )
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Hora atual: ${now}. Energia do usuário: ${ctx.currentEnergy}/3.

Tarefas pendentes:
${lines}

Sugira em 1-2 frases qual tarefa atacar AGORA e por quê. Seja direto e motivador. Mencione o nome da tarefa.`,
      },
    ],
  });

  return (msg.content[0] as { text: string }).text;
}
