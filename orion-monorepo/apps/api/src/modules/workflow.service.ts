import { prisma } from "../db/prisma.js";

/**
 * Workflow Engine — automações multi-step com triggers, conditions e actions.
 * Cada workflow é uma sequência de passos encadeados.
 */

export interface WorkflowStep {
  id: string;
  type: "action" | "condition" | "delay" | "notify" | "ai_decide";
  config: Record<string, unknown>;
  onSuccess?: string; // next step id
  onFailure?: string;
}

export interface WorkflowDef {
  name: string;
  description?: string;
  trigger: { type: string; config: Record<string, unknown> };
  steps: WorkflowStep[];
  enabled: boolean;
}

/** Listar workflows do usuário */
export async function listWorkflows(userId: string) {
  return prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { runs: true } } },
  });
}

/** Criar workflow */
export async function createWorkflow(userId: string, data: WorkflowDef) {
  return prisma.workflow.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      trigger: data.trigger,
      steps: data.steps,
      enabled: data.enabled,
    },
  });
}

/** Atualizar workflow */
export async function updateWorkflow(userId: string, id: string, data: Partial<WorkflowDef>) {
  return prisma.workflow.update({
    where: { id, userId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.trigger && { trigger: data.trigger }),
      ...(data.steps && { steps: data.steps }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });
}

/** Deletar workflow */
export async function deleteWorkflow(userId: string, id: string) {
  return prisma.workflow.delete({ where: { id, userId } });
}

/** Executar workflow manualmente */
export async function executeWorkflow(userId: string, workflowId: string, input?: Record<string, unknown>) {
  const workflow = await prisma.workflow.findUniqueOrThrow({
    where: { id: workflowId, userId },
  });

  const steps = workflow.steps as unknown as WorkflowStep[];
  const run = await prisma.workflowRun.create({
    data: {
      workflowId,
      status: "running",
      input: input ?? {},
      startedAt: new Date(),
    },
  });

  const results: Array<{ stepId: string; status: string; output?: unknown }> = [];

  try {
    for (const step of steps) {
      const result = await executeStep(userId, step, input ?? {});
      results.push({ stepId: step.id, status: "completed", output: result });
    }

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        output: results,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        output: results,
        error: (err as Error).message,
        completedAt: new Date(),
      },
    });
  }

  return { runId: run.id, results };
}

/** Listar execuções de um workflow */
export async function listWorkflowRuns(userId: string, workflowId: string, limit = 20) {
  return prisma.workflowRun.findMany({
    where: { workflow: { id: workflowId, userId } },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/** Executar um step individual */
async function executeStep(
  userId: string,
  step: WorkflowStep,
  context: Record<string, unknown>,
): Promise<unknown> {
  switch (step.type) {
    case "action": {
      const action = step.config.action as string;
      // Delegar ações para o action-executor existente
      return { executed: action, config: step.config, context };
    }
    case "condition": {
      const field = step.config.field as string;
      const op = step.config.operator as string;
      const value = step.config.value;
      const actual = context[field];
      switch (op) {
        case "eq": return actual === value;
        case "ne": return actual !== value;
        case "gt": return (actual as number) > (value as number);
        case "lt": return (actual as number) < (value as number);
        case "contains": return String(actual).includes(String(value));
        default: return false;
      }
    }
    case "delay": {
      const ms = ((step.config.seconds as number) ?? 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 30000)));
      return { delayed: ms };
    }
    case "notify": {
      // Criar inbox item como notificação
      await prisma.universalInboxItem.create({
        data: {
          userId,
          source: "workflow",
          type: "notification",
          title: (step.config.title as string) ?? "Workflow notification",
          preview: step.config.message as string,
          urgency: (step.config.urgency as string) ?? "normal",
          category: "workflows",
          actionable: false,
        },
      });
      return { notified: true };
    }
    case "ai_decide": {
      // Placeholder — em produção, chama Claude para decidir
      return { decision: "approved", reasoning: "AI decision placeholder" };
    }
    default:
      return { skipped: true, reason: `Unknown step type: ${step.type}` };
  }
}
