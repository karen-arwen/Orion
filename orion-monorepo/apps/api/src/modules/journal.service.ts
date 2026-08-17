import { prisma } from "../db/prisma.js";
import Anthropic from "@anthropic-ai/sdk";

/* ═══════════════════════════════════════════════════════════════
   JOURNAL SERVICE
   Storage keys (UserPattern):
     journal_entry_<YYYY-MM-DD>   -> JournalEntry JSON
     journal_insight_<YYYY-MM-DD> -> JournalInsight JSON
     journal_streak               -> number (current streak)
═══════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic();

export interface JournalEntry {
  date: string;          // YYYY-MM-DD
  mood: number;          // 1-5
  energy: number;        // 1-5
  gratitude: string[];   // 1-3 items
  highlight: string;     // best moment
  challenge: string;     // biggest obstacle
  reflection: string;    // free text
  intentions: string[];  // tomorrow goals
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalInsight {
  date: string;
  summary: string;
  patterns: string[];
  suggestions: string[];
  affirmation: string;
  generatedAt: string;
}

export interface JournalStats {
  streak: number;
  totalEntries: number;
  avgMood: number;
  avgEnergy: number;
  topTags: Array<{ tag: string; count: number }>;
  moodHistory: Array<{ date: string; mood: number; energy: number }>;
}

/* ─── Helpers ─── */

function dateKey(date: string): string {
  return `journal_entry_${date}`;
}

function insightKey(date: string): string {
  return `journal_insight_${date}`;
}

async function getEntry(userId: string, date: string): Promise<JournalEntry | null> {
  const row = await prisma.userPattern.findUnique({
    where: { userId_patternType: { userId, patternType: dateKey(date) } },
  });
  if (!row) return null;
  try { return JSON.parse(row.data as string) as JournalEntry; } catch { return null; }
}

async function saveEntry(userId: string, entry: JournalEntry): Promise<void> {
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: dateKey(entry.date) } },
    update: { data: JSON.stringify(entry) },
    create: { userId, patternType: dateKey(entry.date), data: JSON.stringify(entry) },
  });
}

async function calcStreak(userId: string): Promise<number> {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const exists = await prisma.userPattern.findUnique({
      where: { userId_patternType: { userId, patternType: dateKey(dateStr) } },
    });
    if (exists) { streak++; } else { break; }
  }
  return streak;
}

/* ─── Public API ─── */

export async function listEntries(userId: string, days = 30): Promise<JournalEntry[]> {
  const rows = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: "journal_entry_" } },
    orderBy: { createdAt: "desc" },
    take: days,
  });
  const entries: JournalEntry[] = [];
  for (const r of rows) {
    try { entries.push(JSON.parse(r.data as string) as JournalEntry); } catch { /* skip */ }
  }
  return entries;
}

export async function getTodayEntry(userId: string): Promise<JournalEntry | null> {
  const today = new Date().toISOString().slice(0, 10);
  return getEntry(userId, today);
}

export async function upsertEntry(
  userId: string,
  input: Partial<Omit<JournalEntry, "date" | "createdAt" | "updatedAt">>,
  date?: string,
): Promise<JournalEntry> {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const existing = await getEntry(userId, targetDate);
  const now = new Date().toISOString();

  const entry: JournalEntry = {
    date: targetDate,
    mood: input.mood ?? existing?.mood ?? 3,
    energy: input.energy ?? existing?.energy ?? 3,
    gratitude: input.gratitude ?? existing?.gratitude ?? [],
    highlight: input.highlight ?? existing?.highlight ?? "",
    challenge: input.challenge ?? existing?.challenge ?? "",
    reflection: input.reflection ?? existing?.reflection ?? "",
    intentions: input.intentions ?? existing?.intentions ?? [],
    tags: input.tags ?? existing?.tags ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await saveEntry(userId, entry);

  // Update streak
  const streak = await calcStreak(userId);
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: "journal_streak" } },
    update: { data: String(streak) },
    create: { userId, patternType: "journal_streak", data: String(streak) },
  });

  return entry;
}

export async function getStats(userId: string): Promise<JournalStats> {
  const rows = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: "journal_entry_" } },
    orderBy: { createdAt: "desc" },
    take: 90,
  });

  const entries: JournalEntry[] = [];
  for (const r of rows) {
    try { entries.push(JSON.parse(r.data as string) as JournalEntry); } catch { /* skip */ }
  }

  const streakRow = await prisma.userPattern.findUnique({
    where: { userId_patternType: { userId, patternType: "journal_streak" } },
  });

  const tagCounts: Record<string, number> = {};
  let moodSum = 0; let energySum = 0;
  const moodHistory: Array<{ date: string; mood: number; energy: number }> = [];

  for (const e of entries) {
    moodSum += e.mood; energySum += e.energy;
    moodHistory.push({ date: e.date, mood: e.mood, energy: e.energy });
    for (const t of e.tags) { tagCounts[t] = (tagCounts[t] ?? 0) + 1; }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  return {
    streak: streakRow ? Number(streakRow.data as string) : 0,
    totalEntries: entries.length,
    avgMood: entries.length ? Math.round((moodSum / entries.length) * 10) / 10 : 0,
    avgEnergy: entries.length ? Math.round((energySum / entries.length) * 10) / 10 : 0,
    topTags,
    moodHistory: moodHistory.slice(0, 30),
  };
}

export async function generateInsight(userId: string, date?: string): Promise<JournalInsight> {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const entry = await getEntry(userId, targetDate);
  if (!entry) throw new Error("Entry not found");

  // Check cache
  const cached = await prisma.userPattern.findUnique({
    where: { userId_patternType: { userId, patternType: insightKey(targetDate) } },
  });
  if (cached) {
    try { return JSON.parse(cached.data as string) as JournalInsight; } catch { /* regenerate */ }
  }

  // Recent context for patterns
  const recent = await listEntries(userId, 7);

  const prompt = `Voce e o ORION, assistente pessoal Jarvis-like. Analise esta entrada de diario e gere insights profundos, empaticos e acionaveis.

ENTRADA DO DIA ${entry.date}:
- Humor: ${entry.mood}/5 | Energia: ${entry.energy}/5
- Gratidao: ${entry.gratitude.join(", ") || "nao informado"}
- Destaque do dia: ${entry.highlight || "nao informado"}
- Desafio: ${entry.challenge || "nao informado"}
- Reflexao: ${entry.reflection || "nao informado"}
- Intencoes para amanha: ${entry.intentions.join(", ") || "nao informado"}
- Tags: ${entry.tags.join(", ") || "nenhuma"}

CONTEXTO RECENTE (ultimos 7 dias):
${recent.slice(0, 7).map(e => `${e.date}: humor ${e.mood}, energia ${e.energy}`).join("\n")}

Responda APENAS com JSON valido neste formato exato:
{
  "summary": "resumo perspicaz de 2-3 frases do dia",
  "patterns": ["padrao observado 1", "padrao observado 2", "padrao observado 3"],
  "suggestions": ["sugestao concreta 1", "sugestao concreta 2"],
  "affirmation": "uma afirmacao personalizada e poderosa baseada na jornada da pessoa"
}`;

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content[0]?.type === "text" ? res.content[0].text : "{}";
  let parsed: { summary?: string; patterns?: string[]; suggestions?: string[]; affirmation?: string } = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
  } catch { /* use defaults */ }

  const insight: JournalInsight = {
    date: targetDate,
    summary: parsed.summary ?? "Um dia de reflexao e crescimento.",
    patterns: parsed.patterns ?? [],
    suggestions: parsed.suggestions ?? [],
    affirmation: parsed.affirmation ?? "Cada dia e uma oportunidade de evolucao.",
    generatedAt: new Date().toISOString(),
  };

  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: insightKey(targetDate) } },
    update: { data: JSON.stringify(insight) },
    create: { userId, patternType: insightKey(targetDate), data: JSON.stringify(insight) },
  });

  return insight;
}

export async function getInsight(userId: string, date: string): Promise<JournalInsight | null> {
  const row = await prisma.userPattern.findUnique({
    where: { userId_patternType: { userId, patternType: insightKey(date) } },
  });
  if (!row) return null;
  try { return JSON.parse(row.data as string) as JournalInsight; } catch { return null; }
}

export async function deleteEntry(userId: string, date: string): Promise<void> {
  await prisma.userPattern.deleteMany({
    where: { userId, patternType: { in: [dateKey(date), insightKey(date)] } },
  });
}
