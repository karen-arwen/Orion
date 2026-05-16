import type { FocusDaySummary, FocusSession, FocusSessionInput, FocusSummary } from "@orion/types";
import { prisma } from "../db/prisma.js";

function toFocusSession(row: {
  id: string;
  userId: string;
  duration: number;
  breakMinutes: number;
  completed: boolean;
  interruptedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}): FocusSession {
  return {
    id: row.id,
    userId: row.userId,
    duration: row.duration,
    breakMinutes: row.breakMinutes,
    completed: row.completed,
    interruptedAt: row.interruptedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function sessionEndsAt(createdAt: Date, duration: number): Date {
  return new Date(createdAt.getTime() + duration * 60_000);
}

function isActiveRow(row: { duration: number; completed: boolean; interruptedAt: Date | null; endedAt: Date | null; createdAt: Date }): boolean {
  if (row.completed || row.interruptedAt || row.endedAt) return false;
  return sessionEndsAt(row.createdAt, row.duration).getTime() > Date.now();
}

export async function isFocusActive(userId: string): Promise<boolean> {
  const row = await prisma.focusSession.findFirst({
    where: { userId, completed: false, interruptedAt: null, endedAt: null },
    orderBy: { createdAt: "desc" },
    select: { duration: true, completed: true, interruptedAt: true, endedAt: true, createdAt: true },
  });
  return row ? isActiveRow(row) : false;
}

export async function createFocusSession(userId: string, input: FocusSessionInput): Promise<FocusSession> {
  const row = await prisma.focusSession.create({
    data: {
      userId,
      duration: input.duration,
      breakMinutes: input.breakMinutes ?? 5,
    },
    select: {
      id: true,
      userId: true,
      duration: true,
      breakMinutes: true,
      completed: true,
      interruptedAt: true,
      endedAt: true,
      createdAt: true,
    },
  });
  return toFocusSession(row);
}

export async function completeFocusSession(userId: string, id: string): Promise<FocusSession> {
  const owned = await prisma.focusSession.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Sessao de foco nao encontrada.");
  const row = await prisma.focusSession.update({
    where: { id },
    data: { completed: true, endedAt: new Date() },
    select: {
      id: true,
      userId: true,
      duration: true,
      breakMinutes: true,
      completed: true,
      interruptedAt: true,
      endedAt: true,
      createdAt: true,
    },
  });
  return toFocusSession(row);
}

export async function interruptFocusSession(userId: string, id: string): Promise<FocusSession> {
  const owned = await prisma.focusSession.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Sessao de foco nao encontrada.");
  const now = new Date();
  const row = await prisma.focusSession.update({
    where: { id },
    data: { interruptedAt: now, endedAt: now },
    select: {
      id: true,
      userId: true,
      duration: true,
      breakMinutes: true,
      completed: true,
      interruptedAt: true,
      endedAt: true,
      createdAt: true,
    },
  });
  return toFocusSession(row);
}

function weekStart(): Date {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  return start;
}

function buildWeek(rows: Array<{ createdAt: Date; duration: number; completed: boolean }>): FocusDaySummary[] {
  const start = weekStart();
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const label = day.toISOString().slice(0, 10);
    const matches = rows.filter((row) => row.createdAt.toISOString().slice(0, 10) === label);
    return {
      date: label,
      minutes: matches.filter((row) => row.completed).reduce((sum, row) => sum + row.duration, 0),
      completed: matches.filter((row) => row.completed).length,
    };
  });
}

export async function getFocusSummary(userId: string): Promise<FocusSummary> {
  const since = weekStart();
  const rows = await prisma.focusSession.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      userId: true,
      duration: true,
      breakMinutes: true,
      completed: true,
      interruptedAt: true,
      endedAt: true,
      createdAt: true,
    },
  });
  const activeRow = rows.find(isActiveRow) ?? null;
  const week = buildWeek(rows);
  return {
    active: activeRow ? toFocusSession(activeRow) : null,
    sessions: rows.map(toFocusSession),
    week,
    totalMinutesWeek: week.reduce((sum, item) => sum + item.minutes, 0),
    completedWeek: week.reduce((sum, item) => sum + item.completed, 0),
  };
}
