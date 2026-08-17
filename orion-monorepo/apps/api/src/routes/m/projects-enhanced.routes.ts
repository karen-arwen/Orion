import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  listProjects, getProject, createProject, updateProject, deleteProject,
  addMilestone, completeMilestone, deleteMilestone, analyzeStalled,
} from "../../modules/projects.service.js";

export const projectsEnhancedRouter: Router = Router();

const createSchema = z.object({
  name:        z.string().min(1).max(100),
  color:       z.string().optional(),
  description: z.string().max(1000).optional(),
  dueDate:     z.string().optional(),
  startDate:   z.string().optional(),
  priority:    z.enum(["low", "medium", "high", "critical"]).optional(),
  tags:        z.array(z.string()).optional(),
});

const updateSchema = z.object({
  name:        z.string().max(100).optional(),
  color:       z.string().optional(),
  status:      z.string().optional(),
  progress:    z.number().int().min(0).max(100).optional(),
  description: z.string().max(1000).optional(),
  dueDate:     z.string().optional(),
  priority:    z.enum(["low", "medium", "high", "critical"]).optional(),
  tags:        z.array(z.string()).optional(),
  note:        z.string().max(500).optional(),
});

const msSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  dueDate:     z.string().optional(),
});

// GET /m/projects
projectsEnhancedRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const projects = await listProjects(req.user.id);
    res.json(projects);
  } catch (e) { next(e); }
});

// GET /m/projects/stalled  — must come BEFORE /:id
projectsEnhancedRouter.get("/stalled", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const analysis = await analyzeStalled(req.user.id);
    res.json(analysis);
  } catch (e) { next(e); }
});

// GET /m/projects/:id
projectsEnhancedRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const project = await getProject(req.user.id, req.params.id!);
    if (!project) throw new ApiError(404, "NOT_FOUND", "Projeto nao encontrado.");
    res.json(project);
  } catch (e) { next(e); }
});

// POST /m/projects
projectsEnhancedRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = createSchema.parse(req.body);
    const project = await createProject(req.user.id, body);
    res.json(project);
  } catch (e) { next(e); }
});

// PATCH /m/projects/:id
projectsEnhancedRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = updateSchema.parse(req.body);
    const project = await updateProject(req.user.id, req.params.id!, body);
    res.json(project);
  } catch (e) { next(e); }
});

// DELETE /m/projects/:id
projectsEnhancedRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await deleteProject(req.user.id, req.params.id!);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /m/projects/:id/milestones
projectsEnhancedRouter.post("/:id/milestones", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const body = msSchema.parse(req.body);
    const ms = await addMilestone(req.user.id, req.params.id!, body);
    res.json(ms);
  } catch (e) { next(e); }
});

// POST /m/projects/:id/milestones/:msId/complete
projectsEnhancedRouter.post("/:id/milestones/:msId/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const ms = await completeMilestone(req.user.id, req.params.id!, req.params.msId!);
    res.json(ms);
  } catch (e) { next(e); }
});

// DELETE /m/projects/:id/milestones/:msId
projectsEnhancedRouter.delete("/:id/milestones/:msId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    await deleteMilestone(req.user.id, req.params.id!, req.params.msId!);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
