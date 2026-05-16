import { env } from "../config/env.js";

/* ═══════════════════════════════════════════════════════════════════
   Trends — clients para TMDB (filmes/séries) e RAWG (jogos).

   Ambos são APIs públicas com tier gratuito generoso. Se a chave não
   estiver configurada, as funções rejeitam com mensagem clara — o
   tool dispatcher devolve isso pra Claude que aí fala pro usuário.
═══════════════════════════════════════════════════════════════════ */

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";
const RAWG_BASE = "https://api.rawg.io/api";

// ── TMDB ────────────────────────────────────────────────────────────

export interface TmdbMovie {
  id: number;
  title: string;
  overview: string;
  releaseDate: string;
  posterUrl: string | null;
  voteAverage: number;
  popularity: number;
}

export interface TmdbShow {
  id: number;
  name: string;
  overview: string;
  firstAirDate: string;
  posterUrl: string | null;
  voteAverage: number;
  popularity: number;
}

interface TmdbMovieRaw {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
  popularity: number;
}

interface TmdbShowRaw {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  vote_average: number;
  popularity: number;
}

async function tmdbRequest<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!env.TMDB_API_KEY) throw new Error("TMDB_API_KEY não configurada.");
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", env.TMDB_API_KEY);
  url.searchParams.set("language", "pt-BR");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function tmdbTrendingMovies(
  window: "day" | "week" = "week",
  limit = 10,
): Promise<TmdbMovie[]> {
  const data = await tmdbRequest<{ results: TmdbMovieRaw[] }>(`/trending/movie/${window}`);
  return data.results.slice(0, limit).map<TmdbMovie>((m) => ({
    id: m.id,
    title: m.title,
    overview: m.overview,
    releaseDate: m.release_date,
    posterUrl: m.poster_path ? `${TMDB_IMG}${m.poster_path}` : null,
    voteAverage: m.vote_average,
    popularity: m.popularity,
  }));
}

export async function tmdbTrendingShows(
  window: "day" | "week" = "week",
  limit = 10,
): Promise<TmdbShow[]> {
  const data = await tmdbRequest<{ results: TmdbShowRaw[] }>(`/trending/tv/${window}`);
  return data.results.slice(0, limit).map<TmdbShow>((s) => ({
    id: s.id,
    name: s.name,
    overview: s.overview,
    firstAirDate: s.first_air_date,
    posterUrl: s.poster_path ? `${TMDB_IMG}${s.poster_path}` : null,
    voteAverage: s.vote_average,
    popularity: s.popularity,
  }));
}

export async function tmdbUpcomingMovies(limit = 10): Promise<TmdbMovie[]> {
  const data = await tmdbRequest<{ results: TmdbMovieRaw[] }>(`/movie/upcoming`, {
    region: "BR",
  });
  return data.results.slice(0, limit).map<TmdbMovie>((m) => ({
    id: m.id,
    title: m.title,
    overview: m.overview,
    releaseDate: m.release_date,
    posterUrl: m.poster_path ? `${TMDB_IMG}${m.poster_path}` : null,
    voteAverage: m.vote_average,
    popularity: m.popularity,
  }));
}

// ── RAWG (jogos) ────────────────────────────────────────────────────

export interface RawgGame {
  id: number;
  name: string;
  released: string;
  rating: number;
  metacritic: number | null;
  background: string | null;
  platforms: string[];
  genres: string[];
}

interface RawgGameRaw {
  id: number;
  name: string;
  released: string;
  rating: number;
  metacritic: number | null;
  background_image: string | null;
  platforms?: Array<{ platform: { name: string } }>;
  genres?: Array<{ name: string }>;
}

async function rawgRequest<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!env.RAWG_API_KEY) throw new Error("RAWG_API_KEY não configurada.");
  const url = new URL(`${RAWG_BASE}${path}`);
  url.searchParams.set("key", env.RAWG_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`RAWG ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

function mapRawgGame(g: RawgGameRaw): RawgGame {
  return {
    id: g.id,
    name: g.name,
    released: g.released ?? "",
    rating: g.rating,
    metacritic: g.metacritic,
    background: g.background_image,
    platforms: (g.platforms ?? []).map((p) => p.platform.name),
    genres: (g.genres ?? []).map((g2) => g2.name),
  };
}

/** Jogos populares dos últimos 60 dias (proxy de "trending"). */
export async function rawgTrendingGames(limit = 10): Promise<RawgGame[]> {
  const now = new Date();
  const past = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
  const dateRange = `${past.toISOString().slice(0, 10)},${now.toISOString().slice(0, 10)}`;

  const data = await rawgRequest<{ results: RawgGameRaw[] }>("/games", {
    dates: dateRange,
    ordering: "-added",
    page_size: String(limit),
  });
  return data.results.map(mapRawgGame);
}

/** Próximos lançamentos (60 dias à frente). */
export async function rawgUpcomingGames(limit = 10): Promise<RawgGame[]> {
  const now = new Date();
  const future = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
  const dateRange = `${now.toISOString().slice(0, 10)},${future.toISOString().slice(0, 10)}`;

  const data = await rawgRequest<{ results: RawgGameRaw[] }>("/games", {
    dates: dateRange,
    ordering: "-released",
    page_size: String(limit),
  });
  return data.results.map(mapRawgGame);
}

/** Busca jogo por nome. */
export async function rawgSearchGame(query: string, limit = 5): Promise<RawgGame[]> {
  const data = await rawgRequest<{ results: RawgGameRaw[] }>("/games", {
    search: query,
    page_size: String(limit),
  });
  return data.results.map(mapRawgGame);
}
