import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { tmdbTrendingMovies, tmdbTrendingShows, rawgTrendingGames } from "../integrations/trends.js";

/* ═══════════════════════════════════════════════════════════════════
   CONTENT RECOMMENDATIONS — recomendações personalizadas.

   O ORION aprende o que o usuário curte e recomenda:
   - Filmes/séries baseados em gêneros e humor atuais
   - Jogos baseados no histórico + trending
   - Música baseada na atividade atual (foco/relax/treino)
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

interface Recommendation {
  title: string;
  type: "movie" | "series" | "game" | "music";
  reason: string;
  score: number;       // 0-100 fit score
  metadata: Record<string, unknown>;
}

export async function getPersonalizedRecommendations(userId: string, type?: "movie" | "series" | "game"): Promise<Recommendation[]> {
  // 1. Coletar preferências do usuário
  const [mediaItems, memories, latestCheckin] = await Promise.all([
    prisma.mediaItem.findMany({
      where: { userId, rating: { not: null } },
      orderBy: { rating: "desc" },
      take: 20,
    }),
    prisma.memory.findMany({
      where: { userId, type: "preference", content: { contains: "gosta" } },
      take: 10,
    }),
    prisma.mindsetCheckin.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }).catch(() => null),
  ]);

  // Build taste profile
  const genreCounts: Record<string, number> = {};
  const highRated: string[] = [];
  for (const item of mediaItems) {
    for (const genre of item.genres) {
      genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
    }
    if ((item.rating ?? 0) >= 8) {
      highRated.push(`${item.title} (${item.kind}, ${item.rating}/10)`);
    }
  }

  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const moodContext = latestCheckin
    ? `Humor atual: ${latestCheckin.mood}/10, energia: ${latestCheckin.energy}/10`
    : "Humor: desconhecido";

  // 2. Buscar trending
  const [trendingMovies, trendingSeries, trendingGames] = await Promise.all([
    (!type || type === "movie") ? tmdbTrendingMovies().catch(() => []) : Promise.resolve([]),
    (!type || type === "series") ? tmdbTrendingShows().catch(() => []) : Promise.resolve([]),
    (!type || type === "game") ? rawgTrendingGames().catch(() => []) : Promise.resolve([]),
  ]);

  // 3. Claude rankeia baseado no perfil
  const trendingBlock = [
    trendingMovies.length ? `Filmes trending: ${trendingMovies.slice(0, 8).map((m) => `${m.title} (${m.voteAverage}/10)`).join(", ")}` : "",
    trendingSeries.length ? `Series trending: ${trendingSeries.slice(0, 8).map((s) => `${s.name} (${s.voteAverage}/10)`).join(", ")}` : "",
    trendingGames.length ? `Jogos trending: ${trendingGames.slice(0, 8).map((g) => `${g.name} (${g.genres.join(', ')})`).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  if (!trendingBlock) return [];

  const prompt = `
Perfil de gosto do usuario:
Generos favoritos: ${topGenres.join(", ") || "desconhecido"}
Bem avaliados: ${highRated.slice(0, 5).join("; ") || "sem dados"}
Preferencias: ${memories.map((m) => m.content).join("; ") || "sem dados"}
${moodContext}

${trendingBlock}

Dos itens trending acima, selecione os 5 mais compativeis com o perfil do usuario.
Responda em JSON: [{"title":"...","type":"movie|series|game","reason":"...","score":0-100}]
Apenas JSON, sem texto adicional.`.trim();

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: "Voce e um sistema de recomendacao de conteudo. Retorne apenas JSON valido.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Array<{ title: string; type: string; reason: string; score: number }>;

    return parsed.map((r) => ({
      title: r.title,
      type: (r.type as Recommendation["type"]) || "movie",
      reason: r.reason,
      score: r.score,
      metadata: {},
    }));
  } catch {
    return [];
  }
}

/** Recomendação rápida de música baseada no contexto */
export async function suggestMusic(userId: string, activity: "focus" | "relax" | "workout" | "creative" | "sleep"): Promise<{
  query: string;
  reason: string;
}> {
  const moodMap = {
    focus: { query: "lo-fi study beats", reason: "Musica ambiente para concentracao sem distracao vocal." },
    relax: { query: "chill acoustic evening", reason: "Acustico suave para desacelerar." },
    workout: { query: "high energy electronic workout", reason: "BPM alto para manter a energia do treino." },
    creative: { query: "jazz instrumental creative", reason: "Jazz instrumental estimula criatividade sem competir pela atencao." },
    sleep: { query: "ambient sleep sounds nature", reason: "Sons ambientes para induzir sono naturalmente." },
  };

  // Check if user has music preferences
  const pref = await prisma.memory.findFirst({
    where: { userId, content: { contains: "musica" } },
    orderBy: { importance: "desc" },
  }).catch(() => null);

  const base = moodMap[activity];
  if (pref) {
    return {
      query: `${base.query} ${pref.content.slice(0, 30)}`,
      reason: `${base.reason} Ajustado com base na sua preferencia: "${pref.content.slice(0, 60)}".`,
    };
  }

  return base;
}
