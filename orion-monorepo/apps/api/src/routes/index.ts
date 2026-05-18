import { Router } from "express";
import { clerk, requireAuth } from "../middleware/auth.js";
import { googleCallbackHandler } from "../integrations/google-handlers.js";
import { userRouter } from "./user.routes.js";
import { chatRouter } from "./chat.routes.js";
import { modulesRouter } from "./modules.routes.js";
import { integrationsRouter } from "./integrations.routes.js";
import { automationsRouter } from "./automations.routes.js";
import { alertsRouter } from "./alerts.routes.js";
import { projectsRouter } from "./projects.routes.js";
import { commsRouter } from "./m/comms.routes.js";
import { agendaRouter } from "./m/agenda.routes.js";
import { lifeRouter } from "./m/life.routes.js";
import { knowRouter } from "./m/know.routes.js";
import { careerRouter } from "./m/career.routes.js";
import { docsRouter } from "./m/docs.routes.js";
import { healthRouter } from "./m/health.routes.js";
import { focusRouter } from "./m/focus.routes.js";
import { habitsRouter } from "./m/habits.routes.js";
import { creativeRouter } from "./m/creative.routes.js";
import { gamingRouter } from "./m/gaming.routes.js";
import { newsRouter } from "./m/news.routes.js";
import { sleepRouter } from "./m/sleep.routes.js";

/**
 * Roteador principal /v1.
 *
 * Ordem importa:
 *   1. Rotas PÚBLICAS (callbacks OAuth) — sem auth, identidade via state JWT
 *   2. clerkMiddleware injeta sessão (quando houver)
 *   3. requireAuth garante login pras rotas privadas
 */
export const router: Router = Router();

// ── PÚBLICO ──────────────────────────────────────────────────────
// Google nos chama aqui depois do consent. Não tem JWT do Clerk —
// o state carrega o userId assinado (state-jwt.ts).
router.get("/integrations/google/callback", googleCallbackHandler);

// ── PRIVADO (a partir daqui exige login) ─────────────────────────
router.use(clerk);
router.use(requireAuth);

router.use("/user", userRouter);
router.use("/chat", chatRouter);
router.use("/modules", modulesRouter);
router.use("/integrations", integrationsRouter);
router.use("/automations", automationsRouter);
router.use("/alerts", alertsRouter);
router.use("/projects", projectsRouter);

// ── Módulos core (Fase 1 do roadmap) ─────────────────────────────
router.use("/m/comms", commsRouter);
router.use("/m/agenda", agendaRouter);
router.use("/m/life", lifeRouter);
router.use("/m/know", knowRouter);
router.use("/m/career", careerRouter);

// ── Módulos Fase 2 ──────────────────────────────────────────────
router.use("/m/docs", docsRouter);
router.use("/m/health", healthRouter);
router.use("/m/focus", focusRouter);
router.use("/m/habits", habitsRouter);
router.use("/m/creative", creativeRouter);
router.use("/m/gaming", gamingRouter);
router.use("/m/news", newsRouter);
router.use("/m/sleep", sleepRouter);
