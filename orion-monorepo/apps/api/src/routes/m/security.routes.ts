import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  createSecurityAccount,
  createSecurityFinding,
  getSecurityPosture,
  resolveSecurityFinding,
  updateSecurityAccount,
} from "../../modules/security.service.js";

export const securityRouter: Router = Router();

const accountSchema = z.object({
  service: z.string().min(2).max(120),
  category: z.string().min(1).max(80).default("geral"),
  email: z.string().max(180).optional(),
  hasTwoFactor: z.boolean().optional(),
  usesPasswordManager: z.boolean().optional(),
  passwordRotatedAt: z.string().datetime().nullable().optional(),
  recoveryCheckedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(1200).optional(),
});

const findingSchema = z.object({
  title: z.string().min(2).max(160),
  detail: z.string().min(2).max(1200),
  action: z.string().min(2).max(1200),
  risk: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  source: z.string().max(80).optional(),
});

securityRouter.get("/posture", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await getSecurityPosture(req.user.id) });
  } catch (err) {
    next(err);
  }
});

securityRouter.post("/accounts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await createSecurityAccount(req.user.id, accountSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});

securityRouter.patch("/accounts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    res.json({ ok: true, data: await updateSecurityAccount(req.user.id, id, accountSchema.partial().parse(req.body)) });
  } catch (err) {
    if ((err as Error).message === "SECURITY_ACCOUNT_NOT_FOUND") {
      next(new ApiError(404, "NOT_FOUND", "Conta nao encontrada."));
      return;
    }
    next(err);
  }
});

securityRouter.post("/findings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await createSecurityFinding(req.user.id, findingSchema.parse(req.body)) });
  } catch (err) {
    next(err);
  }
});

securityRouter.post("/findings/:id/resolve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    res.json({ ok: true, data: await resolveSecurityFinding(req.user.id, id) });
  } catch (err) {
    if ((err as Error).message === "SECURITY_FINDING_NOT_FOUND") {
      next(new ApiError(404, "NOT_FOUND", "Achado nao encontrado."));
      return;
    }
    next(err);
  }
});
