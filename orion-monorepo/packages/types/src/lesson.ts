export type LessonLevel = "iniciante" | "intermediario" | "avancado";

export interface LessonExample {
  /** Nome curto do exemplo */
  title: string;
  /** Conteúdo descritivo */
  body: string;
}

export interface LessonExercise {
  /** Enunciado do exercício */
  prompt: string;
  /** Dica opcional pra resolver */
  hint?: string;
  /** Resposta esperada / gabarito */
  answer?: string;
}

export interface LessonMaterial {
  /** Objetivos de aprendizado da aula */
  objectives: string[];
  /** Tópicos com explicação curta */
  topics: Array<{ title: string; explanation: string }>;
  /** Exemplos práticos */
  examples: LessonExample[];
  /** Exercícios pra fixar */
  exercises: LessonExercise[];
  /** Próximos passos / aulas sugeridas */
  next: string[];
}

export interface LessonSession {
  id: string;
  userId: string;
  topic: string;
  level: LessonLevel;
  material: LessonMaterial;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LessonSessionSummary {
  id: string;
  topic: string;
  level: LessonLevel;
  tags: string[];
  createdAt: string;
}

export interface LessonMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
}
