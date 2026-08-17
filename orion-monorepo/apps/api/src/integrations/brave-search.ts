import { env } from "../config/env.js";

/* ═══════════════════════════════════════════════════════════════════
   Brave Search — busca web em tempo real.

   Por quê Brave: 2000 queries/mês gratuitas, índice próprio (não
   dependência do Google), boa qualidade pra notícias e fatos atuais.

   Endpoint: https://api.search.brave.com/res/v1/web/search
   Auth: header X-Subscription-Token
═══════════════════════════════════════════════════════════════════ */

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  age: string | null;
}

interface BraveResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      age?: string;
      page_age?: string;
    }>;
  };
}

/**
 * Busca na web via Brave Search.
 * @param query — termo de busca
 * @param opts.count — resultados (1-20, padrão 8)
 * @param opts.freshness — 'pd' (24h) | 'pw' (semana) | 'pm' (mês) | 'py' (ano)
 * @param opts.country — código do país (BR, US...). Padrão BR.
 */
export async function braveSearch(
  query: string,
  opts: { count?: number; freshness?: "pd" | "pw" | "pm" | "py"; country?: string } = {},
): Promise<SearchResult[]> {
  if (!env.BRAVE_SEARCH_API_KEY) throw new Error("BRAVE_SEARCH_API_KEY não configurada.");

  // Brave limita query a ~400 chars
  const safeQuery = query.length > 400 ? query.slice(0, 397) + "..." : query;

  const url = new URL(ENDPOINT);
  url.searchParams.set("q", safeQuery);
  url.searchParams.set("count", String(Math.min(20, Math.max(1, opts.count ?? 8))));
  url.searchParams.set("country", opts.country ?? "BR");
  url.searchParams.set("safesearch", "moderate");
  if (opts.freshness) url.searchParams.set("freshness", opts.freshness);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brave Search ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as BraveResponse;
  const results = data.web?.results ?? [];
  return results
    .filter((r): r is { title: string; url: string; description: string; age?: string; page_age?: string } =>
      Boolean(r.title && r.url),
    )
    .map<SearchResult>((r) => ({
      title: r.title,
      url: r.url,
      description: (r.description ?? "").replace(/<\/?[^>]+>/g, ""), // strip <strong> tags
      age: r.age ?? r.page_age ?? null,
    }));
}
