export interface FocusSession {
  id: string;
  userId: string;
  duration: number;
  breakMinutes: number;
  completed: boolean;
  interruptedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface FocusSessionInput {
  duration: number;
  breakMinutes?: number;
}

export interface FocusDaySummary {
  date: string;
  minutes: number;
  completed: number;
}

export interface FocusSummary {
  active: FocusSession | null;
  sessions: FocusSession[];
  week: FocusDaySummary[];
  totalMinutesWeek: number;
  completedWeek: number;
}
