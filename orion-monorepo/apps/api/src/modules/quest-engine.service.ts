import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   QUEST ENGINE — transforma a vida do usuario em RPG.

   XP por acoes reais:
   - Completar tarefa: 25-100 XP (por prioridade)
   - Concluir habito: 15 XP
   - Sessao de foco: 20-50 XP (por duracao)
   - Completar quest: 100-500 XP
   - Streak de 7 dias: 200 XP bonus
   - Registrar sono: 10 XP
   - Registrar energia: 5 XP

   Niveis: XP total / 1000 (nivel 1 = 0-999, nivel 2 = 1000-1999, etc.)
   
   Quests: geradas pela IA baseadas nas metas e contexto do usuario.
   Achievements: desbloqueados por marcos especificos.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ── XP System ─────────────────────────────────────────────────────

const XP_VALUES: Record<string, number> = {
  task_complete_p1: 100,
  task_complete_p2: 50,
  task_complete_p3: 25,
  habit_complete: 15,
  focus_25: 20,
  focus_45: 35,
  focus_90: 50,
  quest_complete: 100,
  streak_7: 200,
  streak_30: 500,
  streak_100: 1000,
  sleep_log: 10,
  energy_log: 5,
  lesson_complete: 75,
  goal_milestone: 150,
  goal_complete: 500,
  first_task: 50,
  first_habit: 50,
  first_focus: 50,
};

export async function awardXP(userId: string, source: string, detail?: string): Promise<{ xp: number; newTotal: number; levelUp: boolean; newLevel: number }> {
  const amount = XP_VALUES[source] ?? 10;

  await prisma.xPEvent.create({
    data: { userId, amount, source, detail },
  });

  // Calculate total XP
  const result = await prisma.xPEvent.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  const totalXP = result._sum.amount ?? 0;
  const newLevel = Math.floor(totalXP / 1000) + 1;

  // Check for level up (compare with previous)
  const prevTotal = totalXP - amount;
  const prevLevel = Math.floor(prevTotal / 1000) + 1;
  const levelUp = newLevel > prevLevel;

  // Check achievements on level up
  if (levelUp) {
    await checkAchievements(userId, totalXP, newLevel);
  }

  return { xp: amount, newTotal: totalXP, levelUp, newLevel };
}

export async function getPlayerStats(userId: string): Promise<{
  totalXP: number;
  level: number;
  xpToNextLevel: number;
  progressPct: number;
  rank: string;
  achievements: number;
  questsCompleted: number;
  currentStreak: number;
}> {
  const [xpResult, achievementCount, questCount] = await Promise.all([
    prisma.xPEvent.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.achievement.count({ where: { userId } }),
    prisma.quest.count({ where: { userId, completed: true } }),
  ]);

  const totalXP = xpResult._sum.amount ?? 0;
  const level = Math.floor(totalXP / 1000) + 1;
  const xpInLevel = totalXP % 1000;
  const xpToNextLevel = 1000 - xpInLevel;
  const progressPct = Math.round((xpInLevel / 1000) * 100);

  const ranks = ["Recruta", "Iniciado", "Aprendiz", "Guerreiro", "Guardiao", "Mestre", "Lenda", "ORION"];
  const rank = ranks[Math.min(Math.floor(level / 5), ranks.length - 1)] ?? "ORION";

  // Get longest current streak from habits
  const habits = await prisma.habit.findMany({
    where: { userId, archivedAt: null },
    select: { streak: true },
  });
  const currentStreak = Math.max(0, ...habits.map((h) => h.streak));

  return { totalXP, level, xpToNextLevel, progressPct, rank, achievements: achievementCount, questsCompleted: questCount, currentStreak };
}

// ── Achievement System ────────────────────────────────────────────

const ACHIEVEMENT_DEFS: Array<{
  slug: string;
  title: string;
  description: string;
  icon: string;
  rarity: string;
  check: (userId: string, totalXP: number, level: number) => Promise<boolean>;
}> = [
  { slug: "first_blood", title: "First Blood", description: "Completou a primeira tarefa", icon: "⚔", rarity: "common",
    check: async (userId) => (await prisma.task.count({ where: { userId, status: "done" } })) >= 1 },
  { slug: "streak_warrior", title: "Streak Warrior", description: "7 dias consecutivos de habito", icon: "🔥", rarity: "rare",
    check: async (userId) => (await prisma.habit.findFirst({ where: { userId, streak: { gte: 7 } } })) !== null },
  { slug: "streak_legend", title: "Streak Legend", description: "30 dias consecutivos", icon: "💎", rarity: "epic",
    check: async (userId) => (await prisma.habit.findFirst({ where: { userId, streak: { gte: 30 } } })) !== null },
  { slug: "focus_master", title: "Focus Master", description: "10 sessoes de foco completas", icon: "🧠", rarity: "rare",
    check: async (userId) => (await prisma.focusSession.count({ where: { userId, completed: true } })) >= 10 },
  { slug: "deep_worker", title: "Deep Worker", description: "Sessao de 90min completa", icon: "⚡", rarity: "epic",
    check: async (userId) => (await prisma.focusSession.findFirst({ where: { userId, completed: true, duration: { gte: 90 } } })) !== null },
  { slug: "level_5", title: "Rising Star", description: "Alcancou nivel 5", icon: "⭐", rarity: "common",
    check: async (_, __, level) => level >= 5 },
  { slug: "level_10", title: "Dedicated", description: "Alcancou nivel 10", icon: "🌟", rarity: "rare",
    check: async (_, __, level) => level >= 10 },
  { slug: "level_25", title: "Unstoppable", description: "Alcancou nivel 25", icon: "💫", rarity: "epic",
    check: async (_, __, level) => level >= 25 },
  { slug: "level_50", title: "ORION Elite", description: "Alcancou nivel 50", icon: "🏆", rarity: "legendary",
    check: async (_, __, level) => level >= 50 },
  { slug: "polyglot", title: "Polyglot", description: "Praticou 3 idiomas diferentes", icon: "🌍", rarity: "rare",
    check: async () => false }, // TODO: check language sessions
  { slug: "budget_hero", title: "Budget Hero", description: "Meta financeira completada", icon: "💰", rarity: "rare",
    check: async (userId) => (await prisma.financeGoal.findFirst({ where: { userId, status: "completed" } })) !== null },
  { slug: "night_owl", title: "Night Owl", description: "Registrou sono 7 dias seguidos", icon: "🦉", rarity: "common",
    check: async (userId) => (await prisma.sleepLog.count({ where: { userId } })) >= 7 },
  { slug: "social_butterfly", title: "Social Butterfly", description: "10+ contatos no CRM", icon: "🦋", rarity: "common",
    check: async (userId) => (await prisma.socialContact.count({ where: { userId } })) >= 10 },
  { slug: "knowledge_seeker", title: "Knowledge Seeker", description: "5 aulas completadas", icon: "📚", rarity: "rare",
    check: async (userId) => (await prisma.lessonSession.count({ where: { userId } })) >= 5 },
];

async function checkAchievements(userId: string, totalXP: number, level: number): Promise<void> {
  for (const def of ACHIEVEMENT_DEFS) {
    const existing = await prisma.achievement.findUnique({
      where: { userId_slug: { userId, slug: def.slug } },
    });
    if (existing) continue;

    try {
      const earned = await def.check(userId, totalXP, level);
      if (earned) {
        await prisma.achievement.create({
          data: { userId, slug: def.slug, title: def.title, description: def.description, icon: def.icon, rarity: def.rarity },
        });
      }
    } catch { /* best effort */ }
  }
}

export async function getAchievements(userId: string): Promise<Array<{
  slug: string; title: string; description: string; icon: string; rarity: string; unlockedAt: Date;
}>> {
  return prisma.achievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "desc" },
    select: { slug: true, title: true, description: true, icon: true, rarity: true, unlockedAt: true },
  });
}

// ── Quest Generation ──────────────────────────────────────────────

export async function generateDailyQuests(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  // Check if already generated today
  const existing = await prisma.quest.count({
    where: { userId, type: "daily", createdAt: { gte: new Date(today) } },
  });
  if (existing >= 3) return 0;

  // Get user context
  const [tasks, habits, goals] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: "todo" }, take: 5 }),
    prisma.habit.findMany({ where: { userId, archivedAt: null }, take: 5 }),
    prisma.goal.findMany({ where: { userId, status: "active" }, take: 3 }).catch(() => []),
  ]);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    temperature: 0.7,
    system: `Gere 3 quests diarias baseadas no contexto do usuario. Cada quest deve ser completavel em 1 dia.
Devolva JSON: [{"title":"titulo","description":"descricao curta","category":"foco|disciplina|saude|estudo|social","xpReward":50-200,"steps":[{"title":"passo","completed":false,"order":1}]}]`,
    messages: [{ role: "user", content: JSON.stringify({
      tarefas_pendentes: tasks.map((t) => t.title),
      habitos: habits.map((h) => h.name),
      metas: goals.map((g) => g.title),
    }) }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("").trim();

  let quests: Array<{ title: string; description: string; category: string; xpReward: number; steps: Array<{ title: string; completed: boolean; order: number }> }> = [];
  try {
    const first = text.indexOf("[");
    const last = text.lastIndexOf("]");
    quests = JSON.parse(text.slice(first, last + 1));
  } catch { return 0; }

  let created = 0;
  for (const q of quests.slice(0, 3)) {
    await prisma.quest.create({
      data: {
        userId,
        title: q.title,
        description: q.description,
        category: q.category,
        xpReward: q.xpReward,
        steps: q.steps,
        type: "daily",
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    created++;
  }
  return created;
}

export async function getActiveQuests(userId: string): Promise<unknown[]> {
  return prisma.quest.findMany({
    where: { userId, completed: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
  });
}

export async function completeQuest(userId: string, questId: string): Promise<{ xp: number }> {
  const quest = await prisma.quest.findFirst({ where: { id: questId, userId, completed: false } });
  if (!quest) throw new Error("Quest nao encontrada");

  await prisma.quest.update({
    where: { id: questId },
    data: { completed: true, completedAt: new Date() },
  });

  const result = await awardXP(userId, "quest_complete", quest.title);
  // Award extra XP based on quest reward
  if (quest.xpReward > 100) {
    await awardXP(userId, "quest_complete", `bonus: ${quest.title}`);
  }

  return { xp: result.xp };
}
