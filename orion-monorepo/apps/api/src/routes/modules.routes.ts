import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";
import { ALL_MODULES } from "../modules/catalog.js";

export const modulesRouter: Router = Router();

/** GET /v1/modules — catálogo completo dos 26 módulos. */
modulesRouter.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, data: ALL_MODULES });
});

/** GET /v1/modules/active — módulos ativos do usuário. */
modulesRouter.get("/active", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const active = await prisma.userModule.findMany({
      where: { userId: req.user.id, enabled: true },
    });
    res.json({ ok: true, data: active });
  } catch (err) {
    next(err);
  }
});

const enableSchema = z.object({ enabled: z.boolean() });

/** POST /v1/modules/:id/enable — ativa ou desativa um módulo. */
modulesRouter.post("/:id/enable", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const moduleId = req.params.id;
    if (!moduleId) throw new ApiError(400, "BAD_REQUEST", "ID do módulo obrigatório.");
    const exists = ALL_MODULES.find((m) => m.id === moduleId);
    if (!exists) throw new ApiError(404, "NOT_FOUND", "Módulo inexistente.");

    const { enabled } = enableSchema.parse(req.body);
    const um = await prisma.userModule.upsert({
      where: { userId_moduleId: { userId: req.user.id, moduleId } },
      create: { userId: req.user.id, moduleId, enabled },
      update: { enabled },
    });
    res.json({ ok: true, data: um });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/modules/:id/config — atualiza config JSON do módulo. */
modulesRouter.patch("/:id/config", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const moduleId = req.params.id;
    if (!moduleId) throw new ApiError(400, "BAD_REQUEST", "ID do módulo obrigatório.");
    const config = req.body as Record<string, unknown>;
    const um = await prisma.userModule.upsert({
      where: { userId_moduleId: { userId: req.user.id, moduleId } },
      create: { userId: req.user.id, moduleId, enabled: false, config },
      update: { config },
    });
    res.json({ ok: true, data: um });
  } catch (err) {
    next(err);
  }
});
