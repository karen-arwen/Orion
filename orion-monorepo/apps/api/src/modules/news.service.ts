import { prisma } from "../db/prisma.js";
import { braveSearch } from "../integrations/brave-search.js";

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
