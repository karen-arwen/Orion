import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  buildDebugRunbook,
  diagnoseWorkspaceExecution,
  getCodeContextMap,
  getWorkspaceSummary,
  prepareWorkspaceCommand,
  prepareWorkspacePatch,
  readWorkspaceFile,
} from "../../modules/dev.service.js";

export const devRouter: Router = Router();

devRouter.get("/workspace", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await getWorkspaceSummary() });
  } catch (err) {
    next(err);
  }
});

devRouter.get("/context-map", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await getCodeContextMap() });
  } catch (err) {
    next(err);
  }
});

devRouter.get("/file", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const filePath = z.string().min(1).parse(req.query.path);
    res.json({ ok: true, data: await readWorkspaceFile(filePath) });
  } catch (err) {
    if ((err as Error).message === "PATH_OUTSIDE_WORKSPACE" || (err as Error).message === "NOT_FILE") {
      next(new ApiError(400, "BAD_REQUEST", "Arquivo invalido para leitura."));
      return;
    }
    next(err);
  }
});

const proposalSchema = z.object({
  title: z.string().min(2).max(160),
  summary: z.string().min(2).max(1200),
  path: z.string().min(1).max(500),
  content: z.string().max(200_000).optional(),
  mode: z.enum(["create", "replace", "patch"]).default("replace"),
  operations: z.array(z.object({
    search: z.string().min(1).max(80_000),
    replace: z.string().max(80_000),
    replaceAll: z.boolean().optional(),
  })).max(10).optional(),
});

devRouter.post("/proposal", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await prepareWorkspacePatch(req.user.id, proposalSchema.parse(req.body)) });
  } catch (err) {
    const message = (err as Error).message;
    if (
      ["PATH_OUTSIDE_WORKSPACE", "NO_PATCH_OPERATIONS", "EMPTY_SEARCH_BLOCK", "SEARCH_BLOCK_NOT_FOUND", "SEARCH_BLOCK_NOT_UNIQUE"].includes(message)
    ) {
      next(new ApiError(400, "BAD_REQUEST", `Patch invalido: ${message}`));
      return;
    }
    next(err);
  }
});

const commandSchema = z.object({
  title: z.string().min(2).max(160),
  summary: z.string().min(2).max(1200),
  command: z.enum(["npm", "git"]),
  args: z.array(z.string().min(1).max(160)).min(1).max(12),
  cwd: z.string().min(1).max(500).optional(),
});

devRouter.post("/command", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await prepareWorkspaceCommand(req.user.id, commandSchema.parse(req.body)) });
  } catch (err) {
    const message = (err as Error).message;
    if (
      ["PATH_OUTSIDE_WORKSPACE", "COMMAND_NOT_ALLOWED", "COMMAND_ARG_BLOCKED", "NPM_COMMAND_NOT_ALLOWED", "NPM_SCRIPT_REQUIRED", "GIT_COMMAND_NOT_ALLOWED"].includes(message)
    ) {
      next(new ApiError(400, "BAD_REQUEST", `Comando invalido: ${message}`));
      return;
    }
    next(err);
  }
});

devRouter.get("/diagnose", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await diagnoseWorkspaceExecution(req.user.id) });
  } catch (err) {
    next(err);
  }
});

devRouter.get("/runbook", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await buildDebugRunbook(req.user.id) });
  } catch (err) {
    next(err);
  }
});
