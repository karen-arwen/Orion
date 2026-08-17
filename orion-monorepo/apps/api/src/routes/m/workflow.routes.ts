import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import { listWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, executeWorkflow, listWorkflowRuns } from "../../modules/workflow.service.js";

export const workflowRouter: Router = Router();

workflowRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const data = await listWorkflows(req.user.id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.object({ type: z.string(), config: z.record(z.unknown()) }),
  steps: z.array(z.object({
    id: z.string(),
    type: z.enum(["action", "condition", "delay", "notify", "ai_decide"]),
    config: z.record(z.unknown()),
    onSuccess: z.string().optional(),
    onFailure: z.string().optional(),
  })),
  enabled: z.boolean().default(true),
});

workflowRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const data = createSchema.parse(req.body);
    const wf = await createWorkflow(req.user.id, data);
    res.status(201).json({ ok: true, data: wf });
  } catch (err) { next(err); }
});

workflowRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const wf = await updateWorkflow(req.user.id, req.params.id, req.body);
    res.json({ ok: true, data: wf });
  } catch (err) { next(err); }
});

workflowRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    await deleteWorkflow(req.user.id, req.params.id);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

workflowRouter.post("/:id/run", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const result = await executeWorkflow(req.user.id, req.params.id, req.body);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

workflowRouter.get("/:id/runs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const runs = await listWorkflowRuns(req.user.id, req.params.id);
    res.json({ ok: true, data: runs });
  } catch (err) { next(err); }
});
