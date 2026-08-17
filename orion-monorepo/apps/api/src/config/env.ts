import "dotenv/config";
import { z } from "zod";

/* ═══════════════════════════════════════════════════════════════════
   Carrega .env, valida com Zod e exporta um objeto tipado.
   Se faltar variavel critica em producao, o processo morre cedo (bom).
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

  // Google OAuth (Gmail / Calendar / Drive)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().default("http://localhost:3001/v1/integrations/google/callback"),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Trends
  TMDB_API_KEY: z.string().optional(),
  RAWG_API_KEY: z.string().optional(),

  // Embeddings
  OPENAI_API_KEY: z.string().optional(),

  // Brave Search
  BRAVE_SEARCH_API_KEY: z.string().optional(),

  // Connector registry
  GITHUB_TOKEN: z.string().optional(),
  NOTION_TOKEN: z.string().optional(),
  NOTION_CLIENT_ID: z.string().optional(),
  NOTION_CLIENT_SECRET: z.string().optional(),
  NOTION_REDIRECT_URI: z.string().url().default("http://127.0.0.1:3001/v1/integrations/notion/callback"),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().url().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_VERIFICATION_TOKEN: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  LINEAR_WEBHOOK_SECRET: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().url().default("http://127.0.0.1:3001/v1/integrations/spotify/callback"),
  TODOIST_API_TOKEN: z.string().optional(),
  TODOIST_CLIENT_ID: z.string().optional(),
  TODOIST_CLIENT_SECRET: z.string().optional(),
  LINEAR_API_KEY: z.string().optional(),
  LINEAR_CLIENT_ID: z.string().optional(),
  LINEAR_CLIENT_SECRET: z.string().optional(),
  LINEAR_OAUTH_TOKEN: z.string().optional(),

  // ── Novos conectores OAuth ───────────────────────────────────────
  FRONTEND_URL: z.string().url().optional(),
  API_URL: z.string().url().optional(),

  // Microsoft (Outlook + Teams + OneDrive)
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().url().optional(),

  // Atlassian (Jira + Confluence)
  ATLASSIAN_CLIENT_ID: z.string().optional(),
  ATLASSIAN_CLIENT_SECRET: z.string().optional(),
  ATLASSIAN_REDIRECT_URI: z.string().url().optional(),

  // Discord
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),

  // Figma
  FIGMA_CLIENT_ID: z.string().optional(),
  FIGMA_CLIENT_SECRET: z.string().optional(),
  FIGMA_REDIRECT_URI: z.string().url().optional(),

  // Strava
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_REDIRECT_URI: z.string().url().optional(),

  // Mercado Livre
  ML_CLIENT_ID: z.string().optional(),
  ML_CLIENT_SECRET: z.string().optional(),
  ML_REDIRECT_URI: z.string().url().optional(),

  // WhatsApp Business (token-based)
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // Web Push (VAPID)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  JWT_SECRET: z.string().min(8).default("orion-dev-secret-trocar-em-prod"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variaveis de ambiente invalidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
