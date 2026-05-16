import Anthropic from "@anthropic-ai/sdk";
import type { TaskCreateInput, TaskUpdateInput, EnergyLevel, Priority } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   LIFE OS — Módulo de tarefas + timeboxing inteligente.

   - CRUD básico de Task
   - suggestNext: dado o estado atual (energia, hora), o O.R.I.O.N.
     sugere QUAL task atacar agora — não a próxima da lista, a mais
     casável com o momento.
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

export async function listTasks(userId: string): Promise<unknown[]> {
  return prisma.task.findMany({
    where: { userId, status: { in: ["todo", "doing"] } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function listAllTasks(userId: string): Promise<unknown[]> {
  return prisma.task.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: 100,
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
    },
  });
}

export async function updateTask(userId: string, input: TaskUpdateInput): Promise<unknown> {
  const owned = await prisma.task.findFirst({ where: { id: input.id, userId } });
  if (!owned) throw new Error("Task não encontrada");

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
    },
  });
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const owned = await prisma.task.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Task não encontrada");
  await prisma.task.delete({ where: { id } });
}

/**
 * Sugere QUAL task atacar agora, dado energia atual e horário.
 * Claude raciocina sobre o casamento entre tarefa e momento.
 */
export async function suggestNext(
  userId: string,
  ctx: { currentEnergy: EnergyLevel; timezone: string },
): Promise<string> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { in: ["todo", "doing"] } },
    orderBy: [{ priority: "desc" }],
    take: 15,
  });
  if (tasks.length === 0) return "Lista vazia. Aproveita o respiro.";

  const lines = tasks
    .map(
      (t, i) =>
        `${i + 1}. [${t.status}] ${t.title} — energia:${t.energy}/3, prioridade:${t.priority}/3, ` +
        `est:${t.estMinutes ?? "?"}min` +
        (t.scheduledFor ? `, agendada:${t.scheduledFor.toISOString()}` : ""),
    )
    .join("\n");

  const now = new Date().toLocaleString("pt-BR", { timeZone: ctx.timezone });

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 300,
    temperature: 0.5,
    system: `Você é o O.R.I.O.N. recomendando a PRÓXIMA tarefa pro usuário.
Considere o casamento entre energia disponível e energia exigida pela task.
Resposta em 2-4 linhas: indique UMA task pelo nome + por quê encaixa AGORA.`,
    messages: [
      {
        role: "user",
        content: `Hora atual: ${now}\nMeu nível de energia agora: ${ctx.currentEnergy}/3\n\nLista:\n${lines}`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
