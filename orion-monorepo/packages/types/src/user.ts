/**
 * Modos de operação do O.R.I.O.N.
 * SILENCIOSO: só alertas críticos. NORMAL: padrão. STARK: ultra proativo.
 */
export type OrionMode = "SILENCIOSO" | "NORMAL" | "STARK";

export type Plan = "FREE" | "PRO" | "ENTERPRISE";

export type PreferenceLayer = "current" | "nostalgia" | "exploration";

export interface UserTheme {
  primary: string;
  secondary: string;
  accent: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  avatarColor: string;
  bio: string;
  mode: OrionMode;
  plan: Plan;
  theme: UserTheme;
  timezone: string;
  language: string;
  onboardedAt: string | null;
  createdAt: string;
}

export interface UserPreference {
  key: string;
  value: string;
  layer: PreferenceLayer;
  confidence: number;
  updatedAt: string;
}

export interface UserVitals {
  energy: number;
  focus: number;
  mood: number;
}

export interface IntelligencePreference {
  key: string;
  value: string;
  layer: PreferenceLayer;
  confidence: number;
  updatedAt: string;
}

export interface IntelligenceMemory {
  id: string;
  type: "fact" | "preference" | "event" | "feedback" | "project" | "relationship";
  content: string;
  importance: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligencePattern {
  patternType: string;
  data: Record<string, unknown>;
  confidence: number;
  updatedAt: string;
}

export interface IntelligenceProfile {
  adaptationScore: number;
  tasteBlend: {
    current: number;
    nostalgia: number;
    exploration: number;
  };
  preferences: IntelligencePreference[];
  memories: IntelligenceMemory[];
  patterns: IntelligencePattern[];
  gaps: string[];
  nextCalibrationPrompts: string[];
}

export type MemoryType = IntelligenceMemory["type"];

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryCreateInput {
  type: MemoryType;
  content: string;
  importance?: number;
  pinned?: boolean;
}

export interface MemoryUpdateInput {
  type?: MemoryType;
  content?: string;
  importance?: number;
  pinned?: boolean;
}

export interface MemoryListResponse {
  items: MemoryRecord[];
  total: number;
  stats: {
    pinned: number;
    byType: Record<MemoryType, number>;
    averageImportance: number;
  };
}
