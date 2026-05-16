import { env } from "../config/env.js";

const BRAVE_WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

export type BraveFreshness = "pd" | "pw" | "pm" | "py";

export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  source?: string;
}

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  profile?: {
    name?: string;
  };
}

interface BraveWebResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

export interface WebSearchOptions {
  query: string;
  count?: number;
  freshness?: BraveFreshness;
}

function clampCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(10, Math.floor(value)));
}

export async function braveWebSearch(options: WebSearchOptions): Promise<WebSearchResult[]> {
  if (!env.BRAVE_SEARCH_API_KEY) {
    throw new Error("BRAVE_SEARCH_API_KEY nao configurada.");
  }

  const query = options.query.trim();
  if (!query) return [];

  const url = new URL(BRAVE_WEB_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(clampCount(options.count)));
  url.searchParams.set("country", "BR");
  url.searchParams.set("search_lang", "pt-br");
  url.searchParams.set("safesearch", "moderate");
  url.searchParams.set("spellcheck", "1");
  if (options.freshness) url.searchParams.set("freshness", options.freshness);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Brave Search falhou (${response.status}): ${body.slice(0, 180)}`);
  }

  const data = (await response.json()) as BraveWebResponse;
  const results = data.web?.results ?? [];

  return results
    .filter((item): item is BraveWebResult & { title: string; url: string } => Boolean(item.title && item.url))
    .map((item) => ({
      title: item.title,
      url: item.url,
      description: item.description ?? "",
      age: item.age,
      source: item.profile?.name,
    }));
}
