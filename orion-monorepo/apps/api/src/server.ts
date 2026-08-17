import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/error.js";
import { startScheduler } from "./automations/scheduler.js";
import { startWorkers } from "./queues/workers.js";
import { registerRepeatingJobs } from "./queues/index.js";
import { rehydrateRepeatingJobs } from "./automations/templates.js";

/* ═══════════════════════════════════════════════════════════════════
   O.R.I.O.N · API server
   - CORS estrito (WEB_ORIGIN)
   - Helmet de segurança
   - Morgan em dev
   - Rotas montadas em /v1
═══════════════════════════════════════════════════════════════════ */

const app: Express = express();
const allowedOrigins = new Set([
  env.WEB_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS bloqueado para origem: ${origin}`));
    },
    credentials: true,
  }),
);
const captureRawBody = (req: Request, _res: Response, buf: Buffer): void => {
  req.rawBody = Buffer.from(buf);
};

app.use(express.json({ limit: "2mb", verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, verify: captureRawBody }));

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

app.listen(env.PORT, async () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║  ◉  O.R.I.O.N · API ONLINE                         ║
║  Porta: ${String(env.PORT).padEnd(43)}║
║  Env:   ${env.NODE_ENV.padEnd(43)}║
║  Web:   ${env.WEB_ORIGIN.padEnd(43)}║
║  Modelo: ${env.ANTHROPIC_MODEL.padEnd(42)}║
╚════════════════════════════════════════════════════╝
`);
  // Schedulers e workers — boot em sequência tolerante a falha
  try {
    startScheduler();
    startWorkers();
    await registerRepeatingJobs();
    await rehydrateRepeatingJobs();
  } catch (err) {
    console.error("[boot] falha ao iniciar workers:", (err as Error).message);
  }
});
