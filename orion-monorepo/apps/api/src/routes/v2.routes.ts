import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/error.js";
import { universalSearch } from "../modules/universal-search.service.js";
import { runAgent, listAgents, getAgentRuns } from "../ai/agent-system.js";
import { getUsageStats } from "../ai/llm-router.js";
import { runDailyReflection, getLatestReflection } from "../proactive/self-reflection.js";
import { generatePredictions, getActivePredictions, dismissPrediction } from "../proactive/prediction-engine.js";
import { createGoal, updateGoal, listGoals, completeMilestone, detectAbandonedGoals } from "../modules/goal-engine.service.js";

/* ═══════════════════════════════════════════════════════════════════
   ORION v2 API — rotas dos novos sistemas.
   Montado em /v1/v2 (retrocompativel) ou /v2 quando pronto.
═══════════════════════════════════════════════════════════════════ */

export const v2Router: Router = Router();

// ── Universal Search ──────────────────────────────────────────────

v2Router.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const q = z.string().min(1).max(200).parse(req.query.q);
    const results = await universalSearch(req.user.id, q);
    res.json({ ok: true, data: results });
  } catch (err) { next(err); }
});

// ── Agent System ──────────────────────────────────────────────────

v2Router.get("/agents", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const agents = await listAgents();
    res.json({ ok: true, data: agents });
  } catch (err) { next(err); }
});

v2Router.post("/agents/:name/run", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const name = req.params.name;
    const input = req.body ?? {};
    const result = await runAgent({ userId: req.user.id, agentName: name, input });
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

v2Router.get("/agents/runs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const runs = await getAgentRuns(req.user.id);
    res.json({ ok: true, data: runs });
  } catch (err) { next(err); }
});

// ── AI Usage Stats ────────────────────────────────────────────────

v2Router.get("/ai/usage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const days = Number(req.query.days) || 30;
    const stats = await getUsageStats(req.user.id, days);
    res.json({ ok: true, data: stats });
  } catch (err) { next(err); }
});

// ── Self Reflection ───────────────────────────────────────────────

v2Router.post("/reflection/daily", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const result = await runDailyReflection(req.user.id);
    res.json({ ok: true, data: { message: result } });
  } catch (err) { next(err); }
});

v2Router.get("/reflection/:type", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const type = z.enum(["daily", "weekly", "monthly"]).parse(req.params.type);
    const reflection = await getLatestReflection(req.user.id, type);
    res.json({ ok: true, data: reflection });
  } catch (err) { next(err); }
});

// ── Prediction Engine ─────────────────────────────────────────────

v2Router.post("/predictions/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const count = await generatePredictions(req.user.id);
    res.json({ ok: true, data: { generated: count } });
  } catch (err) { next(err); }
});

v2Router.get("/predictions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const predictions = await getActivePredictions(req.user.id);
    res.json({ ok: true, data: predictions });
  } catch (err) { next(err); }
});

v2Router.post("/predictions/:id/dismiss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await dismissPrediction(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Goal Engine ───────────────────────────────────────────────────

const goalCreateSchema = z.object({
  title: z.string().min(1).max(200),
  reason: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  deadline: z.string().optional(),
  metric: z.string().max(100).optional(),
  targetValue: z.number().optional(),
});

v2Router.post("/goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const input = goalCreateSchema.parse(req.body);
    const goal = await createGoal(req.user.id, input);
    res.json({ ok: true, data: goal });
  } catch (err) { next(err); }
});

v2Router.get("/goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const status = req.query.status as string | undefined;
    const goals = await listGoals(req.user.id, status);
    res.json({ ok: true, data: goals });
  } catch (err) { next(err); }
});

v2Router.patch("/goals/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await updateGoal(req.user.id, req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

v2Router.post("/goals/milestones/:id/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await completeMilestone(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

v2Router.get("/goals/abandoned", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const abandoned = await detectAbandonedGoals(req.user.id);
    res.json({ ok: true, data: abandoned });
  } catch (err) { next(err); }
});
