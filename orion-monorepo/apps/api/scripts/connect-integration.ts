/* ═══════════════════════════════════════════════════════════════════
   ⚠ DEPRECATED — use o fluxo OAuth real.

   Caminho atual de produção:
     1. Cria credenciais Google OAuth (uma vez) — ver PASSO_A_PASSO Fase 4.
     2. Preenche GOOGLE_CLIENT_ID/SECRET no apps/api/.env.
     3. No app, clica em "Conectar Google" na página /integrations.

   O O.R.I.O.N. cuida do refresh automático. Nunca mais precisa
   manipular tokens na mão.

   ─── Este script só é útil em situações muito específicas de debug
   (ex: testar persistência de tokens sem subir o frontend). Tokens
   manuais expiram em 1h e não se renovam.
═══════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

/** provider → URL pública do MCP server correspondente. */
const MCP_URLS: Record<string, string> = {
  gmail: "https://gmailmcp.googleapis.com/mcp/v1",
  gcal: "https://calendarmcp.googleapis.com/mcp/v1",
  gdrive: "https://drivemcp.googleapis.com/mcp/v1",
};

interface TokenEntry {
  provider: "gmail" | "gcal" | "gdrive";
  accessToken: string;
  refreshToken: string;
  scopes: string[];
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const tokensPath = join(here, "tokens.json");

  if (!existsSync(tokensPath)) {
    console.error("✗ apps/api/scripts/tokens.json não encontrado.");
    console.error("  Copie tokens.example.json para tokens.json e preencha seus tokens.");
    process.exit(1);
  }

  let entries: TokenEntry[];
  try {
    entries = JSON.parse(readFileSync(tokensPath, "utf-8")) as TokenEntry[];
  } catch {
    console.error("✗ tokens.json tem JSON inválido. Confira vírgulas e aspas.");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
  if (!user) {
    console.error("✗ Nenhum usuário no banco.");
    console.error("  Faça login no O.R.I.O.N primeiro (http://localhost:5173) e rode de novo.");
    process.exit(1);
  }

  console.log(`◉ Conectando integrações para: ${user.name} <${user.email}>`);

  for (const entry of entries) {
    const mcpUrl = MCP_URLS[entry.provider];
    if (!mcpUrl) {
      console.warn(`  ⚠ provider desconhecido: "${entry.provider}" — pulando`);
      continue;
    }
    await prisma.integration.upsert({
      where: { userId_provider: { userId: user.id, provider: entry.provider } },
      create: {
        userId: user.id,
        provider: entry.provider,
        accessToken: entry.accessToken,
        refreshToken: entry.refreshToken,
        scopes: entry.scopes,
        mcpUrl,
        status: "connected",
      },
      update: {
        accessToken: entry.accessToken,
        refreshToken: entry.refreshToken,
        scopes: entry.scopes,
        status: "connected",
      },
    });
    console.log(`  ✓ ${entry.provider} conectado`);
  }

  console.log("◉ Pronto. Recarregue o O.R.I.O.N no navegador (F5).");
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
