// ── SAÚDE ───────────────────────────────────────────────────────────

export interface EnergyLog {
  id: string;
  userId: string;
  value: number; // 1-10
  note: string | null;
  createdAt: string;
}

export interface EnergyDayBucket {
  date: string; // YYYY-MM-DD
  average: number;
  samples: number;
}

// ── FOCO ────────────────────────────────────────────────────────────

export interface FocusSession {
  id: string;
  userId: string;
  duration: number;
  actualMinutes: number | null;
  completed: boolean;
  interruptedAt: string | null;
  note: string | null;
  startedAt: string;
  endedAt: string | null;
}

// ── HÁBITOS ─────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  userId: string;
  name: string;
  frequency: string;
  color: string;
  icon: string;
  streak: number;
  bestStreak: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLogEntry {
  id: string;
  habitId: string;
  date: string;
  note: string | null;
  createdAt: string;
}

export interface HabitWithLogs extends Habit {
  /** Map de date → boolean indicando se foi marcado */
  recentLogs: Record<string, boolean>;
}
