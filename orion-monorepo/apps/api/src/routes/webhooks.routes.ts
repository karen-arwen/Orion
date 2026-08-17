import { Router, type NextFunction, type Request, type Response } from "express";
import { ApiError } from "../middleware/error.js";
import { handleGitHubWebhook, handleLinearWebhook, handleSlackWebhook } from "../webhooks/webhook.service.js";

export const webhooksRouter: Router = Router();

function signatureError(err: unknown, next: NextFunction): void {
  if ((err as Error).message === "INVALID_WEBHOOK_SIGNATURE") {
    next(new ApiError(401, "INVALID_WEBHOOK_SIGNATURE", "Assinatura do webhook invalida ou secret ausente."));
    return;
  }
  next(err);
}

webhooksRouter.post("/github", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await handleGitHubWebhook(req);
    res.json({ ok: true, data: result });
  } catch (err) {
    signatureError(err, next);
  }
});

webhooksRouter.post("/linear", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await handleLinearWebhook(req);
    res.json({ ok: true, data: result });
  } catch (err) {
    signatureError(err, next);
  }
});

webhooksRouter.post("/slack", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await handleSlackWebhook(req);
    if (result.challenge) {
      res.json({ challenge: result.challenge });
      return;
    }
    res.json({ ok: true, data: result });
  } catch (err) {
    signatureError(err, next);
  }
});
