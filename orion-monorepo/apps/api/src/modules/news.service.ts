import { prisma } from "../db/prisma.js";
import { braveSearch } from "../integrations/brave-search.js";
import type { JobRadarInput, JobRadarResult } from "@orion/types";

/* ═══════════════════════════════════════════════════════════════════
   RADAR — Feed personalizado via Brave Search.
   - search(query, freshness): busca ao vivo e devolve resultados
   - save(): persiste um item pra ler depois
   - list(): items salvos
═══════════════════════════════════════════════════════════════════ */

export async function searchNews(query: string, freshness: "pd" | "pw" | "pm" = "pw"): Promise<Array<{
  title: string;
  url: string;
  description: string;
  age: string | null;
}>> {
  const results = await braveSearch(query, { count: 12, freshness });
  return results;
}

const JOB_SOURCES = [
  "site:linkedin.com/jobs",
  "site:gupy.io",
  "site:programathor.com.br",
  "site:trampos.co",
  "site:vagas.com.br",
  "site:github.com",
  "site:greenhouse.io",
  "site:lever.co",
] as const;

const NOISE_TERMS = [
  "neymar",
  "futebol",
  "aposta",
  "bet",
  "concurso",
  "estágio obrigatório",
  "curso",
] as const;

function normalizeTerm(term: string): string {
  return term.trim().replace(/\s+/g, " ");
}

function sourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

function scoreJobResult(result: { title: string; description: string; url: string }, input: JobRadarInput): {
  fitScore: number;
  signals: string[];
} {
  const haystack = `${result.title} ${result.description} ${result.url}`.toLowerCase();
  const signals: string[] = [];
  let score = 35;

  for (const stack of input.stack) {
    const s = stack.toLowerCase();
    if (s && haystack.includes(s)) {
      score += 10;
      signals.push(stack);
    }
  }

  if (input.seniority !== "any") {
    const seniorityTerms: Record<string, string[]> = {
      junior: ["junior", "júnior", "jr"],
      pleno: ["pleno", "mid-level", "mid level"],
      senior: ["senior", "sênior", "sr"],
      lead: ["lead", "tech lead", "staff", "principal"],
    };
    if ((seniorityTerms[input.seniority] ?? []).some((t) => haystack.includes(t))) {
      score += 12;
      signals.push(input.seniority);
    }
  }

  if (input.modality !== "any") {
    const modalityTerms: Record<string, string[]> = {
      remote: ["remoto", "remote", "home office"],
      hybrid: ["híbrido", "hybrid", "hibrido"],
      onsite: ["presencial", "onsite", "on-site"],
    };
    if ((modalityTerms[input.modality] ?? []).some((t) => haystack.includes(t))) {
      score += 12;
      signals.push(input.modality === "remote" ? "remoto" : input.modality);
    }
  }

  const source = sourceFromUrl(result.url);
  if (["linkedin.com", "gupy.io", "greenhouse.io", "lever.co"].some((d) => source.includes(d))) {
    score += 8;
    signals.push(source);
  }

  return { fitScore: Math.min(100, score), signals: Array.from(new Set(signals)).slice(0, 5) };
}

export function buildJobRadarQuery(input: JobRadarInput): string {
  const role = normalizeTerm(input.role || "developer");
  const stack = input.stack.map(normalizeTerm).filter(Boolean).slice(0, 8);
  const location = normalizeTerm(input.location || "Brasil");
  const seniority = input.seniority === "any" ? "" : input.seniority;
  const modality =
    input.modality === "remote"
      ? "(remoto OR remote OR \"home office\")"
      : input.modality === "hybrid"
      ? "(híbrido OR hibrido OR hybrid)"
      : input.modality === "onsite"
      ? "(presencial OR onsite OR \"on-site\")"
      : "";
  const international = input.includeInternational ? "OR worldwide OR global OR LATAM" : "";
  const stackBlock = stack.length ? `(${stack.join(" OR ")})` : "";
  const exclusions = [...NOISE_TERMS, ...(input.excludeTerms ?? [])]
    .map(normalizeTerm)
    .filter(Boolean)
    .map((t) => `-${t.replace(/\s+/g, "-")}`)
    .join(" ");

  return [
    "(vaga OR vagas OR hiring OR jobs OR carreira OR oportunidade)",
    role,
    stackBlock,
    seniority,
    modality,
    `(${location} OR Brasil OR BR ${international})`,
    `(${JOB_SOURCES.join(" OR ")})`,
    exclusions,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function searchJobs(input: JobRadarInput): Promise<JobRadarResult[]> {
  const query = buildJobRadarQuery(input);
  const results = await braveSearch(query, { count: 15, freshness: "pw", country: "BR" });
  return results
    .map((r) => {
      const fit = scoreJobResult(r, input);
      return {
        ...r,
        source: sourceFromUrl(r.url),
        fitScore: fit.fitScore,
        signals: fit.signals,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);
}

export async function saveItem(
  userId: string,
  item: { title: string; url: string; summary?: string; source?: string; category?: string },
): Promise<unknown> {
  return prisma.newsItem.upsert({
    where: { userId_url: { userId, url: item.url } },
    create: {
      userId,
      title: item.title,
      url: item.url,
      summary: item.summary ?? null,
      source: item.source ?? null,
      category: item.category ?? "geral",
      saved: true,
    },
    update: { saved: true, title: item.title },
  });
}

export async function listSaved(userId: string): Promise<unknown[]> {
  return prisma.newsItem.findMany({
    where: { userId, saved: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function markRead(userId: string, id: string): Promise<void> {
  const owned = await prisma.newsItem.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Item não encontrado");
  await prisma.newsItem.update({ where: { id }, data: { read: true } });
}

export async function removeItem(userId: string, id: string): Promise<void> {
  const owned = await prisma.newsItem.findFirst({ where: { id, userId } });
  if (!owned) throw new Error("Item não encontrado");
  await prisma.newsItem.delete({ where: { id } });
}
