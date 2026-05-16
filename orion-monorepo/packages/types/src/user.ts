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
