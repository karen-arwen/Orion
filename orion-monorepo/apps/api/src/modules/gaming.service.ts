import type {
  GameCatalogItem,
  GameEntry,
  GameEntryInput,
  GameEntryUpdateInput,
  GameRecommendation,
  GameShelfSummary,
  GameStatus,
} from "@orion/types";
import { prisma } from "../db/prisma.js";
import { rawgSearchGame, rawgTrendingGames, type RawgGame } from "../integrations/trends.js";

const validStatuses: readonly GameStatus[] = ["want", "playing", "beaten", "dropped"];

const gameSelect = {
  id: true,
  userId: true,
  title: true,
  platform: true,
  status: true,
  genre: true,
  hoursPlayed: true,
  rating: true,
  dealActive: true,
  dealPrice: true,
  coverUrl: true,
  rawgId: true,
  addedAt: true,
  updatedAt: true,
} as const;

function normalizeStatus(status: string): GameStatus {
  return validStatuses.includes(status as GameStatus) ? (status as GameStatus) : "want";
}

function toGameEntry(row: {
  id: string;
  userId: string;
  title: string;
  platform: string;
  status: string;
  genre: string | null;
  hoursPlayed: number;
  rating: number | null;
  dealActive: boolean;
  dealPrice: number | null;
  coverUrl: string | null;
  rawgId: number | null;
  addedAt: Date;
  updatedAt: Date;
}): GameEntry {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    platform: row.platform,
    status: normalizeStatus(row.status),
    genre: row.genre,
    hoursPlayed: row.hoursPlayed,
    rating: row.rating,
    dealActive: row.dealActive,
    dealPrice: row.dealPrice,
    coverUrl: row.coverUrl,
    rawgId: row.rawgId,
    addedAt: row.addedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCatalogItem(game: RawgGame): GameCatalogItem {
  return {
    rawgId: game.id,
    title: game.name,
    released: game.released,
    rating: game.rating,
    metacritic: game.metacritic,
    coverUrl: game.background,
    platforms: game.platforms,
    genres: game.genres,
  };
}

export async function listGames(userId: string): Promise<GameEntry[]> {
  const rows = await prisma.gameEntry.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 120,
    select: gameSelect,
  });
  return rows.map(toGameEntry);
}

export async function getGamingSummary(userId: string): Promise<GameShelfSummary> {
  const games = await listGames(userId);
  const recommendations = buildRecommendations(games);
  const dealWatch = games.filter((game) => game.dealActive).slice(0, 8);
  return { games, recommendations, dealWatch };
}

export async function createGameEntry(userId: string, input: GameEntryInput): Promise<GameEntry> {
  const row = await prisma.gameEntry.create({
    data: {
      userId,
      title: input.title.trim(),
      platform: input.platform.trim(),
      status: input.status ?? "want",
      genre: input.genre?.trim() || null,
      hoursPlayed: input.hoursPlayed ?? 0,
      rating: input.rating ?? null,
      coverUrl: input.coverUrl?.trim() || null,
      rawgId: input.rawgId ?? null,
    },
    select: gameSelect,
  });
  return toGameEntry(row);
}

export async function updateGameEntry(
  userId: string,
  id: string,
  input: GameEntryUpdateInput,
): Promise<GameEntry> {
  const owned = await prisma.gameEntry.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Jogo nao encontrado.");
  const row = await prisma.gameEntry.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      platform: input.platform?.trim(),
      status: input.status,
      genre: input.genre === undefined ? undefined : input.genre?.trim() || null,
      hoursPlayed: input.hoursPlayed,
      rating: input.rating,
      dealActive: input.dealActive,
      dealPrice: input.dealPrice,
      coverUrl: input.coverUrl === undefined ? undefined : input.coverUrl?.trim() || null,
    },
    select: gameSelect,
  });
  return toGameEntry(row);
}

export async function deleteGameEntry(userId: string, id: string): Promise<{ id: string }> {
  const owned = await prisma.gameEntry.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Jogo nao encontrado.");
  await prisma.gameEntry.delete({ where: { id }, select: { id: true } });
  return { id };
}

export async function searchGameCatalog(query: string): Promise<GameCatalogItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];
  const results = await rawgSearchGame(cleanQuery, 8);
  return results.map(toCatalogItem);
}

export async function trendingGameCatalog(): Promise<GameCatalogItem[]> {
  const results = await rawgTrendingGames(8);
  return results.map(toCatalogItem);
}

function buildRecommendations(games: GameEntry[]): GameRecommendation[] {
  const playing = games.filter((game) => game.status === "playing");
  const want = games.filter((game) => game.status === "want");
  const lovedGenres = new Map<string, number>();

  for (const game of games) {
    if (!game.genre) continue;
    const ratingBoost = game.rating ? Math.max(0, game.rating - 6) : 1;
    lovedGenres.set(game.genre, (lovedGenres.get(game.genre) ?? 0) + ratingBoost);
  }

  const backlog = [...playing, ...want]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.hoursPlayed - b.hoursPlayed)
    .slice(0, 5)
    .map<GameRecommendation>((game, index) => ({
      title: game.title,
      reason:
        game.status === "playing"
          ? "voce ja esta jogando; melhor concluir antes de abrir outro loop"
          : "esta na sua watchlist e combina com os generos mais fortes da biblioteca",
      platform: game.platform,
      genre: game.genre,
      fitScore: Math.max(60, 96 - index * 8),
      source: "library",
    }));

  const topGenre = [...lovedGenres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (topGenre && backlog.length < 3) {
    backlog.push({
      title: `Buscar proximo ${topGenre}`,
      reason: "seu historico aponta afinidade; use a busca RAWG para escolher um titulo atual",
      platform: "PC / Console",
      genre: topGenre,
      fitScore: 72,
      source: "catalog",
    });
  }

  return backlog;
}
