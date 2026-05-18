import "dotenv/config";
import { z } from "zod";

/* ═══════════════════════════════════════════════════════════════════
   Carrega .env, valida com Zod e exporta um objeto tipado.
   Se faltar variável crítica em produção, o processo morre cedo (bom).
═══════════════════════════════════════════════════════════════════ */

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // Google OAuth (Gmail / Calendar / Drive) — obrigatório se quiser integrações reais
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().default("http://localhost:3001/v1/integrations/google/callback"),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Trends — free APIs (cada uma com tier gratuito generoso)
  TMDB_API_KEY: z.string().optional(),
  RAWG_API_KEY: z.string().optional(),

  // Embeddings — OpenAI text-embedding-3-small ($0.02/1M tokens)
  // Se vazio: memória funciona em modo fallback (sem busca semântica)
  OPENAI_API_KEY: z.string().optional(),

  // Brave Search — 2000 queries/mês free, ótima qualidade
  // Se vazio: tool web_search não é oferecida ao Claude
  BRAVE_SEARCH_API_KEY: z.string().optional(),

  JWT_SECRET: z.string().min(8).default("orion-dev-secret-trocar-em-prod"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("✗ Variáveis de ambiente inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
