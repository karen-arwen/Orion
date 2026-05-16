export interface Habit {
  id: string;
  userId: string;
  name: string;
  frequency: string;
  color: string;
  icon: string;
  streak: number;
  bestStreak: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
}

export interface HabitWithLogs extends Habit {
  logs: HabitLog[];
}

export interface HabitCreateInput {
  name: string;
  frequency: string;
  color?: string;
  icon?: string;
}

export interface HabitSummary {
  habits: HabitWithLogs[];
  todayCompleted: number;
  todayTotal: number;
  streakAtRisk: HabitWithLogs[];
}
