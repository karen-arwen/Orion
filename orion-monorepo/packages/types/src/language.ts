export type LanguageLevel = "iniciante" | "intermediario" | "avancado";
export type LanguageMode = "chat" | "pronuncia" | "entrevista" | "viagem" | "gramatica";

export interface LanguagePracticeInput {
  language: string;
  level: LanguageLevel;
  mode: LanguageMode;
  message: string;
  goal?: string;
}

export interface LanguagePracticeResult {
  reply: string;
  corrected: string;
  notes: string[];
  drills: string[];
}
