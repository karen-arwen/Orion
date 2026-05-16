import type { Integration } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { refreshAccessToken } from "./google-oauth.js";

/* ═══════════════════════════════════════════════════════════════════
   Token manager — garante que o access_token esteja sempre vivo.

   ensureFreshAccessToken(integration):
   - Se expira em mais de 5 min: retorna o atual.
   - Se está prestes a expirar ou já expirou: renova via refresh_token,
     persiste o novo no banco, retorna o novo.
   - Se a renovação falha (refresh revogado/inválido): marca a
     integração como "expired" e propaga o erro — o frontend mostra
     "Reconectar Google" pro usuário.

   É isso que torna o produto "produto" — usuário conecta uma vez e
   nunca mais precisa pegar token na mão.
═══════════════════════════════════════════════════════════════════ */

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos

export async function ensureFreshAccessToken(integration: Integration): Promise<string> {
  const expiresAt = integration.expiresAt;
  const now = Date.now();

  // Caso 1: ainda tem fôlego de sobra
  if (expiresAt && expiresAt.getTime() - now > REFRESH_THRESHOLD_MS) {
    return integration.accessToken;
  }

  // Caso 2: sem refresh_token → não tem como renovar
  if (!integration.refreshToken) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "expired" },
    });
    throw new Error(`Integração ${integration.provider} sem refresh_token — usuário precisa reconectar.`);
  }

  // Caso 3: renovar
  try {
    const fresh = await refreshAccessToken(integration.refreshToken);
    const updated = await prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: fresh.accessToken,
        // Se o Google rotacionou o refresh, salvamos o novo; senão mantemos o atual
        refreshToken: fresh.refreshToken ?? integration.refreshToken,
        expiresAt: fresh.expiresAt,
        status: "connected",
        lastUsedAt: new Date(),
      },
    });
    return updated.accessToken;
  } catch (err) {
    // Refresh inválido / revogado / desautorizado
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "revoked" },
    });
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha ao renovar ${integration.provider}: ${reason}`);
  }
}

/** Versão "best-effort": tenta renovar; se falhar, devolve null em vez de jogar. */
export async function tryEnsureFreshAccessToken(integration: Integration): Promise<string | null> {
  try {
    return await ensureFreshAccessToken(integration);
  } catch (err) {
    console.warn(`[tokens] ${integration.provider}: ${(err as Error).message}`);
    return null;
  }
}
