import type {
  MediaHub,
  MediaItem,
  MediaItemInput,
  MediaKind,
  MediaRecommendation,
  MediaRecommendationInput,
  MediaStatus,
  MediaTasteProfile,
} from "@orion/types";
import type { PreferenceLayer } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { generateJson } from "./ai-json.js";

type MediaRow = {
  id: string;
  title: string;
  kind: MediaKind;
  status: MediaStatus;
  genres: string[];
  mood: string;
  platform: string;
  releaseYear: number | null;
  rating: number | null;
  notes: string;
  coverUrl: string | null;
  tasteLayer: PreferenceLayer;
  createdAt: Date;
  updatedAt: Date;
};

function toItem(row: MediaRow): MediaItem {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeList(values?: string[]): string[] {
  return (values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index)
    .slice(0, 8);
}

function rank(values: string[]): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function buildTaste(items: MediaItem[]): MediaTasteProfile {
  const rated = items.filter((item) => typeof item.rating === "number");
  const layers = {
    current: items.filter((item) => item.tasteLayer === "current").length,
    nostalgia: items.filter((item) => item.tasteLayer === "nostalgia").length,
    exploration: items.filter((item) => item.tasteLayer === "exploration").length,
  };
  return {
    total: items.length,
    watchlist: items.filter((item) => item.status === "wishlist").length,
    finished: items.filter((item) => item.status === "finished").length,
    avgRating: rated.length ? Math.round((rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    topGenres: rank(items.flatMap((item) => item.genres)),
    topMoods: rank(items.map((item) => item.mood)),
    layers,
  };
}

function fallbackRecommendations(items: MediaItem[], input: MediaRecommendationInput): MediaRecommendation[] {
  const taste = buildTaste(items);
  const genre = taste.topGenres[0]?.name ?? "sci-fi";
  const mood = input.mood?.trim() || taste.topMoods[0]?.name || "intenso";
  const includeAnime = input.includeAnime ?? true;
  return [
    {
      title: includeAnime ? "Cyberpunk: Edgerunners" : "Blade Runner 2049",
      kind: includeAnime ? "anime" : "movie",
      genres: [genre, "sci-fi"],
      mood,
      reason: "Escolha de alta energia com estética tecnológica e tensão emocional, alinhada ao gosto registrado.",
      fitScore: 91,
      layer: "current",
    },
    {
      title: "Ghost in the Shell",
      kind: includeAnime ? "anime" : "movie",
      genres: ["sci-fi", "filosofico"],
      mood: "denso",
      reason: "Nostalgia útil: tecnologia, identidade e inteligência artificial sem parecer recomendação genérica.",
      fitScore: 86,
      layer: "nostalgia",
    },
    {
      title: "Severance",
      kind: "series",
      genres: ["thriller", "corporativo"],
      mood: "misterioso",
      reason: "Exploração controlada: expande o gosto para tensão psicológica e crítica de sistemas.",
      fitScore: 79,
      layer: "exploration",
    },
  ];
}

export async function getMediaHub(userId: string): Promise<MediaHub> {
  const items = (await prisma.mediaItem.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
  })).map((row) => toItem(row as MediaRow));
  return {
    items,
    taste: buildTaste(items),
    recommendations: fallbackRecommendations(items, { intent: "balanced" }),
  };
}

export async function createMediaItem(userId: string, input: MediaItemInput): Promise<MediaItem> {
  const row = await prisma.mediaItem.create({
    data: {
      userId,
      title: input.title,
      kind: input.kind ?? "movie",
      status: input.status ?? "wishlist",
      genres: normalizeList(input.genres),
      mood: input.mood?.trim().toLowerCase() ?? "",
      platform: input.platform?.trim() ?? "",
      releaseYear: input.releaseYear ?? null,
      rating: input.rating ?? null,
      notes: input.notes ?? "",
      coverUrl: input.coverUrl ?? null,
      tasteLayer: input.tasteLayer ?? "current",
    },
  });
  await prisma.memory.create({
    data: {
      userId,
      type: "preference",
      content: `Midia adicionada: ${input.title}. Generos: ${normalizeList(input.genres).join(", ") || "nao informado"}. Camada: ${input.tasteLayer ?? "current"}.`,
      importance: input.rating && input.rating >= 4 ? 0.72 : 0.5,
      embedding: [],
    },
  });
  return toItem(row as MediaRow);
}

export async function updateMediaItem(userId: string, id: string, input: Partial<MediaItemInput>): Promise<MediaItem> {
  const owned = await prisma.mediaItem.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("MEDIA_ITEM_NOT_FOUND");
  const row = await prisma.mediaItem.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.genres !== undefined ? { genres: normalizeList(input.genres) } : {}),
      ...(input.mood !== undefined ? { mood: input.mood.trim().toLowerCase() } : {}),
      ...(input.platform !== undefined ? { platform: input.platform.trim() } : {}),
      ...(input.releaseYear !== undefined ? { releaseYear: input.releaseYear } : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
      ...(input.tasteLayer !== undefined ? { tasteLayer: input.tasteLayer } : {}),
    },
  });
  return toItem(row as MediaRow);
}

export async function deleteMediaItem(userId: string, id: string): Promise<void> {
  const owned = await prisma.mediaItem.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("MEDIA_ITEM_NOT_FOUND");
  await prisma.mediaItem.delete({ where: { id } });
}

export async function recommendMedia(userId: string, input: MediaRecommendationInput): Promise<MediaRecommendation[]> {
  const items = (await prisma.mediaItem.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 80,
  })).map((row) => toItem(row as MediaRow));

  try {
    return await generateJson<MediaRecommendation[]>(
      "Voce e o modulo MIDIA do O.R.I.O.N. Gere exatamente 3 recomendacoes em JSON, sem markdown. Use camadas de gosto: current 70%, nostalgia 20%, exploration 10%. Nao invente disponibilidade em streaming. Campos: title, kind, genres, mood, reason, fitScore, layer.",
      { taste: buildTaste(items), library: items.slice(0, 30), request: input },
      1200,
    );
  } catch {
    return fallbackRecommendations(items, input);
  }
}
