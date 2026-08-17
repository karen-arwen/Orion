import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../../middleware/error.js";
import {
  getClassifiedInbox,
  readEmail,
  draftReply,
  sendReply,
  archiveEmail,
  snoozeEmail,
  createTaskFromEmail,
  summarizeInbox,
} from "../../modules/comms.service.js";

export const commsRouter: Router = Router();

/** GET /v1/m/comms/inbox?filter=all|unread|starred */
commsRouter.get("/inbox", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const filter = z.enum(["all", "unread", "starred"]).optional().parse(req.query.filter as string | undefined);
    const list = await getClassifiedInbox(req.user.id, { max: 20, filter: filter ?? "all" });
    res.json({ ok: true, data: list });
  } catch (err) { next(err); }
});

/** GET /v1/m/comms/inbox/:id — lê email completo */
commsRouter.get("/inbox/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const email = await readEmail(req.user.id, id);
    res.json({ ok: true, data: email });
  } catch (err) { next(err); }
});

/** POST /v1/m/comms/inbox/:id/draft — IA gera rascunho */
commsRouter.post("/inbox/:id/draft", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const { instructions } = z.object({ instructions: z.string().optional() }).parse(req.body);
    const result = await draftReply(req.user.id, id, instructions);
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

/** POST /v1/m/comms/inbox/:id/reply — envia resposta */
commsRouter.post("/inbox/:id/reply", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const parsed = z.object({
      threadId: z.string(),
      to: z.string().email(),
      subject: z.string(),
      body: z.string().min(1),
    }).parse(req.body);
    const result = await sendReply(req.user.id, { emailId: id, ...parsed });
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

/** POST /v1/m/comms/inbox/:id/archive */
commsRouter.post("/inbox/:id/archive", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    await archiveEmail(req.user.id, id);
    res.json({ ok: true, data: { id } });
  } catch (err) { next(err); }
});

/** POST /v1/m/comms/inbox/:id/snooze */
commsRouter.post("/inbox/:id/snooze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const { subject, from, snoozeUntil } = z.object({
      subject: z.string(),
      from: z.string(),
      snoozeUntil: z.string().datetime(),
    }).parse(req.body);
    await snoozeEmail(req.user.id, { emailId: id, subject, from, snoozeUntil: new Date(snoozeUntil) });
    res.json({ ok: true, data: { id } });
  } catch (err) { next(err); }
});

/** POST /v1/m/comms/inbox/:id/create-task */
commsRouter.post("/inbox/:id/create-task", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const id = req.params.id;
    if (!id) throw new ApiError(400, "BAD_REQUEST", "ID obrigatório.");
    const { customTitle, dueAt } = z.object({
      customTitle: z.string().optional(),
      dueAt: z.string().datetime().optional(),
    }).parse(req.body);
    const task = await createTaskFromEmail(req.user.id, id, { customTitle, dueAt });
    res.json({ ok: true, data: task });
  } catch (err) { next(err); }
});

/** GET /v1/m/comms/summary */
commsRouter.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    const text = await summarizeInbox(req.user.id);
    res.json({ ok: true, data: { summary: text } });
  } catch (err) { next(err); }
});
