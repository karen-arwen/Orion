import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/error.js";
import { startScheduler } from "./automations/scheduler.js";

/* ═══════════════════════════════════════════════════════════════════
   O.R.I.O.N · API server
   - CORS estrito (WEB_ORIGIN)
   - Helmet de segurança
   - Morgan em dev
   - Rotas montadas em /v1
═══════════════════════════════════════════════════════════════════ */

const app: Express = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Healthcheck público
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "orion-api", env: env.NODE_ENV });
});

// API v1
app.use("/v1", router);

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Rota não encontrada" } });
});

// Error handler global (precisa do 4o parâmetro pra Express reconhecer)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  errorHandler(err, req, res, next);
});

app.listen(env.PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║  ◉  O.R.I.O.N · API ONLINE                         ║
║  Porta: ${String(env.PORT).padEnd(43)}║
║  Env:   ${env.NODE_ENV.padEnd(43)}║
║  Web:   ${env.WEB_ORIGIN.padEnd(43)}║
║  Modelo: ${env.ANTHROPIC_MODEL.padEnd(42)}║
╚════════════════════════════════════════════════════╝
`);
  startScheduler();
});
