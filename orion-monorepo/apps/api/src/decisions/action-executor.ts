import { z } from "zod";
import type { InternalActionDescriptor, InternalActionType } from "@orion/types";
import { prisma } from "../db/prisma.js";

export interface ExecutionResult {
  type: InternalActionType;
  label: string;
  entityId: string | null;
  summary: string;
}

const memoryTypes = ["fact", "preference", "event", "feedback", "project", "relationship"] as const;
const priority = ["low", "medium", "high", "critical"] as const;

const actionSchema = z.object({
  type: z.enum([
    "memory.create",
    "task.create",
    "alert.create",
    "project.create",
    "project.update",
    "social.contact.create",
    "finance.transaction.create",
    "finance.subscription.create",
    "finance.goal.create",
    "shop.wishlist.create",
    "media.item.create",
    "security.finding.create",
    "habit.create",
  ]),
  input: z.record(z.unknown()),
});

const memoryCreateSchema = z.object({
  type: z.enum(memoryTypes).default("fact"),
  content: z.string().min(3).max(4000),
  importance: z.number().min(0).max(1).default(0.72),
  pinned: z.boolean().default(false),
});

const taskCreateSchema = z.object({
  title: z.string().min(2).max(200),
  notes: z.string().max(2000).optional(),
  priority: z.number().int().min(1).max(3).default(2),
  energy: z.number().int().min(1).max(3).default(2),
  estMinutes: z.number().int().min(5).max(1440).optional(),
  scheduledFor: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  projectId: z.string().optional(),
});

const alertCreateSchema = z.object({
  module: z.string().min(2).max(40).default("orion"),
  icon: z.string().max(8).default("◈"),
  color: z.string().max(32).default("#00D4FF"),
  title: z.string().min(2).max(160),
  text: z.string().min(2).max(1200),
  action: z.string().min(2).max(1000),
  priority: z.enum(priority).default("medium"),
  expiresAt: z.string().datetime().optional(),
});

const projectCreateSchema = z.object({
  name: z.string().min(2).max(160),
  color: z.string().max(32).default("#00D4FF"),
  progress: z.number().int().min(0).max(100).default(0),
  status: z.string().min(1).max(80).default("conceito"),
});

const projectUpdateSchema = projectCreateSchema.partial().extend({
  id: z.string().min(1),
});

const socialContactSchema = z.object({
  name: z.string().min(2).max(120),
  context: z.string().max(1200).default(""),
  lastInteraction: z.string().datetime().optional(),
  nextStep: z.string().max(400).default("Enviar mensagem de follow-up"),
  importance: z.number().int().min(1).max(10).default(6),
});

const financeTransactionSchema = z.object({
  type: z.enum(["expense", "income"]).default("expense"),
  amount: z.number().positive(),
  category: z.string().min(1).max(80).default("geral"),
  merchant: z.string().max(160).default(""),
  note: z.string().max(1200).default(""),
  occurredAt: z.string().datetime().optional(),
});

const financeSubscriptionSchema = z.object({
  name: z.string().min(2).max(160),
  amount: z.number().positive(),
  category: z.string().min(1).max(80).default("assinatura"),
  billingDay: z.number().int().min(1).max(31).optional(),
  active: z.boolean().default(true),
  note: z.string().max(1200).default(""),
});

const financeGoalSchema = z.object({
  name: z.string().min(2).max(160),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).default(0),
  deadline: z.string().optional().transform((v) => {
    if (!v) return undefined;
    // Accept both "2025-12-31" and "2025-12-31T00:00:00Z"
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T00:00:00.000Z`;
    return v;
  }),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
});

const wishlistSchema = z.object({
  name: z.string().min(2).max(200),
  url: z.string().min(1).max(800).default("manual://orion"),
  targetPrice: z.number().positive().optional(),
  currentPrice: z.number().positive().optional(),
  alertAtPct: z.number().int().min(1).max(95).default(20),
  notes: z.string().max(1200).optional(),
});

const mediaItemSchema = z.object({
  title: z.string().min(1).max(200),
  kind: z.enum(["movie", "series", "anime", "documentary", "other"]).default("movie"),
  status: z.enum(["wishlist", "watching", "finished", "dropped", "paused"]).default("wishlist"),
  genres: z.array(z.string().min(1).max(60)).max(8).default([]),
  mood: z.string().max(80).default(""),
  platform: z.string().max(120).default(""),
  releaseYear: z.number().int().min(1888).max(2100).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).default(""),
  coverUrl: z.string().max(800).optional(),
  tasteLayer: z.enum(["current", "nostalgia", "exploration"]).default("current"),
});

const securityFindingSchema = z.object({
  title: z.string().min(2).max(160),
  detail: z.string().min(2).max(1200),
  action: z.string().min(2).max(1200),
  risk: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  source: z.string().max(80).default("chat"),
});

const habitSchema = z.object({
  name: z.string().min(2).max(120),
  frequency: z.string().min(2).max(80).default("daily"),
  color: z.string().max(32).default("#00D4FF"),
  icon: z.string().max(8).default("OK"),
});

export function parseInternalAction(payload: Record<string, unknown>): InternalActionDescriptor | null {
  const raw = payload.internalAction;
  const parsed = actionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasExecutableAction(payload: Record<string, unknown>): boolean {
  return parseInternalAction(payload) !== null;
}

export async function executeInternalAction(userId: string, payload: Record<string, unknown>): Promise<ExecutionResult | null> {
  const action = parseInternalAction(payload);
  if (!action) return null;

  switch (action.type) {
    case "memory.create": {
      const parsed = memoryCreateSchema.safeParse(action.input);
      if (!parsed.success) {
        console.warn("[action-executor] memory.create campos inválidos:", parsed.error.issues.map(i => i.path.join(".")+":"+i.message).join(", "));
        return null;
      }
      const input = parsed.data;
      const row = await prisma.memory.create({
        data: {
          userId,
          type: input.type,
          content: input.content,
          importance: input.importance,
          pinned: input.pinned,
          embedding: [],
        },
      });
      return {
        type: action.type,
        label: "Memoria criada",
        entityId: row.id,
        summary: `Memoria ${input.type} salva com importancia ${Math.round(input.importance * 100)}%.`,
      };
    }
    case "task.create": {
      const input = taskCreateSchema.parse(action.input);
      const row = await prisma.task.create({
        data: {
          userId,
          title: input.title,
          notes: input.notes ?? null,
          priority: input.priority,
          energy: input.energy,
          estMinutes: input.estMinutes ?? null,
          scheduledFor: parseDate(input.scheduledFor),
          dueAt: parseDate(input.dueAt),
          projectId: input.projectId ?? null,
        },
      });
      return {
        type: action.type,
        label: "Tarefa criada",
        entityId: row.id,
        summary: `Tarefa criada no Life OS: ${row.title}.`,
      };
    }
    case "alert.create": {
      const parsed = alertCreateSchema.safeParse(action.input);
      if (!parsed.success) {
        console.warn("[action-executor] alert.create campos inválidos:", parsed.error.issues.map(i => i.path.join(".")+":"+i.message).join(", "));
        return null;
      }
      const input = parsed.data;
      const row = await prisma.proactiveAlert.create({
        data: {
          userId,
          module: input.module,
          icon: input.icon,
          color: input.color,
          title: input.title,
          text: input.text,
          action: input.action,
          priority: input.priority,
          expiresAt: parseDate(input.expiresAt),
        },
      });
      return {
        type: action.type,
        label: "Alerta criado",
        entityId: row.id,
        summary: `Alerta proativo criado: ${row.title}.`,
      };
    }
    case "project.create": {
      const input = projectCreateSchema.parse(action.input);
      const row = await prisma.project.create({
        data: { ...input, userId },
      });
      return {
        type: action.type,
        label: "Projeto criado",
        entityId: row.id,
        summary: `Projeto criado: ${row.name}.`,
      };
    }
    case "project.update": {
      const input = projectUpdateSchema.parse(action.input);
      const owned = await prisma.project.findFirst({ where: { id: input.id, userId }, select: { id: true } });
      if (!owned) throw new Error("PROJECT_NOT_FOUND");
      const row = await prisma.project.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.progress !== undefined ? { progress: input.progress } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      return {
        type: action.type,
        label: "Projeto atualizado",
        entityId: row.id,
        summary: `Projeto atualizado: ${row.name}.`,
      };
    }
    case "social.contact.create": {
      const input = socialContactSchema.parse(action.input);
      const row = await prisma.socialContact.create({
        data: {
          userId,
          name: input.name,
          context: input.context,
          lastInteraction: parseDate(input.lastInteraction),
          nextStep: input.nextStep,
          importance: input.importance,
        },
      });
      await prisma.memory.create({
        data: {
          userId,
          type: "relationship",
          content: `Contato social: ${row.name}. Contexto: ${row.context || "sem contexto"}. Proximo passo: ${row.nextStep}.`,
          importance: Math.min(0.95, Math.max(0.2, row.importance / 10)),
          pinned: row.importance >= 8,
          embedding: [],
        },
      });
      return {
        type: action.type,
        label: "Contato criado",
        entityId: row.id,
        summary: `Contato adicionado ao Social CRM: ${row.name}.`,
      };
    }
    case "finance.transaction.create": {
      const input = financeTransactionSchema.parse(action.input);
      const row = await prisma.financeTransaction.create({
        data: {
          userId,
          type: input.type,
          amount: input.amount,
          category: input.category,
          merchant: input.merchant,
          note: input.note,
          occurredAt: parseDate(input.occurredAt) ?? new Date(),
        },
      });
      return {
        type: action.type,
        label: "Movimento financeiro registrado",
        entityId: row.id,
        summary: `${input.type === "income" ? "Entrada" : "Gasto"} de R$ ${input.amount.toFixed(2)} registrado em ${input.category}.`,
      };
    }
    case "finance.subscription.create": {
      const input = financeSubscriptionSchema.parse(action.input);
      const row = await prisma.financeSubscription.create({
        data: {
          userId,
          name: input.name,
          amount: input.amount,
          category: input.category,
          billingDay: input.billingDay ?? null,
          active: input.active,
          note: input.note,
        },
      });
      return {
        type: action.type,
        label: "Assinatura registrada",
        entityId: row.id,
        summary: `Assinatura ${row.name} registrada por R$ ${row.amount.toFixed(2)}/mes.`,
      };
    }
    case "finance.goal.create": {
      const input = financeGoalSchema.parse(action.input);
      const row = await prisma.financeGoal.create({
        data: {
          userId,
          name: input.name,
          targetAmount: input.targetAmount,
          currentAmount: input.currentAmount,
          deadline: parseDate(input.deadline),
          status: input.status,
        },
      });
      return {
        type: action.type,
        label: "Meta financeira criada",
        entityId: row.id,
        summary: `Meta ${row.name} criada com alvo de R$ ${row.targetAmount.toFixed(2)}.`,
      };
    }
    case "shop.wishlist.create": {
      const input = wishlistSchema.parse(action.input);
      const history = typeof input.currentPrice === "number" ? [{ price: input.currentPrice, at: new Date().toISOString() }] : [];
      const row = await prisma.wishlistItem.create({
        data: {
          userId,
          name: input.name,
          url: input.url,
          targetPrice: input.targetPrice ?? null,
          currentPrice: input.currentPrice ?? null,
          priceHistory: history,
          alertAtPct: input.alertAtPct,
          notes: input.notes ?? null,
        },
      });
      return {
        type: action.type,
        label: "Item monitorado",
        entityId: row.id,
        summary: `${row.name} adicionado a Compras${row.targetPrice ? ` com alvo R$ ${row.targetPrice.toFixed(2)}` : ""}.`,
      };
    }
    case "media.item.create": {
      const input = mediaItemSchema.parse(action.input);
      const row = await prisma.mediaItem.create({
        data: {
          userId,
          title: input.title,
          kind: input.kind,
          status: input.status,
          genres: input.genres.map((genre) => genre.trim().toLowerCase()).filter(Boolean),
          mood: input.mood.trim().toLowerCase(),
          platform: input.platform.trim(),
          releaseYear: input.releaseYear ?? null,
          rating: input.rating ?? null,
          notes: input.notes,
          coverUrl: input.coverUrl ?? null,
          tasteLayer: input.tasteLayer,
        },
      });
      await prisma.memory.create({
        data: {
          userId,
          type: "preference",
          content: `Midia adicionada via chat: ${row.title}. Generos: ${row.genres.join(", ") || "nao informado"}. Camada: ${row.tasteLayer}.`,
          importance: row.rating && row.rating >= 4 ? 0.72 : 0.5,
          embedding: [],
        },
      });
      return {
        type: action.type,
        label: "Midia adicionada",
        entityId: row.id,
        summary: `${row.title} entrou no modulo Midia como ${row.status}.`,
      };
    }
    case "security.finding.create": {
      const input = securityFindingSchema.parse(action.input);
      const row = await prisma.securityFinding.create({
        data: {
          userId,
          title: input.title,
          detail: input.detail,
          action: input.action,
          risk: input.risk,
          source: input.source,
        },
      });
      return {
        type: action.type,
        label: "Achado de seguranca criado",
        entityId: row.id,
        summary: `Guard registrou ${row.risk}: ${row.title}.`,
      };
    }
    case "habit.create": {
      const input = habitSchema.parse(action.input);
      const row = await prisma.habit.create({
        data: {
          userId,
          name: input.name,
          frequency: input.frequency,
          color: input.color,
          icon: input.icon,
        },
      });
      return {
        type: action.type,
        label: "Habito criado",
        entityId: row.id,
        summary: `Habito criado: ${row.name}.`,
      };
    }
    default:
      return null;
  }
}
