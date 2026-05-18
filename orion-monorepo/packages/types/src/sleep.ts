export interface SleepLog {
  id: string;
  userId: string;
  bedTime: string;
  wakeTime: string;
  quality: number;
  notes: string | null;
  createdAt: string;
  /** duração em minutos calculada no servidor */
  durationMin: number;
}

export interface SleepStats {
  avgDurationMin: number;
  avgQuality: number;
  consistencyScore: number; // 0-100
  samplesLast7Days: number;
}
