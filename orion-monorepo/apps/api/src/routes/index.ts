import { Router } from "express";
import { clerk, requireAuth } from "../middleware/auth.js";
import { googleCallbackHandler } from "../integrations/google-handlers.js";
import { notionCallbackHandler } from "../integrations/notion-handlers.js";
import { userRouter } from "./user.routes.js";
import { onboardingRouter } from "./onboarding.routes.js";
import { chatRouter } from "./chat.routes.js";
import { modulesRouter } from "./modules.routes.js";
import { integrationsRouter } from "./integrations.routes.js";
import { automationsRouter } from "./automations.routes.js";
import { alertsRouter } from "./alerts.routes.js";
import { decisionsRouter } from "./decisions.routes.js";
import { webhooksRouter } from "./webhooks.routes.js";
import { projectsRouter } from "./projects.routes.js";
import { commsRouter } from "./m/comms.routes.js";
import { agendaRouter } from "./m/agenda.routes.js";
import { lifeRouter } from "./m/life.routes.js";
import { knowRouter } from "./m/know.routes.js";
import { careerRouter } from "./m/career.routes.js";
import { financeRouter } from "./m/finance.routes.js";
import { docsRouter } from "./m/docs.routes.js";
import { healthRouter } from "./m/health.routes.js";
import { focusRouter } from "./m/focus.routes.js";
import { habitsRouter } from "./m/habits.routes.js";
import { creativeRouter } from "./m/creative.routes.js";
import { gamingRouter } from "./m/gaming.routes.js";
import { mediaRouter } from "./m/media.routes.js";
import { newsRouter } from "./m/news.routes.js";
import { sleepRouter } from "./m/sleep.routes.js";
import { shopRouter } from "./m/shop.routes.js";
import { travelRouter } from "./m/travel.routes.js";
import { languageRouter } from "./m/language.routes.js";
import { whatIfRouter } from "./m/whatif.routes.js";
import { chefRouter } from "./m/chef.routes.js";
import { mindsetRouter } from "./m/mindset.routes.js";
import { socialRouter } from "./m/social.routes.js";
import { securityRouter } from "./m/security.routes.js";
import { devRouter } from "./m/dev.routes.js";
import { behavioralRouter } from "./behavioral.routes.js";
import { inboxRouter } from "./inbox.routes.js";
import { timelineRouter } from "./m/timeline.routes.js";
import { twinRouter } from "./m/twin.routes.js";
import { workflowRouter } from "./m/workflow.routes.js";
import { notificationsRouter } from "./m/notifications.routes.js";
import { trackingRouter } from "./m/tracking.routes.js";
import { searchRouter } from "./search.routes.js";
import { questRouter } from "./m/quest.routes.js";
import { routineRouter } from "./m/routine.routes.js";
import { journalRouter } from "./m/journal.routes.js";
import { projectsEnhancedRouter } from "./m/projects-enhanced.routes.js";
import { oauthRouter } from "../integrations/oauth-handler.js";
import { generalRateLimit } from "../middleware/rate-limit.js";
import { briefRouter } from "./brief.routes.js";
import { v2Router } from "./v2.routes.js";

/**
 * Roteador principal /v1.
 *
 * Ordem importa:
 *   1. Rotas PUBLICAS (callbacks OAuth) - sem auth, identidade via state JWT
 *   2. clerkMiddleware injeta sessao (quando houver)
 *   3. requireAuth garante login pras rotas privadas
 */
export const router: Router = Router();

// ── PUBLICO ──────────────────────────────────────────────────────
// Callbacks OAuth sao publicos - identidade vem via state JWT assinado.
router.get("/integrations/google/callback", googleCallbackHandler);
router.get("/integrations/notion/callback", notionCallbackHandler);
router.use("/webhooks", webhooksRouter);

// Universal OAuth handler - montado com clerk (para injetar req.user no /connect)
// mas SEM requireAuth, porque callbacks OAuth nao carregam JWT do Clerk.
// O handler faz sua propria checagem de auth onde necessario.
router.use("/integrations/oauth", clerk, oauthRouter);

// ── PRIVADO (a partir daqui exige login) ─────────────────────────
router.use(clerk);
router.use(requireAuth);
router.use(generalRateLimit);

router.use("/user", userRouter);
router.use("/onboarding", onboardingRouter);
router.use("/chat", chatRouter);
router.use("/modules", modulesRouter);
router.use("/integrations", integrationsRouter);
router.use("/automations", automationsRouter);
router.use("/alerts", alertsRouter);
router.use("/decisions", decisionsRouter);
router.use("/projects", projectsRouter);
router.use("/inbox", inboxRouter);

// ── Modulos core (Fase 1 do roadmap) ─────────────────────────────
router.use("/m/comms", commsRouter);
router.use("/m/agenda", agendaRouter);
router.use("/m/life", lifeRouter);
router.use("/m/know", knowRouter);
router.use("/m/career", careerRouter);
router.use("/m/finance", financeRouter);

// ── Modulos Fase 2 ──────────────────────────────────────────────
router.use("/m/docs", docsRouter);
router.use("/m/health", healthRouter);
router.use("/m/focus", focusRouter);
router.use("/m/habits", habitsRouter);
router.use("/m/creative", creativeRouter);
router.use("/m/gaming", gamingRouter);
router.use("/m/media", mediaRouter);
router.use("/m/news", newsRouter);
router.use("/m/sleep", sleepRouter);
router.use("/m/shop", shopRouter);
router.use("/m/travel", travelRouter);
router.use("/m/language", languageRouter);
router.use("/m/whatif", whatIfRouter);
router.use("/m/chef", chefRouter);
router.use("/m/mindset", mindsetRouter);
router.use("/m/social", socialRouter);
router.use("/m/security", securityRouter);
router.use("/m/dev", devRouter);
router.use("/m/timeline", timelineRouter);
router.use("/m/twin", twinRouter);
router.use("/m/workflows", workflowRouter);
router.use("/m/notifications", notificationsRouter);
router.use("/m/tracking", trackingRouter);
router.use("/search", searchRouter);
router.use("/m/quest", questRouter);
router.use("/m/routines", routineRouter);
router.use("/m/journal", journalRouter);
router.use("/brief", briefRouter);
router.use("/m/projects", projectsEnhancedRouter);

// ── ORION v2 Systems ─────────────────────────────────────────────
router.use("/v2", v2Router);
