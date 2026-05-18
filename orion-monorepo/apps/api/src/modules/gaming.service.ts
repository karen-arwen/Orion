import type { GameCreateInput, GameStatus } from "@orion/types";
import { prisma } from "../db/prisma.js";
import { rawgSearchGame } from "../integrations/trends.js";

/* ═══════════════════════════════════════════════════════════════════
   GAMING — Watchlist + busca RAWG + estatísticas
═══════════════════════════════════════════════════════════════════ */

export async function listGames(userId: string, status?: GameStatus): Promise<unknown[]> {
  return prisma.gameEntry.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });
}

export async function addGame(userId: string, input: GameCreateInput): Promise<unknown> {
  return prisma.gameEntry.create({
    data: {
      userId,
      title: input.title,
      rawgId: input.rawgId ?? null,
      platform: input.platform ?? null,
      genre: input.genre ?? null,
      status: (input.status as GameStatus) ?? "wishlist",
      coverUrl: input.coverUrl ?? null,
      releasedAt: input.releasedAt ?? null,
    },
  });
}

export async function updateGame(
  userId: string,
  id: string,
  patch: Partial<GameCreateInput> & { hoursPlayed?: number; rating?: number; notes?: string },
): Promise<unknown> {
  const owned = await prisma.gameEntry.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Jogo não encontrado");
  return prisma.gameEntry.update({
    where: { id },
    data: {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.platform !== undefined && { platform: patch.platform }),
      ...(patch.genre !== undefined && { genre: patch.genre }),
      ...(patch.status !== undefined && { status: patch.status as GameStatus }),
      ...(patch.hoursPlayed !== undefined && { hoursPlayed: patch.hoursPlayed }),
      ...(patch.rating !== undefined && { rating: patch.rating }),
      ...(patch.notes !== undefined && { notes: patch.notes }),
    },
  });
}

export async function deleteGame(userId: string, id: string): Promise<void> {
  const owned = await prisma.gameEntry.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Jogo não encontrado");
  await prisma.gameEntry.delete({ where: { id } });
}

/** Busca via RAWG e devolve pra UI escolher antes de adicionar. */
export async function searchRawg(query: string): Promise<Array<{
  rawgId: number;
  title: string;
  platform: string;
  genre: string;
  coverUrl: string | null;
  releasedAt: string | null;
  rating: number;
}>> {
  const games = await rawgSearchGame(query, 8);
  return games.map((g) => ({
    rawgId: g.id,
    title: g.name,
    platform: g.platforms.slice(0, 3).join(", "),
    genre: g.genres.slice(0, 2).join(", "),
    coverUrl: g.background,
    releasedAt: g.released || null,
    rating: g.rating,
  }));
}
