import type { Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import { prisma } from "../db/prisma.js";
import { ApiError } from "./error.js";

/* ═══════════════════════════════════════════════════════════════════
   Auth Clerk:
   - clerkMiddleware injeta o estado de auth em todas as requests
   - requireAuth + ensureUser garantem usuário no DB e expõem req.user
═══════════════════════════════════════════════════════════════════ */

export const clerk = clerkMiddleware();

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      clerkId: string;
      email: string;
      name: string;
    };
  }
}

/**
 * Bloqueia request se não houver sessão Clerk válida.
 * Cria o User no Postgres na primeira vez que o clerkId aparece.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      throw new ApiError(401, "UNAUTHENTICATED", "Sessão necessária.");
    }

    let user = await prisma.user.findUnique({ where: { clerkId: auth.userId } });

    // Busca o perfil real no Clerk pra usar email e nome de verdade
    // (em vez de "Operador <user_xxx@orion.local>"). Cacheado de fato no DB.
    const fetchClerkProfile = async (): Promise<{ email: string; name: string; avatar: string | null }> => {
      try {
        const u = await clerkClient.users.getUser(auth.userId);
        const primaryEmail = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId);
        const email = primaryEmail?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? `${auth.userId}@orion.local`;
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || "Operador";
        return { email, name, avatar: u.imageUrl ?? null };
      } catch {
        return { email: `${auth.userId}@orion.local`, name: "Operador", avatar: null };
      }
    };

    if (!user) {
      const profile = await fetchClerkProfile();
      user = await prisma.user.create({
        data: {
          clerkId: auth.userId,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          profile: { create: {} },
        },
      });
    } else if (user.name === "Operador" || user.email.endsWith("@orion.local")) {
      // Sincroniza usuários antigos provisionados antes do hotfix
      const profile = await fetchClerkProfile();
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email: profile.email, name: profile.name, avatar: profile.avatar },
      });
    }

    req.user = { id: user.id, clerkId: user.clerkId, email: user.email, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}
