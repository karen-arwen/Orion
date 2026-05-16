export interface SleepLog {
  id: string;
  userId: string;
  bedTime: string;
  wakeTime: string;
  quality: number;
  notes: string | null;
  source: string;
  externalId: string | null;
  createdAt: string;
  durationMinutes: number;
}

export interface SleepLogInput {
  bedTime: string;
  wakeTime: string;
  quality?: number;
  notes?: string;
}

export interface SleepSummary {
  logs: SleepLog[];
  syncSources: HealthSyncSource[];
  averageMinutes: number;
  consistencyScore: number;
  insufficientSleepStreak: number;
  recommendation: string;
}

export interface HealthSyncSource {
  id: string;
  provider: string;
  status: string;
  deviceName: string | null;
  lastSyncedAt: string | null;
}

export interface SleepImportSample {
  provider: "apple_health" | "samsung_health" | "health_connect" | "manual_import";
  externalId: string;
  bedTime: string;
  wakeTime: string;
  quality?: number;
  notes?: string;
  deviceName?: string;
}

export interface SleepImportResult {
  imported: number;
  skipped: number;
}
