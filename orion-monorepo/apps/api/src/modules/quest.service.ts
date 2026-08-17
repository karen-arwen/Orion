import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════
   QUEST / XP SYSTEM
   Armazena tudo em UserPattern com patternTypes:
     xp_total, xp_log_<timestamp>, achievement_<id>,
     quest_active_<id>, quest_completed_<id>
═══════════════════════════════════════════════════════ */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  xpReward: number;
  unlockedAt?: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  type: "daily" | "weekly" | "story";
  progress: number;       // 0-100
  target: number;
  completed: boolean;
  expiresAt?: string;
}

export interface XpLog {
  action: string;
  xp: number;
  ts: string;
  module?: string;
}

export interface PlayerProfile {
  totalXp: number;
  level: number;
  levelName: string;
  xpToNext: number;
  xpProgress: number;     // 0-100 pct within current level
  achievements: Achievement[];
  activeQuests: Quest[];
  recentXpLog: XpLog[];
}

/* ─── Level thresholds ─── */
const LEVELS = [
  { min: 0,     name: "RECRUIT",      xpToNext: 200 },
  { min: 200,   name: "OPERATIVE",    xpToNext: 500 },
  { min: 700,   name: "SPECIALIST",   xpToNext: 800 },
  { min: 1500,  name: "AGENT",        xpToNext: 1500 },
  { min: 3000,  name: "COMMANDER",    xpToNext: 2000 },
  { min: 5000,  name: "DIRECTOR",     xpToNext: 3000 },
  { min: 8000,  name: "ELITE",        xpToNext: 5000 },
  { min: 13000, name: "LEGEND",       xpToNext: 10000 },
  { min: 23000, name: "APEX",         xpToNext: Infinity },
];

function calcLevel(xp: number): { level: number; levelName: string; xpToNext: number; xpProgress: number } {
  let level = 0;
  let levelName = LEVELS[0]!.name;
  let xpToNext = LEVELS[0]!.xpToNext;
  let base = 0;

  for (let i = 0; i < LEVELS.length; i++) {
    const l = LEVELS[i]!;
    if (xp >= l.min) {
      level = i + 1;
      levelName = l.name;
      xpToNext = l.xpToNext;
      base = l.min;
    }
  }

  const pct = xpToNext === Infinity ? 100 : Math.round(((xp - base) / xpToNext) * 100);
  return { level, levelName, xpToNext: xpToNext === Infinity ? 0 : xpToNext, xpProgress: Math.min(pct, 100) };
}

/* ─── Predefined achievements ─── */
const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: "first_task",      title: "Primeira Missão",   description: "Complete sua primeira tarefa",                  icon: "◈", rarity: "common",    xpReward: 50  },
  { id: "task_10",         title: "Em Ritmo",          description: "Complete 10 tarefas",                           icon: "▸", rarity: "common",    xpReward: 100 },
  { id: "task_50",         title: "Máquina",           description: "Complete 50 tarefas",                           icon: "⬡", rarity: "rare",      xpReward: 300 },
  { id: "task_100",        title: "Centenário",        description: "Complete 100 tarefas",                          icon: "✦", rarity: "epic",      xpReward: 750 },
  { id: "chat_10",         title: "Parceiro",          description: "10 conversas com o ORION",                      icon: "◉", rarity: "common",    xpReward: 75  },
  { id: "habit_streak_7",  title: "Uma Semana",        description: "Mantenha um hábito por 7 dias seguidos",        icon: "◎", rarity: "rare",      xpReward: 200 },
  { id: "habit_streak_30", title: "Mestre do Hábito",  description: "Mantenha um hábito por 30 dias seguidos",       icon: "◈", rarity: "epic",      xpReward: 800 },
  { id: "finance_budget",  title: "Controlado",        description: "Configure seu primeiro budget financeiro",      icon: "◧", rarity: "common",    xpReward: 75  },
  { id: "doc_first",       title: "Analista",          description: "Analise seu primeiro documento",                icon: "◇", rarity: "common",    xpReward: 50  },
  { id: "integration",     title: "Conectado",         description: "Conecte uma integração externa",                icon: "⬡", rarity: "common",    xpReward: 100 },
  { id: "sleep_week",      title: "Dorminhoco Modelo", description: "7 registros de sono consecutivos",              icon: "◌", rarity: "rare",      xpReward: 150 },
  { id: "journal_30",      title: "Crônicas",          description: "30 entradas de diário",                         icon: "✦", rarity: "epic",      xpReward: 500 },
  { id: "level_5",         title: "Director",          description: "Alcance o nível 6 — Director",                 icon: "▲", rarity: "legendary", xpReward: 1000},
  { id: "orion_core",      title: "Núcleo ORION",      description: "Ative todos os módulos pelo menos uma vez",     icon: "◉", rarity: "legendary", xpReward: 2000},
];

/* ─── Predefined daily/weekly quests ─── */
function generateDailyQuests(): Quest[] {
  const today = new Date();
  const exp = new Date(today); exp.setHours(23, 59, 59, 999);
  return [
    { id: "daily_task",    title: "Missão do Dia",      description: "Complete 3 tarefas hoje",       icon: "◈", xpReward: 75,  type: "daily",  progress: 0, target: 3, completed: false, expiresAt: exp.toISOString() },
    { id: "daily_chat",    title: "Consulta Diária",    description: "Converse com o ORION",          icon: "◉", xpReward: 30,  type: "daily",  progress: 0, target: 1, completed: false, expiresAt: exp.toISOString() },
    { id: "daily_habit",   title: "Hábito em Dia",      description: "Registre um hábito hoje",       icon: "▸", xpReward: 50,  type: "daily",  progress: 0, target: 1, completed: false, expiresAt: exp.toISOString() },
  ];
}

function generateWeeklyQuests(): Quest[] {
  const exp = new Date(); exp.setDate(exp.getDate() + (7 - exp.getDay())); exp.setHours(23,59,59,999);
  return [
    { id: "weekly_tasks",  title: "Semana Produtiva",   description: "Complete 15 tarefas esta semana", icon: "▲", xpReward: 300, type: "weekly", progress: 0, target: 15, completed: false, expiresAt: exp.toISOString() },
    { id: "weekly_doc",    title: "Pesquisador",        description: "Analise 2 documentos",            icon: "◎", xpReward: 150, type: "weekly", progress: 0, target: 2,  completed: false, expiresAt: exp.toISOString() },
  ];
}

/* ─── Core functions ─── */

async function getXp(userId: string): Promise<number> {
  const row = await prisma.userPattern.findUnique({ where: { userId_patternType: { userId, patternType: "xp_total" } } });
  return row ? Number(row.data as string) : 0;
}

async function addXp(userId: string, amount: number, action: string, module?: string): Promise<void> {
  const current = await getXp(userId);
  const next = current + amount;
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: "xp_total" } },
    update: { data: String(next) },
    create: { userId, patternType: "xp_total", data: String(next) },
  });
  // Log entry
  const key = `xp_log_${Date.now()}`;
  await prisma.userPattern.create({
    data: { userId, patternType: key, data: JSON.stringify({ action, xp: amount, ts: new Date().toISOString(), module }) },
  });
}

export async function getProfile(userId: string): Promise<PlayerProfile> {
  const totalXp = await getXp(userId);
  const { level, levelName, xpToNext, xpProgress } = calcLevel(totalXp);

  // Unlocked achievements
  const achRows = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: "achievement_" } },
  });
  const unlockedIds = new Set(achRows.map((r: { patternType: string }) => r.patternType.replace("achievement_", "")));
  const achievements: Achievement[] = ALL_ACHIEVEMENTS.map(a => ({
    ...a,
    unlockedAt: achRows.find((r) => r.patternType === `achievement_${a.id}`)?.data as string | undefined,
  }));

  // Active quests (load or generate)
  const questRows = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: "quest_active_" } },
  });
  let activeQuests: Quest[] = questRows.flatMap((r) => {
    try { return [JSON.parse(r.data as string) as Quest]; } catch { return []; }
  });

  // Seed quests if empty or expired
  const now = Date.now();
  activeQuests = activeQuests.filter(q => !q.expiresAt || new Date(q.expiresAt).getTime() > now);
  if (activeQuests.length === 0) {
    const fresh = [...generateDailyQuests(), ...generateWeeklyQuests()];
    for (const q of fresh) {
      await prisma.userPattern.upsert({
        where: { userId_patternType: { userId, patternType: `quest_active_${q.id}` } },
        update: { data: JSON.stringify(q) },
        create: { userId, patternType: `quest_active_${q.id}`, data: JSON.stringify(q) },
      });
    }
    activeQuests = fresh;
  }

  // Recent XP log (last 10)
  const logRows = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: "xp_log_" } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const recentXpLog: XpLog[] = logRows.flatMap((r) => {
    try { return [JSON.parse(r.data as string) as XpLog]; } catch { return []; }
  });

  return { totalXp, level, levelName, xpToNext, xpProgress, achievements, activeQuests, recentXpLog };
}

export async function awardXp(userId: string, action: string, xp: number, module?: string): Promise<{ xp: number; newAchievements: Achievement[] }> {
  await addXp(userId, xp, action, module);
  const profile = await getProfile(userId);
  const newAchs: Achievement[] = [];

  // Check achievements
  const unlockAch = async (id: string): Promise<void> => {
    const ach = ALL_ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return;
    const exists = await prisma.userPattern.findUnique({ where: { userId_patternType: { userId, patternType: `achievement_${id}` } } });
    if (!exists) {
      await prisma.userPattern.create({ data: { userId, patternType: `achievement_${id}`, data: new Date().toISOString() } });
      await addXp(userId, ach.xpReward, `Conquista: ${ach.title}`);
      newAchs.push({ ...ach, unlockedAt: new Date().toISOString() });
    }
  };

  // Level-based achievement
  if (profile.level >= 6) await unlockAch("level_5");

  // Module-based
  if (module === "docs") await unlockAch("doc_first");
  if (module === "finance") await unlockAch("finance_budget");

  return { xp, newAchievements: newAchs };
}

export async function updateQuestProgress(userId: string, questId: string, increment: number): Promise<void> {
  const row = await prisma.userPattern.findUnique({ where: { userId_patternType: { userId, patternType: `quest_active_${questId}` } } });
  if (!row) return;
  try {
    const quest = JSON.parse(row.data as string) as Quest;
    quest.progress = Math.min(quest.progress + increment, quest.target);
    quest.completed = quest.progress >= quest.target;
    await prisma.userPattern.update({ where: { id: row.id }, data: { data: JSON.stringify(quest) } });
    if (quest.completed) {
      await awardXp(userId, `Quest: ${quest.title}`, quest.xpReward);
    }
  } catch { /* noop */ }
}
