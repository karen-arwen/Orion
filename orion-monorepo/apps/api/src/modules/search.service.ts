import { prisma } from "../db/prisma.js";

export interface SearchResult {
  type: "task" | "note" | "journal" | "transaction" | "contact" | "goal" | "subscription" | "media" | "recipe" | "travel";
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  icon: string;
  score: number;
}

function score(text: string, q: string): number {
  const t = text.toLowerCase();
  const query = q.toLowerCase();
  if (t === query) return 100;
  if (t.startsWith(query)) return 80;
  if (t.includes(query)) return 60;
  // word match
  const words = query.split(/\s+/);
  const matched = words.filter(w => t.includes(w)).length;
  return Math.round((matched / words.length) * 40);
}

function rankBy(arr: SearchResult[]): SearchResult[] {
  return arr.sort((a, b) => b.score - a.score).slice(0, 30);
}

export async function globalSearch(userId: string, q: string): Promise<SearchResult[]> {
  if (!q || q.trim().length < 2) return [];
  const query = q.trim();
  const results: SearchResult[] = [];

  await Promise.allSettled([
    // Tasks
    prisma.task.findMany({
      where: { userId, OR: [{ title: { contains: query, mode: "insensitive" } }, { notes: { contains: query, mode: "insensitive" } }] },
      take: 10,
    }).then(rows => {
      rows.forEach(r => {
        const s = Math.max(score(r.title, query), r.notes ? score(r.notes, query) : 0);
        if (s > 0) results.push({ type: "task", id: r.id, title: r.title, subtitle: r.notes?.slice(0, 60) ?? r.status, module: "life", icon: "◈", score: s });
      });
    }),

    // Knowledge notes
    prisma.note.findMany({
      where: { userId, OR: [{ title: { contains: query, mode: "insensitive" } }, { content: { contains: query, mode: "insensitive" } }] },
      take: 10,
    }).then(rows => {
      rows.forEach(r => {
        const s = Math.max(score(r.title, query), score(r.content, query));
        if (s > 0) results.push({ type: "note", id: r.id, title: r.title, subtitle: r.content.slice(0, 60), module: "knowledge", icon: "◎", score: s });
      });
    }),

    // Finance transactions
    prisma.financeTransaction.findMany({
      where: { userId, OR: [{ merchant: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }, { note: { contains: query, mode: "insensitive" } }] },
      take: 8,
    }).then(rows => {
      rows.forEach(r => {
        const s = Math.max(
          r.merchant ? score(r.merchant, query) : 0,
          score(r.category, query),
          r.note ? score(r.note, query) : 0,
        );
        if (s > 0) results.push({ type: "transaction", id: r.id, title: r.merchant ?? r.category, subtitle: `R$ ${r.amount.toFixed(2)} · ${r.category}`, module: "finance", icon: "◈", score: s });
      });
    }),

    // Contacts
    prisma.contact.findMany({
      where: { userId, OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, { company: { contains: query, mode: "insensitive" } }] },
      take: 8,
    }).then(rows => {
      rows.forEach(r => {
        const s = Math.max(score(r.name, query), r.email ? score(r.email, query) : 0, r.company ? score(r.company, query) : 0);
        if (s > 0) results.push({ type: "contact", id: r.id, title: r.name, subtitle: r.company ?? r.email ?? undefined, module: "social", icon: "◎", score: s });
      });
    }),

    // Finance goals
    prisma.financeGoal.findMany({
      where: { userId, name: { contains: query, mode: "insensitive" } },
      take: 5,
    }).then(rows => {
      rows.forEach(r => {
        const s = score(r.name, query);
        if (s > 0) results.push({ type: "goal", id: r.id, title: r.name, subtitle: `Alvo: R$ ${r.targetAmount.toFixed(0)}`, module: "finance", icon: "▲", score: s });
      });
    }),

    // Media (books/movies)
    prisma.mediaItem.findMany({
      where: { userId, OR: [{ title: { contains: query, mode: "insensitive" } }, { author: { contains: query, mode: "insensitive" } }] },
      take: 8,
    }).then(rows => {
      rows.forEach(r => {
        const s = Math.max(score(r.title, query), r.author ? score(r.author, query) : 0);
        if (s > 0) results.push({ type: "media", id: r.id, title: r.title, subtitle: `${r.type} · ${r.author ?? r.status}`, module: "media", icon: "▸", score: s });
      });
    }),

    // Travel
    prisma.trip.findMany({
      where: { userId, OR: [{ destination: { contains: query, mode: "insensitive" } }, { notes: { contains: query, mode: "insensitive" } }] },
      take: 5,
    }).then(rows => {
      rows.forEach(r => {
        const s = Math.max(score(r.destination, query), r.notes ? score(r.notes, query) : 0);
        if (s > 0) results.push({ type: "travel", id: r.id, title: r.destination, subtitle: r.notes?.slice(0, 60) ?? undefined, module: "travel", icon: "✦", score: s });
      });
    }),

    // UserPattern (journaling via patternType "journal_*")
    prisma.userPattern.findMany({
      where: { userId, patternType: { startsWith: "journal_" }, OR: [{ patternValue: { contains: query, mode: "insensitive" } }] },
      take: 5,
    }).then(rows => {
      rows.forEach(r => {
        const s = score(r.patternValue, query);
        if (s > 0) results.push({ type: "journal", id: r.id, title: "Entrada de diário", subtitle: r.patternValue.slice(0, 60), module: "diary", icon: "✦", score: s });
      });
    }),
  ]);

  return rankBy(results);
}
