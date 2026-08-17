import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   UNIVERSAL SEARCH — busca cross-module em tudo.

   "acha aquele arquivo da faculdade sobre grafos"
   "qual foi o email que falava do boleto?"
   "qual reuniao decidiu isso?"

   Busca em: tarefas, memorias, conversas, financas, metas,
   habitos, contatos, ideias, documentos, jogos, midia, compras,
   lessons, alertas, decisoes.
═══════════════════════════════════════════════════════════════════ */

export interface SearchResult {
  id: string;
  type: string;       // task, memory, conversation, finance, goal, habit, etc.
  title: string;
  preview: string;
  module: string;      // qual modulo tem esse item
  relevance: number;   // 0-1
  date: Date;
  url?: string;        // deep link pro item
}

export async function universalSearch(userId: string, query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  // Search in parallel across all modules
  const [tasks, memories, conversations, transactions, goals, habits, contacts, ideas, games, media, wishlist, lessons] = await Promise.all([
    // Tasks
    prisma.task.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      take: 5, orderBy: { createdAt: "desc" },
    }),
    // Memories
    prisma.memory.findMany({
      where: { userId, content: { contains: q, mode: "insensitive" } },
      take: 5, orderBy: { importance: "desc" },
    }),
    // Conversations
    prisma.conversation.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      take: 5, orderBy: { updatedAt: "desc" },
    }),
    // Finance
    prisma.financeTransaction.findMany({
      where: { userId, OR: [{ category: { contains: q, mode: "insensitive" } }, { merchant: { contains: q, mode: "insensitive" } }, { note: { contains: q, mode: "insensitive" } }] },
      take: 5, orderBy: { occurredAt: "desc" },
    }),
    // Goals
    prisma.goal.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      take: 5, orderBy: { updatedAt: "desc" },
    }).catch(() => [] as Array<{ id: string; title: string; status: string; createdAt: Date }>),
    // Habits
    prisma.habit.findMany({
      where: { userId, name: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    // Social contacts
    prisma.socialContact.findMany({
      where: { userId, OR: [{ name: { contains: q, mode: "insensitive" } }, { context: { contains: q, mode: "insensitive" } }] },
      take: 5,
    }),
    // Content ideas
    prisma.contentIdea.findMany({
      where: { userId, OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] },
      take: 5, orderBy: { createdAt: "desc" },
    }),
    // Games
    prisma.gameEntry.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    // Media
    prisma.mediaItem.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    // Wishlist
    prisma.wishlistItem.findMany({
      where: { userId, name: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    // Lessons
    prisma.lessonSession.findMany({
      where: { userId, topic: { contains: q, mode: "insensitive" } },
      take: 5, orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Map results to uniform format
  for (const t of tasks) {
    results.push({ id: t.id, type: "task", title: t.title, preview: `[${t.status}] P${t.priority}`, module: "life", relevance: 0.8, date: t.createdAt, url: "/m/life" });
  }
  for (const m of memories) {
    results.push({ id: m.id, type: "memory", title: `[${m.type}] ${m.content.slice(0, 60)}`, preview: m.content.slice(0, 120), module: "memory", relevance: m.importance, date: m.createdAt });
  }
  for (const c of conversations) {
    results.push({ id: c.id, type: "conversation", title: c.title ?? "Conversa", preview: `${c.moduleId ?? "chat"}`, module: "chat", relevance: 0.7, date: c.updatedAt });
  }
  for (const tx of transactions) {
    results.push({ id: tx.id, type: "finance", title: `${tx.merchant || tx.category}: R$ ${tx.amount.toFixed(2)}`, preview: tx.note ?? "", module: "finance", relevance: 0.6, date: tx.occurredAt, url: "/m/finance" });
  }
  for (const g of goals) {
    results.push({ id: g.id, type: "goal", title: g.title, preview: `[${g.status}]`, module: "goals", relevance: 0.8, date: g.createdAt });
  }
  for (const h of habits) {
    results.push({ id: h.id, type: "habit", title: h.name, preview: `Streak: ${h.streak}d`, module: "habits", relevance: 0.6, date: h.createdAt, url: "/m/habits" });
  }
  for (const c of contacts) {
    results.push({ id: c.id, type: "contact", title: c.name, preview: c.context ?? "", module: "social", relevance: 0.7, date: c.createdAt, url: "/m/social" });
  }
  for (const i of ideas) {
    results.push({ id: i.id, type: "idea", title: i.title, preview: i.body?.slice(0, 100) ?? "", module: "creative", relevance: 0.6, date: i.createdAt, url: "/m/creative" });
  }
  for (const g of games) {
    results.push({ id: g.id, type: "game", title: g.title, preview: `[${g.status}] ${g.hoursPlayed}h`, module: "gaming", relevance: 0.5, date: g.createdAt, url: "/m/gaming" });
  }
  for (const m of media) {
    results.push({ id: m.id, type: "media", title: m.title, preview: `[${m.kind}] ${m.status}`, module: "media", relevance: 0.5, date: m.createdAt, url: "/m/media" });
  }
  for (const w of wishlist) {
    results.push({ id: w.id, type: "wishlist", title: w.name, preview: w.currentPrice ? `R$ ${w.currentPrice.toFixed(2)}` : "", module: "shop", relevance: 0.5, date: w.createdAt, url: "/m/shop" });
  }
  for (const l of lessons) {
    results.push({ id: l.id, type: "lesson", title: l.topic, preview: `[${l.level}]`, module: "know", relevance: 0.6, date: l.createdAt, url: "/m/know" });
  }

  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, limit);
}
