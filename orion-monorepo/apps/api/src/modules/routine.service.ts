import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   ROTINAS — builder + execucao + nudge do ORION
   Tudo em UserPattern com prefixos:
     routine_def_<id>   = definicao da rotina
     routine_log_<date>_<id> = execucao do dia
═══════════════════════════════════════════════════════════════════ */

export type RoutineFrequency = "daily" | "weekdays" | "weekends" | "custom";
export type StepType = "task" | "checkin" | "timer" | "note" | "habit";

export interface RoutineStep {
  id: string;
  label: string;
  type: StepType;
  durationMin?: number;
  habitId?: string;
  note?: string;
}

export interface RoutineDef {
  id: string;
  name: string;
  icon: string;
  description?: string;
  frequency: RoutineFrequency;
  customDays?: number[];     // 0=Sun..6=Sat when frequency=custom
  startTime?: string;        // "HH:MM"
  steps: RoutineStep[];
  active: boolean;
  createdAt: string;
  totalXp: number;           // XP awarded on completion
}

export interface RoutineLog {
  routineId: string;
  date: string;              // YYYY-MM-DD
  completedSteps: string[];  // step ids
  finished: boolean;
  startedAt: string;
  finishedAt?: string;
  durationMin?: number;
  streak?: number;
}

/* ─── helpers ─── */
function routineKey(id: string): string { return `routine_def_${id}`; }
function logKey(date: string, routineId: string): string { return `routine_log_${date}_${routineId}`; }
function uid(): string { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ─── CRUD ─── */

export async function listRoutines(userId: string): Promise<RoutineDef[]> {
  const rows = await prisma.userPattern.findMany({
    where: { userId, patternType: { startsWith: "routine_def_" } },
    orderBy: { createdAt: "asc" },
  });
  return rows.flatMap((r) => {
    try { return [JSON.parse(r.data as string) as RoutineDef]; } catch { return []; }
  });
}

export async function getRoutine(userId: string, id: string): Promise<RoutineDef | null> {
  const row = await prisma.userPattern.findUnique({
    where: { userId_patternType: { userId, patternType: routineKey(id) } },
  });
  if (!row) return null;
  try { return JSON.parse(row.data as string) as RoutineDef; } catch { return null; }
}

export async function createRoutine(userId: string, input: Omit<RoutineDef, "id" | "createdAt">): Promise<RoutineDef> {
  const id = uid();
  const def: RoutineDef = {
    ...input,
    id,
    createdAt: new Date().toISOString(),
    totalXp: input.steps.length * 15 + 30,
  };
  await prisma.userPattern.create({
    data: { userId, patternType: routineKey(id), data: JSON.stringify(def) },
  });
  return def;
}

export async function updateRoutine(userId: string, id: string, patch: Partial<RoutineDef>): Promise<RoutineDef> {
  const existing = await getRoutine(userId, id);
  if (!existing) throw new Error("ROUTINE_NOT_FOUND");
  const updated: RoutineDef = { ...existing, ...patch, id };
  if (patch.steps) updated.totalXp = patch.steps.length * 15 + 30;
  await prisma.userPattern.update({
    where: { userId_patternType: { userId, patternType: routineKey(id) } },
    data: { data: JSON.stringify(updated) },
  });
  return updated;
}

export async function deleteRoutine(userId: string, id: string): Promise<void> {
  await prisma.userPattern.deleteMany({
    where: { userId, patternType: routineKey(id) },
  });
}

/* ─── Execution / Logging ─── */

export async function getTodayLog(userId: string, routineId: string): Promise<RoutineLog | null> {
  const key = logKey(todayStr(), routineId);
  const row = await prisma.userPattern.findUnique({
    where: { userId_patternType: { userId, patternType: key } },
  });
  if (!row) return null;
  try { return JSON.parse(row.data as string) as RoutineLog; } catch { return null; }
}

export async function startRoutine(userId: string, routineId: string): Promise<RoutineLog> {
  const key = logKey(todayStr(), routineId);
  const log: RoutineLog = {
    routineId,
    date: todayStr(),
    completedSteps: [],
    finished: false,
    startedAt: new Date().toISOString(),
  };
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: key } },
    update: { data: JSON.stringify(log) },
    create: { userId, patternType: key, data: JSON.stringify(log) },
  });
  return log;
}

export async function completeStep(userId: string, routineId: string, stepId: string): Promise<RoutineLog> {
  const key = logKey(todayStr(), routineId);
  let log = await getTodayLog(userId, routineId);
  if (!log) log = await startRoutine(userId, routineId);

  if (!log.completedSteps.includes(stepId)) {
    log.completedSteps.push(stepId);
  }

  // Check if all steps done
  const def = await getRoutine(userId, routineId);
  if (def && log.completedSteps.length >= def.steps.length) {
    log.finished = true;
    log.finishedAt = new Date().toISOString();
    const startMs = new Date(log.startedAt).getTime();
    log.durationMin = Math.round((Date.now() - startMs) / 60000);
    log.streak = await calcStreak(userId, routineId);
  }

  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: key } },
    update: { data: JSON.stringify(log) },
    create: { userId, patternType: key, data: JSON.stringify(log) },
  });
  return log;
}

async function calcStreak(userId: string, routineId: string): Promise<number> {
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const row = await prisma.userPattern.findUnique({
      where: { userId_patternType: { userId, patternType: logKey(dateStr, routineId) } },
    });
    if (!row) break;
    try {
      const log = JSON.parse(row.data as string) as RoutineLog;
      if (log.finished) streak++;
      else break;
    } catch { break; }
  }
  return streak;
}

export async function getRoutineHistory(userId: string, routineId: string, days = 30): Promise<RoutineLog[]> {
  const now = new Date();
  const logs: RoutineLog[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const row = await prisma.userPattern.findUnique({
      where: { userId_patternType: { userId, patternType: logKey(dateStr, routineId) } },
    });
    if (row) {
      try { logs.push(JSON.parse(row.data as string) as RoutineLog); } catch { /* skip */ }
    }
  }
  return logs;
}

/** ORION nudge: gera mensagem motivacional baseado no estado atual */
export async function generateNudge(userId: string, routineId: string): Promise<string> {
  const def = await getRoutine(userId, routineId);
  const log = await getTodayLog(userId, routineId);
  if (!def) return "";

  if (!log || log.completedSteps.length === 0) {
    const hour = new Date().getHours();
    if (hour < 9) return `Bom dia! Sua rotina "${def.name}" te espera. Vamos iniciar?`;
    if (hour < 12) return `"${def.name}" ainda nao foi iniciada hoje. Tudo bem, ainda ha tempo.`;
    return `"${def.name}" esta pendente. Que tal comecar agora? Sao ${def.steps.length} etapas.`;
  }

  if (log.finished) {
    const streak = log.streak ?? 1;
    if (streak > 7) return `Incrivel! ${streak} dias consecutivos completando "${def.name}". Voce e uma maquina.`;
    return `"${def.name}" concluida hoje! ${streak > 1 ? `${streak} dias de streak.` : "Otimo trabalho."}`;
  }

  const pct = Math.round((log.completedSteps.length / def.steps.length) * 100);
  const remaining = def.steps.length - log.completedSteps.length;
  return `Voce esta a ${pct}% de completar "${def.name}". Faltam ${remaining} etapa${remaining > 1 ? "s" : ""}. Continue!`;
}
