import type {
  FinanceGoal,
  FinanceGoalInput,
  FinanceInsight,
  FinanceSubscription,
  FinanceSubscriptionInput,
  FinanceSummary,
  FinanceTransaction,
  FinanceTransactionInput,
} from "@orion/types";
import { prisma } from "../db/prisma.js";

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toTransaction(row: {
  id: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  merchant: string;
  note: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): FinanceTransaction {
  return {
    ...row,
    amount: money(row.amount),
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSubscription(row: {
  id: string;
  name: string;
  amount: number;
  category: string;
  billingDay: number | null;
  active: boolean;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}): FinanceSubscription {
  return {
    ...row,
    amount: money(row.amount),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toGoal(row: {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date | null;
  status: "active" | "paused" | "completed" | "archived";
  createdAt: Date;
  updatedAt: Date;
}): FinanceGoal {
  return {
    ...row,
    targetAmount: money(row.targetAmount),
    currentAmount: money(row.currentAmount),
    deadline: row.deadline?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function listFinanceSummary(userId: string): Promise<FinanceSummary> {
  const since = monthStart();
  const [transactions, subscriptions, goals] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: { userId, occurredAt: { gte: since } },
      orderBy: { occurredAt: "desc" },
      take: 80,
    }),
    prisma.financeSubscription.findMany({
      where: { userId, active: true },
      orderBy: [{ amount: "desc" }, { name: "asc" }],
      take: 50,
    }),
    prisma.financeGoal.findMany({
      where: { userId, status: { in: ["active", "paused"] } },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
      take: 30,
    }),
  ]);

  const monthIncome = money(transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0));
  const monthExpense = money(transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0));
  const recurringMonthly = money(subscriptions.reduce((sum, s) => sum + s.amount, 0));
  const monthBalance = money(monthIncome - monthExpense - recurringMonthly);
  const byCategory = new Map<string, number>();
  for (const t of transactions.filter((item) => item.type === "expense")) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }
  const topCategories = [...byCategory.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({
      category,
      amount: money(amount),
      pct: monthExpense > 0 ? Math.round((amount / monthExpense) * 100) : 0,
    }));

  const insights: FinanceInsight[] = [];
  if (recurringMonthly > 0 && monthIncome > 0 && recurringMonthly / monthIncome > 0.25) {
    insights.push({
      id: "recurring-heavy",
      severity: "high",
      title: "Assinaturas pesadas",
      detail: `Recorrentes consomem ${Math.round((recurringMonthly / monthIncome) * 100)}% da renda registrada do mes.`,
      action: "Revisar assinaturas e cortar uma que nao esteja entregando valor real.",
    });
  }
  if (monthBalance < 0) {
    insights.push({
      id: "negative-balance",
      severity: "high",
      title: "Mes projetado no vermelho",
      detail: `Saldo do mes esta em R$ ${money(monthBalance)} considerando assinaturas.`,
      action: "Criar plano de contenção para os proximos 7 dias.",
    });
  }
  const nearGoal = goals.find((goal) => goal.status === "active" && goal.targetAmount > goal.currentAmount);
  if (nearGoal) {
    const remaining = money(nearGoal.targetAmount - nearGoal.currentAmount);
    insights.push({
      id: `goal-${nearGoal.id}`,
      severity: remaining <= 200 ? "low" : "medium",
      title: `Meta em andamento: ${nearGoal.name}`,
      detail: `Faltam R$ ${remaining} para bater a meta.`,
      action: "Reservar um valor pequeno nesta semana e atualizar a meta.",
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: "baseline",
      severity: "low",
      title: "Base financeira limpa",
      detail: "Sem riscos fortes com os dados atuais. Quanto mais registros, mais preciso o CFO fica.",
      action: "Registrar os 5 maiores gastos do mes para calibrar o radar financeiro.",
    });
  }

  return {
    monthIncome,
    monthExpense,
    monthBalance,
    recurringMonthly,
    runwaySignal: monthBalance < 0 ? "critical" : recurringMonthly > monthIncome * 0.25 ? "attention" : "stable",
    topCategories,
    subscriptions: subscriptions.map(toSubscription),
    goals: goals.map(toGoal),
    recentTransactions: transactions.slice(0, 12).map(toTransaction),
    insights,
  };
}

export async function createFinanceTransaction(userId: string, input: FinanceTransactionInput): Promise<FinanceTransaction> {
  const row = await prisma.financeTransaction.create({
    data: {
      userId,
      type: input.type ?? "expense",
      amount: input.amount,
      category: input.category ?? "geral",
      merchant: input.merchant ?? "",
      note: input.note ?? "",
      occurredAt: parseDate(input.occurredAt) ?? new Date(),
    },
  });
  return toTransaction(row);
}

export async function createFinanceSubscription(userId: string, input: FinanceSubscriptionInput): Promise<FinanceSubscription> {
  const row = await prisma.financeSubscription.create({
    data: {
      userId,
      name: input.name,
      amount: input.amount,
      category: input.category ?? "assinatura",
      billingDay: input.billingDay ?? null,
      active: input.active ?? true,
      note: input.note ?? "",
    },
  });
  return toSubscription(row);
}

export async function createFinanceGoal(userId: string, input: FinanceGoalInput): Promise<FinanceGoal> {
  const row = await prisma.financeGoal.create({
    data: {
      userId,
      name: input.name,
      targetAmount: input.targetAmount,
      currentAmount: input.currentAmount ?? 0,
      deadline: parseDate(input.deadline),
      status: input.status ?? "active",
    },
  });
  return toGoal(row);
}

export async function updateFinanceGoal(userId: string, id: string, input: Partial<FinanceGoalInput>): Promise<FinanceGoal> {
  const owned = await prisma.financeGoal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("FINANCE_GOAL_NOT_FOUND");
  const row = await prisma.financeGoal.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.targetAmount !== undefined ? { targetAmount: input.targetAmount } : {}),
      ...(input.currentAmount !== undefined ? { currentAmount: input.currentAmount } : {}),
      ...(input.deadline !== undefined ? { deadline: parseDate(input.deadline) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  return toGoal(row);
}

/* ─────────── BUDGET (stored via UserPattern until prisma generate) ─────────── */

export async function listBudgets(userId: string, month: string): Promise<unknown[]> {
  const patterns = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: `budget_${month}_` } },
  });
  return patterns.map((p) => ({
    category: (p.data as Record<string, unknown>).category as string,
    budgetAmount: (p.data as Record<string, unknown>).amount as number,
    month,
  }));
}

export async function upsertBudget(
  userId: string,
  month: string,
  category: string,
  amount: number,
): Promise<unknown> {
  const key = `budget_${month}_${category}`;
  return prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: key } },
    create: { userId, patternType: key, data: { category, amount, month }, confidence: 1.0 },
    update: { data: { category, amount, month } },
  });
}

export async function deleteBudget(userId: string, month: string, category: string): Promise<void> {
  const key = `budget_${month}_${category}`;
  await prisma.userPattern.deleteMany({ where: { userId, patternType: key } });
}

/* ─────────── MONTHLY DATA (daily breakdown + category + budgets) ─────────── */

export async function getMonthData(userId: string, month: string): Promise<unknown> {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(year!, mon! - 1, 1);
  const end = new Date(year!, mon!, 0, 23, 59, 59, 999);

  const txs = await prisma.financeTransaction.findMany({
    where: { userId, occurredAt: { gte: start, lte: end } },
    orderBy: { occurredAt: "asc" },
  });

  // Daily breakdown
  const dayMap = new Map<string, { expense: number; income: number }>();
  for (const tx of txs) {
    const d = tx.occurredAt.toISOString().slice(0, 10);
    const cur = dayMap.get(d) ?? { expense: 0, income: 0 };
    if (tx.type === "expense") cur.expense += tx.amount;
    else cur.income += tx.amount;
    dayMap.set(d, cur);
  }
  const dailySpend = Array.from(dayMap.entries())
    .map(([date, v]) => ({ date, expense: money(v.expense), income: money(v.income) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Category breakdown
  const catMap = new Map<string, number>();
  const totalExp = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  for (const tx of txs.filter(t => t.type === "expense")) {
    catMap.set(tx.category, (catMap.get(tx.category) ?? 0) + tx.amount);
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: money(amount),
      pct: totalExp > 0 ? Math.round((amount / totalExp) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Budgets with spent
  const budgetPatterns = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: `budget_${month}_` } },
  });
  const budgets = budgetPatterns.map((p) => {
    const d = p.data as Record<string, unknown>;
    const cat = d.category as string;
    const budgetAmount = d.amount as number;
    const spentAmount = money(catMap.get(cat) ?? 0);
    const pct = budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 100) : 0;
    const remaining = money(budgetAmount - spentAmount);
    const status: "ok" | "warning" | "over" = pct >= 100 ? "over" : pct >= 80 ? "warning" : "ok";
    return { category: cat, budgetAmount, spentAmount, pct, remaining, status };
  });

  return { dailySpend, budgets, categoryBreakdown };
}

/* ─────────── CSV IMPORT ─────────── */

export async function importCsv(
  userId: string,
  csvText: string,
): Promise<{ imported: number; errors: number }> {
  const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { imported: 0, errors: 0 };

  // Auto-detect header: date,amount,category,merchant,type,note
  const header = lines[0]!.toLowerCase().split(/[,;]/).map(h => h.trim().replace(/"/g, ""));
  const idx = {
    date:     header.findIndex(h => ["date","data","dt","quando"].includes(h)),
    amount:   header.findIndex(h => ["amount","valor","value","quantia"].includes(h)),
    category: header.findIndex(h => ["category","categoria","cat"].includes(h)),
    merchant: header.findIndex(h => ["merchant","loja","estabelecimento","where","onde"].includes(h)),
    type:     header.findIndex(h => ["type","tipo"].includes(h)),
    note:     header.findIndex(h => ["note","notes","nota","notas","desc","description","descricao"].includes(h)),
  };

  let imported = 0;
  let errors = 0;

  for (const line of lines.slice(1)) {
    const cols = line.split(/[,;]/).map(c => c.trim().replace(/^"|"$/g, ""));
    try {
      const rawAmount = idx.amount >= 0 ? cols[idx.amount]?.replace(",", ".").replace(/[^\d.-]/g, "") ?? "" : "0";
      const amount = parseFloat(rawAmount);
      if (!isFinite(amount) || amount === 0) { errors++; continue; }

      const rawDate = idx.date >= 0 ? cols[idx.date] : null;
      const occurredAt = rawDate ? new Date(rawDate) : new Date();
      if (isNaN(occurredAt.getTime())) { errors++; continue; }

      const rawType = (idx.type >= 0 ? cols[idx.type] : "").toLowerCase();
      const type: "expense" | "income" =
        rawType.includes("income") || rawType.includes("receita") || rawType.includes("entrada") || amount > 0 && rawType === ""
          ? "income"
          : "expense";

      await prisma.financeTransaction.create({
        data: {
          userId,
          type: amount < 0 ? "expense" : type,
          amount: Math.abs(amount),
          category: (idx.category >= 0 ? cols[idx.category] : null) ?? "importado",
          merchant: (idx.merchant >= 0 ? cols[idx.merchant] : null) ?? "",
          note: (idx.note >= 0 ? cols[idx.note] : null) ?? "",
          occurredAt,
        },
      });
      imported++;
    } catch { errors++; }
  }

  return { imported, errors };
}
