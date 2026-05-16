import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../middleware/error.js";

export const projectsRouter: Router = Router();

const upsertSchema = z.object({
  name: z.string().min(1),
  color: z.string().default("#00D4FF"),
  progress: z.number().int().min(0).max(100).default(0),
  status: z.string().default("conceito"),
});

/** GET /v1/projects */
projectsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const list = await prisma.project.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ ok: true, data: list });
  } catch (err) {
    next(err);
  }
});

/** POST /v1/projects */
projectsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const body = upsertSchema.parse(req.body);
    const project = await prisma.project.create({
      data: { ...body, userId: req.user.id },
    });
    res.json({ ok: true, data: project });
  } catch (err) {
    next(err);
  }
});

/** PATCH /v1/projects/:id */
projectsRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const owned = await prisma.project.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Projeto não encontrado.");
    const partial = upsertSchema.partial().parse(req.body);
    const updated = await prisma.project.update({ where: { id }, data: partial });
    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/** DELETE /v1/projects/:id */
projectsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = z.string().min(1).parse(req.params.id);
    const owned = await prisma.project.findFirst({ where: { id, userId: req.user.id } });
    if (!owned) throw new ApiError(404, "NOT_FOUND", "Projeto não encontrado.");
    await prisma.project.delete({ where: { id } });
    res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});
