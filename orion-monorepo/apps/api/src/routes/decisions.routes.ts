import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/error.js";
import {
  approveDecision,
  dismissDecision,
  getDecisionQueueSummary,
  listDecisions,
  syncDecisionsFromAlerts,
} from "../decisions/decision.service.js";
import { recordApproval, recordRejection } from "../decisions/action-router.js";
import { prisma } from "../db/prisma.js";

export const decisionsRouter: Router = Router();

const statusSchema = z.enum(["pending", "approved", "dismissed", "executed"]).default("pending");

decisionsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const status = statusSchema.parse(req.query.status ?? "pending");
    res.json({ ok: true, data: await listDecisions(req.user.id, status) });
  } catch (err) {
    next(err);
  }
});

decisionsRouter.post("/sync-alerts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await syncDecisionsFromAlerts(req.user.id) });
  } catch (err) {
    next(err);
  }
});

decisionsRouter.get("/queue-summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    res.json({ ok: true, data: await getDecisionQueueSummary(req.user.id) });
  } catch (err) {
    next(err);
  }
});

decisionsRouter.post("/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    const result = await approveDecision(req.user.id, id);

    // Registra aprovação para o sistema de aprendizado de autonomia
    // Quando o usuário aprova a mesma ação 5x, o ORION passa a executar direto
    void (async () => {
      try {
        const decision = await prisma.decisionItem.findUnique({
          where: { id },
          select: { payload: true },
        });
        const payload = decision?.payload as Record<string, unknown> | null;
        const moduleId = (payload?.autonomy as Record<string, unknown> | undefined)?.moduleId as string | undefined;
        const actionType = (payload?.internalAction as Record<string, unknown> | undefined)?.type as string | undefined;
        if (moduleId && actionType) {
          await recordApproval(req.user!.id, moduleId, actionType);
        }
      } catch { /* nao critico */ }
    })();

    res.json({ ok: true, data: result });
  } catch (err) {
    if ((err as Error).message === "DECISION_NOT_FOUND") {
      next(new ApiError(404, "NOT_FOUND", "Decisao nao encontrada."));
      return;
    }
    next(err);
  }
});

decisionsRouter.post("/:id/dismiss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessao necessaria.");
    const id = z.string().min(1).parse(req.params.id);
    const result = await dismissDecision(req.user.id, id);

    // Rejeição reseta o streak — ORION aprende que aqui precisa pedir permissão
    void (async () => {
      try {
        const decision = await prisma.decisionItem.findUnique({
          where: { id },
          select: { payload: true },
        });
        const payload = decision?.payload as Record<string, unknown> | null;
        const moduleId = (payload?.autonomy as Record<string, unknown> | undefined)?.moduleId as string | undefined;
        const actionType = (payload?.internalAction as Record<string, unknown> | undefined)?.type as string | undefined;
        if (moduleId && actionType) {
          await recordRejection(req.user!.id, moduleId, actionType);
        }
      } catch { /* nao critico */ }
    })();

    res.json({ ok: true, data: result });
  } catch (err) {
    if ((err as Error).message === "DECISION_NOT_FOUND") {
      next(new ApiError(404, "NOT_FOUND", "Decisao nao encontrada."));
      return;
    }
    next(err);
  }
});
