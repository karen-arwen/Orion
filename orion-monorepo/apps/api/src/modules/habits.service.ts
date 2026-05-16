import type { HabitCreateInput, HabitLog, HabitSummary, HabitWithLogs } from "@orion/types";
import { prisma } from "../db/prisma.js";

function startOfDay(date = new Date()): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function daysAgo(days: number): Date {
  const date = startOfDay();
  date.setDate(date.getDate() - days);
  return date;
}

function toLog(row: { id: string; habitId: string; date: Date; completed: boolean }): HabitLog {
  return {
    id: row.id,
    habitId: row.habitId,
    date: row.date.toISOString(),
    completed: row.completed,
  };
}

function toHabit(row: {
  id: string;
  userId: string;
  name: string;
  frequency: string;
  color: string;
  icon: string;
  streak: number;
  bestStreak: number;
  createdAt: Date;
  updatedAt: Date;
  logs: Array<{ id: string; habitId: string; date: Date; completed: boolean }>;
}): HabitWithLogs {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    frequency: row.frequency,
    color: row.color,
    icon: row.icon,
    streak: row.streak,
    bestStreak: row.bestStreak,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    logs: row.logs.map(toLog),
  };
}

function calculateStreak(logs: Array<{ date: Date; completed: boolean }>): number {
  const completed = new Set(
    logs
      .filter((log) => log.completed)
      .map((log) => startOfDay(log.date).toISOString().slice(0, 10)),
  );
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const key = daysAgo(offset).toISOString().slice(0, 10);
    if (!completed.has(key)) break;
    streak += 1;
  }
  return streak;
}

async function refreshHabitStreak(habitId: string): Promise<void> {
  const habit = await prisma.habit.findUnique({
    where: { id: habitId },
    select: {
      streak: true,
      bestStreak: true,
      logs: {
        where: { date: { gte: daysAgo(365) } },
        select: { date: true, completed: true },
      },
    },
  });
  if (!habit) return;
  const streak = calculateStreak(habit.logs);
  await prisma.habit.update({
    where: { id: habitId },
    data: { streak, bestStreak: Math.max(habit.bestStreak, streak) },
    select: { id: true },
  });
}

export async function createHabit(userId: string, input: HabitCreateInput): Promise<HabitWithLogs> {
  const row = await prisma.habit.create({
    data: {
      userId,
      name: input.name.trim(),
      frequency: input.frequency.trim(),
      color: input.color ?? "#00D4FF",
      icon: input.icon ?? "✓",
    },
    select: habitSelect,
  });
  return toHabit(row);
}

export async function toggleHabitLog(userId: string, habitId: string, dateInput?: string): Promise<HabitWithLogs> {
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId }, select: { id: true } });
  if (!habit) throw new Error("Habito nao encontrado.");
  const date = startOfDay(dateInput ? new Date(dateInput) : new Date());
  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date } },
    select: { id: true, completed: true },
  });
  if (existing) {
    await prisma.habitLog.update({
      where: { id: existing.id },
      data: { completed: !existing.completed },
      select: { id: true },
    });
  } else {
    await prisma.habitLog.create({
      data: { habitId, date, completed: true },
      select: { id: true },
    });
  }
  await refreshHabitStreak(habitId);
  const updated = await prisma.habit.findFirstOrThrow({ where: { id: habitId, userId }, select: habitSelect });
  return toHabit(updated);
}

export async function deleteHabit(userId: string, habitId: string): Promise<{ id: string }> {
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId }, select: { id: true } });
  if (!habit) throw new Error("Habito nao encontrado.");
  await prisma.habit.delete({ where: { id: habitId }, select: { id: true } });
  return { id: habitId };
}

const habitSelect = {
  id: true,
  userId: true,
  name: true,
  frequency: true,
  color: true,
  icon: true,
  streak: true,
  bestStreak: true,
  createdAt: true,
  updatedAt: true,
  logs: {
    where: { date: { gte: daysAgo(42) } },
    orderBy: { date: "asc" },
    select: { id: true, habitId: true, date: true, completed: true },
  },
} as const;

export async function getHabitSummary(userId: string): Promise<HabitSummary> {
  const rows = await prisma.habit.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: habitSelect,
  });
  const habits = rows.map(toHabit);
  const todayKey = startOfDay().toISOString().slice(0, 10);
  return {
    habits,
    todayTotal: habits.length,
    todayCompleted: habits.filter((habit) =>
      habit.logs.some((log) => log.completed && log.date.slice(0, 10) === todayKey),
    ).length,
    streakAtRisk: habits.filter(
      (habit) => habit.streak > 0 && !habit.logs.some((log) => log.completed && log.date.slice(0, 10) === todayKey),
    ),
  };
}
