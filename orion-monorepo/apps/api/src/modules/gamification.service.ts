import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";

/* ═══════════════════════════════════════════════════════════════════
   GAMIFICATION — XP, níveis e conquistas.

   O ORION recompensa consistência:
   - XP por ações reais (completar tarefa, foco, hábito, check-in)
   - Níveis de 1-50 com títulos temáticos
   - Conquistas desbloqueáveis por marcos
   - Streak multiplier (dias consecutivos = XP bonus)
═══════════════════════════════════════════════════════════════════ */

const LEVEL_TITLES: Record<number, string> = {
  1: "Iniciante", 5: "Aprendiz", 10: "Operador",
  15: "Estrategista", 20: "Comandante", 25: "Especialista",
  30: "Mestre", 35: "Visionario", 40: "Lendario",
  45: "Transcendente", 50: "O.R.I.O.N.",
};

const XP_PER_ACTION: Record<string, number> = {
  "task.complete": 25,
  "habit.check": 15,
  "focus.complete": 30,
  "focus.deep": 50,
  "mindset.checkin": 10,
  "sleep.log": 10,
  "journal.entry": 20,
  "goal.milestone": 40,
  "chat.conversation": 5,
  "morning_brief.read": 10,
  "weekly_review.read": 15,
};

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (stats: UserGameStats) => boolean;
  xpReward: number;
}

interface UserGameStats {
  totalXp: number;
  level: number;
  tasksCompleted: number;
  habitsChecked: number;
  focusSessions: number;
  focusMinutes: number;
  loginStreak: number;
  bestLoginStreak: number;
  journalEntries: number;
  conversationCount: number;
  goalsCompleted: number;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_task", title: "Primeiro Passo", description: "Complete sua primeira tarefa", icon: "✓", condition: (s) => s.tasksCompleted >= 1, xpReward: 50 },
  { id: "task_10", title: "Produtivo", description: "Complete 10 tarefas", icon: "◈", condition: (s) => s.tasksCompleted >= 10, xpReward: 100 },
  { id: "task_50", title: "Maquina de Executar", description: "Complete 50 tarefas", icon: "⚡", condition: (s) => s.tasksCompleted >= 50, xpReward: 250 },
  { id: "task_200", title: "Imparavel", description: "Complete 200 tarefas", icon: "★", condition: (s) => s.tasksCompleted >= 200, xpReward: 500 },
  { id: "habit_7", title: "Semana Perfeita", description: "Marque habitos por 7 dias seguidos", icon: "🔥", condition: (s) => s.loginStreak >= 7, xpReward: 150 },
  { id: "habit_30", title: "Disciplinado", description: "30 dias de streak", icon: "◉", condition: (s) => s.loginStreak >= 30, xpReward: 400 },
  { id: "focus_1h", title: "Hora de Ouro", description: "Acumule 60min de foco em um dia", icon: "⏱", condition: (s) => s.focusMinutes >= 60, xpReward: 100 },
  { id: "focus_100", title: "Mestre do Foco", description: "Complete 100 sessoes de foco", icon: "◎", condition: (s) => s.focusSessions >= 100, xpReward: 300 },
  { id: "journal_10", title: "Introspectivo", description: "Escreva 10 entradas no diario", icon: "✎", condition: (s) => s.journalEntries >= 10, xpReward: 100 },
  { id: "journal_50", title: "Escritor da Vida", description: "50 entradas no diario", icon: "◆", condition: (s) => s.journalEntries >= 50, xpReward: 250 },
  { id: "chat_100", title: "Parceiro do ORION", description: "100 conversas com o ORION", icon: "◇", condition: (s) => s.conversationCount >= 100, xpReward: 200 },
  { id: "level_10", title: "Operador Certificado", description: "Alcance nivel 10", icon: "▲", condition: (s) => s.level >= 10, xpReward: 200 },
  { id: "level_25", title: "Elite", description: "Alcance nivel 25", icon: "♦", condition: (s) => s.level >= 25, xpReward: 500 },
  { id: "goal_1", title: "Meta Cumprida", description: "Complete sua primeira meta", icon: "⊕", condition: (s) => s.goalsCompleted >= 1, xpReward: 200 },
];

function xpForLevel(level: number): number {
  // Exponential curve: level 1=100, level 10=1000, level 50=12500
  return Math.floor(100 * Math.pow(level, 1.5));
}

function levelFromXp(totalXp: number): number {
  let level = 1;
  let xpNeeded = 0;
  while (level < 50) {
    xpNeeded += xpForLevel(level);
    if (totalXp < xpNeeded) break;
    level++;
  }
  return level;
}

function getLevelTitle(level: number): string {
  let title = "Iniciante";
  for (const [threshold, name] of Object.entries(LEVEL_TITLES)) {
    if (level >= parseInt(threshold)) title = name;
  }
  return title;
}

/** Award XP for an action */
export async function awardXp(userId: string, action: string, multiplier = 1): Promise<{
  xpAwarded: number;
  totalXp: number;
  level: number;
  levelUp: boolean;
  newAchievements: string[];
}> {
  const baseXp = XP_PER_ACTION[action] ?? 5;

  // Streak multiplier
  const streakKey = `login_streak:${userId}`;
  const streak = parseInt((await redis.get(streakKey)) ?? "0", 10);
  const streakBonus = Math.min(2, 1 + streak * 0.05); // max 2x at 20 day streak

  const xpAwarded = Math.round(baseXp * multiplier * streakBonus);

  // Get or create game profile
  const pref = await prisma.userPreference.findFirst({
    where: { userId, key: "game_profile" },
  }).catch(() => null);

  let stats: UserGameStats = pref?.value ? JSON.parse(pref.value) as UserGameStats : {
    totalXp: 0, level: 1, tasksCompleted: 0, habitsChecked: 0,
    focusSessions: 0, focusMinutes: 0, loginStreak: 0, bestLoginStreak: 0,
    journalEntries: 0, conversationCount: 0, goalsCompleted: 0,
  };

  const oldLevel = stats.level;
  stats.totalXp += xpAwarded;
  stats.level = levelFromXp(stats.totalXp);

  // Update action-specific counters
  if (action === "task.complete") stats.tasksCompleted++;
  if (action === "habit.check") stats.habitsChecked++;
  if (action === "focus.complete" || action === "focus.deep") stats.focusSessions++;
  if (action === "journal.entry") stats.journalEntries++;
  if (action === "chat.conversation") stats.conversationCount++;
  if (action === "goal.milestone") stats.goalsCompleted++;

  stats.loginStreak = streak;
  stats.bestLoginStreak = Math.max(stats.bestLoginStreak, streak);

  // Check new achievements
  const unlockedKey = `achievements:${userId}`;
  const unlockedRaw = await redis.get(unlockedKey).catch(() => "[]");
  const unlocked = new Set<string>(JSON.parse(unlockedRaw ?? "[]") as string[]);
  const newAchievements: string[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.has(ach.id) && ach.condition(stats)) {
      unlocked.add(ach.id);
      newAchievements.push(ach.title);
      stats.totalXp += ach.xpReward;
    }
  }

  stats.level = levelFromXp(stats.totalXp);
  if (newAchievements.length) {
    await redis.set(unlockedKey, JSON.stringify([...unlocked]));
  }

  // Save
  await prisma.userPreference.upsert({
    where: { userId_key_layer: { userId, key: "game_profile", layer: "current" } },
    update: { value: JSON.stringify(stats) },
    create: { userId, key: "game_profile", value: JSON.stringify(stats), layer: "current", confidence: 1 },
  });

  return {
    xpAwarded,
    totalXp: stats.totalXp,
    level: stats.level,
    levelUp: stats.level > oldLevel,
    newAchievements,
  };
}

/** Get full game profile */
export async function getGameProfile(userId: string): Promise<{
  stats: UserGameStats;
  title: string;
  xpToNextLevel: number;
  xpProgress: number;
  achievements: Array<{ id: string; title: string; description: string; icon: string; unlocked: boolean }>;
}> {
  const pref = await prisma.userPreference.findFirst({
    where: { userId, key: "game_profile" },
  }).catch(() => null);

  const stats: UserGameStats = pref?.value ? JSON.parse(pref.value) as UserGameStats : {
    totalXp: 0, level: 1, tasksCompleted: 0, habitsChecked: 0,
    focusSessions: 0, focusMinutes: 0, loginStreak: 0, bestLoginStreak: 0,
    journalEntries: 0, conversationCount: 0, goalsCompleted: 0,
  };

  const unlockedRaw = await redis.get(`achievements:${userId}`).catch(() => "[]");
  const unlocked = new Set<string>(JSON.parse(unlockedRaw ?? "[]") as string[]);

  let xpAccum = 0;
  for (let l = 1; l < stats.level; l++) xpAccum += xpForLevel(l);
  const xpInCurrentLevel = stats.totalXp - xpAccum;
  const xpNeeded = xpForLevel(stats.level);

  return {
    stats,
    title: getLevelTitle(stats.level),
    xpToNextLevel: xpNeeded - xpInCurrentLevel,
    xpProgress: Math.round((xpInCurrentLevel / xpNeeded) * 100),
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id, title: a.title, description: a.description, icon: a.icon,
      unlocked: unlocked.has(a.id),
    })),
  };
}

/** Record daily login for streak */
export async function recordDailyLogin(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const lastKey = `last_login:${userId}`;
  const streakKey = `login_streak:${userId}`;

  const lastLogin = await redis.get(lastKey).catch(() => null);
  let streak = parseInt((await redis.get(streakKey)) ?? "0", 10);

  if (lastLogin === today) return streak; // Already logged today

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (lastLogin === yesterday) {
    streak++;
  } else {
    streak = 1; // Reset
  }

  await redis.set(lastKey, today);
  await redis.set(streakKey, String(streak));

  return streak;
}
