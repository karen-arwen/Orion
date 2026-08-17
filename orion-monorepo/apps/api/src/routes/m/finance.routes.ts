import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  createFinanceGoal,
  createFinanceSubscription,
  createFinanceTransaction,
  listFinanceSummary,
  updateFinanceGoal,
  getMonthData,
  listBudgets,
  upsertBudget,
  deleteBudget,
  importCsv,
} from "../../modules/finance.service.js";

export const financeRouter: Router = Router();

const transactionSchema = z.object({
  type: z.enum(["expense", "income"]).default("expense"),
  amount: z.number().positive().max(100_000_000),
  category: z.string().min(1).max(80).default("geral"),
  merchant: z.string().max(120).optional(),
  note: z.string().max(1200).optional(),
  occurredAt: z.string().datetime().optional(),
});

const subscriptionSchema = z.object({
  name: z.string().min(2).max(120),
  amount: z.number().positive().max(1_000_000),
  category: z.string().min(1).max(80).default("assinatura"),
  billingDay: z.number().int().min(1).max(31).nullable().optional(),
  active: z.boolean().optional(),
  note: z.string().max(1200).optional(),
});

const goalSchema = z.object({
  name: z.string().min(2).max(120),
  targetAmount: z.number().positive().max(100_000_000),
  currentAmount: z.number().min(0).max(100_000_000).optional(),
  deadline: z.string().datetime().nullable().optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
});

financeRouter.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await listFinanceSummary(req.user.id) });
  } catch (err) {
    next(err);
  }
});

financeRouter.post("/transactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await createFinanceTransaction(req.user.id, transactionSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});

financeRouter.post("/subscriptions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await createFinanceSubscription(req.user.id, subscriptionSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});

financeRouter.post("/goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await createFinanceGoal(req.user.id, goalSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});

financeRouter.patch("/goals/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    res.json({ ok: true, data: await updateFinanceGoal(req.user.id, id, goalSchema.partial().parse(req.body)) });
  } catch (err) {
    if ((err as Error).message === "FINANCE_GOAL_NOT_FOUND") {
      next(new ApiError(404, "NOT_FOUND", "Meta financeira nao encontrada."));
      return;
    }
    next(err);
  }
});

/** GET /v1/m/finance/month?month=2026-06 — daily breakdown + budgets */
financeRouter.get("/month", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.query.month ?? new Date().toISOString().slice(0,7));
    const data = await getMonthData(req.user.id, month);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

/** GET /v1/m/finance/budgets?month=2026-06 */
financeRouter.get("/budgets", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.query.month ?? new Date().toISOString().slice(0,7));
    const budgets = await listBudgets(req.user.id, month);
    res.json({ ok: true, data: budgets });
  } catch (err) { next(err); }
});

/** PUT /v1/m/finance/budgets */
financeRouter.put("/budgets", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { month, category, amount } = z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      category: z.string().min(1),
      amount: z.number().positive(),
    }).parse(req.body);
    const result = await upsertBudget(req.user.id, month, category, amount);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

/** DELETE /v1/m/finance/budgets/:month/:category */
financeRouter.delete("/budgets/:month/:category", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    await deleteBudget(req.user.id, req.params.month!, req.params.category!);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/** POST /v1/m/finance/import-csv */
financeRouter.post("/import-csv", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const { csv } = z.object({ csv: z.string().min(1).max(500_000) }).parse(req.body);
    const result = await importCsv(req.user.id, csv);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});
