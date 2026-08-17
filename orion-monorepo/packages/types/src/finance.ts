export type FinanceTransactionType = "expense" | "income";
export type FinanceGoalStatus = "active" | "paused" | "completed" | "archived";

export interface FinanceTransaction {
  id: string;
  type: FinanceTransactionType;
  amount: number;
  category: string;
  merchant: string;
  note: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSubscription {
  id: string;
  name: string;
  amount: number;
  category: string;
  billingDay: number | null;
  active: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  status: FinanceGoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransactionInput {
  type?: FinanceTransactionType;
  amount: number;
  category?: string;
  merchant?: string;
  note?: string;
  occurredAt?: string;
}

export interface FinanceSubscriptionInput {
  name: string;
  amount: number;
  category?: string;
  billingDay?: number | null;
  active?: boolean;
  note?: string;
}

export interface FinanceGoalInput {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string | null;
  status?: FinanceGoalStatus;
}

export interface FinanceInsight {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  action: string;
}

export interface FinanceSummary {
  monthIncome: number;
  monthExpense: number;
  monthBalance: number;
  recurringMonthly: number;
  runwaySignal: "stable" | "attention" | "critical";
  topCategories: Array<{ category: string; amount: number; pct: number }>;
  subscriptions: FinanceSubscription[];
  goals: FinanceGoal[];
  recentTransactions: FinanceTransaction[];
  insights: FinanceInsight[];
}

export interface FinanceBudget {
  category: string;
  budgetAmount: number;
  spentAmount: number;
  pct: number;
  remaining: number;
  status: "ok" | "warning" | "over";
}

export interface FinanceDailySpend {
  date: string;   // "YYYY-MM-DD"
  expense: number;
  income: number;
}

export interface FinanceMonthData {
  dailySpend: FinanceDailySpend[];
  budgets: FinanceBudget[];
  categoryBreakdown: Array<{ category: string; amount: number; pct: number }>;
}
