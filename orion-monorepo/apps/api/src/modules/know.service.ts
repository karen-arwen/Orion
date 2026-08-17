import Anthropic from "@anthropic-ai/sdk";
import type { LessonLevel, LessonMaterial } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

/* ═══════════════════════════════════════════════════════════════════
   CONHECIMENTO — Tutor universal + Professor estruturado.

   Dois modos:
   - ask(): pergunta rápida, resposta livre (Q&A simples)
   - createLesson(): pedido tipo "monta uma aula sobre X" → gera
     MATERIAL ESTRUTURADO (objetivos, tópicos, exemplos, exercícios,
     próximos passos) e PERSISTE no banco. Histórico fica disponível
     pra revisitar.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const KNOW_SYSTEM = `Você é o O.R.I.O.N. em modo TUTOR.

Você é capaz de explicar QUALQUER domínio de conhecimento — engenharia, design,
biologia, economia, filosofia, programação — no nível certo pro usuário.

ESTILO:
- Sofisticado, preciso, levemente provocador.
- Usa analogias concretas quando o conceito é abstrato.
- Não despeja Wikipédia — sintetiza.
- Ao explicar algo técnico, mostra também o "por que importa".
- Termina com convite à próxima profundidade: "Quer que eu vá fundo em X?"

ESTRUTURA SUGERIDA pra perguntas conceituais:
1. Resposta direta (1-2 frases)
2. Por que isso importa (1-2 frases)
3. Exemplo concreto (analogia ou caso real)
4. Próximo passo (pergunta de aprofundamento)

NUNCA invente fontes ou cite papers que não tem certeza que existem.`;

const LESSON_SYSTEM = `Você é o O.R.I.O.N. em modo PROFESSOR.

O usuário pediu uma AULA estruturada sobre um tópico. Sua tarefa: gerar
material didático completo e USÁVEL, em português BR.

Você DEVE devolver APENAS JSON puro, sem markdown, no formato:

{
  "objectives": ["objetivo 1", "objetivo 2", ...],      // 3-5 objetivos claros
  "topics": [                                            // 3-6 tópicos centrais
    { "title": "Nome do tópico", "explanation": "3-6 frases didáticas" }
  ],
  "examples": [                                          // 2-4 exemplos práticos
    { "title": "Exemplo X", "body": "explicação concreta com números/situação" }
  ],
  "exercises": [                                         // 3-5 exercícios pra fixar
    { "prompt": "questão", "hint": "dica opcional", "answer": "gabarito conciso" }
  ],
  "next": ["próximo tópico sugerido", "outro próximo passo"]
}

REGRAS:
- Profundidade adequada ao nível (iniciante/intermediario/avancado).
- Exemplos CONCRETOS, não abstratos. Use números, nomes, situações reais.
- Exercícios devem ser respondíveis com o material da aula.
- Linguagem clara, sem jargão desnecessário.
- Se o tópico tem risco ético/legal (medicina, direito, finanças), inclua disclaimer no primeiro objetivo.`;

const TAG_SYSTEM = `Você gera tags curtas (1-3 palavras cada) pra classificar uma aula.
Devolva APENAS JSON: { "tags": ["tag1", "tag2", "tag3"] }
Máximo 5 tags. Português BR.`;

export interface AskInput {
  question: string;
  depth?: "rapido" | "padrao" | "fundo";
  context?: string;
}

export async function ask(input: AskInput): Promise<string> {
  const depthHint = {
    rapido: "Resposta MUITO curta — 2-3 linhas, direta ao ponto.",
    padrao: "Resposta média — siga a estrutura padrão.",
    fundo: "Resposta profunda — 6-10 linhas, com nuance e exemplo elaborado.",
  }[input.depth ?? "padrao"];

  const userMsg = input.context
    ? `Contexto: ${input.context}\n\nPergunta: ${input.question}`
    : input.question;

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1000,
    temperature: 0.7,
    system: `${KNOW_SYSTEM}\n\nProfundidade desta resposta: ${depthHint}`,
    messages: [{ role: "user", content: userMsg }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Detecta se uma pergunta é pedido de AULA (vs pergunta rápida). */
export function isLessonRequest(text: string): boolean {
  const t = text.toLowerCase();
  const triggers = [
    /\baula\b/,
    /\bme\s+ensina\b/,
    /\bmonta\s+(uma\s+|um\s+)?material/,
    /\bestudar\b.*\bsobre\b/,
    /\bcurso\s+(de|sobre)\b/,
    /\bquero\s+aprender\b/,
    /\bensina\s+do\s+zero\b/,
    /\bme\s+explica\s+do\s+zero\b/,
    /\bmonta\s+(uma\s+)?aula\b/,
  ];
  return triggers.some((re) => re.test(t));
}

function parseJsonOutput<T>(raw: string): T | null {
  // Strategy 1: direct parse
  try { return JSON.parse(raw.trim()) as T; } catch { /* next */ }

  // Strategy 2: strip markdown fences
  const fenceStripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try { return JSON.parse(fenceStripped) as T; } catch { /* next */ }

  // Strategy 3: extract first { ... } block
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as T; } catch { /* next */ }
  }

  // Strategy 4: extract first [ ... ] block
  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    try { return JSON.parse(raw.slice(firstBracket, lastBracket + 1)) as T; } catch { /* next */ }
  }

  return null;
}

export interface CreateLessonInput {
  userId: string;
  topic: string;
  level?: LessonLevel;
}

export interface LessonCreatedResult {
  id: string;
  topic: string;
  level: LessonLevel;
  material: LessonMaterial;
  tags: string[];
}

export async function createLesson(input: CreateLessonInput): Promise<LessonCreatedResult> {
  const level: LessonLevel = input.level ?? "intermediario";

  // 1. Gera o material estruturado
  const matResponse = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 3000,
    temperature: 0.5,
    system: LESSON_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Tópico: ${input.topic}\nNível: ${level}\n\nGere o material da aula em JSON.`,
      },
    ],
  });

  const matText = matResponse.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let material = parseJsonOutput<LessonMaterial>(matText);

  // Fallback: se o parsing falhou, tenta de novo pedindo JSON explicitamente
  if (!material || !Array.isArray(material.objectives) || !Array.isArray(material.topics)) {
    const retryResponse = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 3000,
      temperature: 0.3,
      system: "Converta o texto abaixo em JSON valido com a estrutura: {objectives:string[], topics:[{title,explanation}], examples:[{title,body}], exercises:[{prompt,hint,answer}], next:string[]}. Devolva SOMENTE o JSON, sem markdown.",
      messages: [{ role: "user", content: matText }],
    });
    const retryText = retryResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    material = parseJsonOutput<LessonMaterial>(retryText);
  }

  if (!material || !Array.isArray(material.objectives) || !Array.isArray(material.topics)) {
    // Ultimate fallback: build a minimal lesson from the raw text
    material = {
      objectives: ["Compreender os fundamentos do topico solicitado"],
      topics: [{ title: input.topic, explanation: matText.slice(0, 2000) }],
      examples: [],
      exercises: [],
      next: ["Aprofundar no topico"],
    };
  }

  // 2. Gera tags
  let tags: string[] = [];
  try {
    const tagResponse = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 150,
      temperature: 0.2,
      system: TAG_SYSTEM,
      messages: [{ role: "user", content: `Tópico: ${input.topic}` }],
    });
    const tagText = tagResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const parsed = parseJsonOutput<{ tags: string[] }>(tagText);
    if (parsed?.tags) tags = parsed.tags.filter((t) => typeof t === "string").slice(0, 5);
  } catch {
    // tags são best-effort — se falhar, salva sem
  }

  // 3. Persiste no banco
  const saved = await prisma.lessonSession.create({
    data: {
      userId: input.userId,
      topic: input.topic,
      level,
      material: material as unknown as object,
      tags,
    },
  });

  return {
    id: saved.id,
    topic: saved.topic,
    level: saved.level as LessonLevel,
    material,
    tags,
  };
}

/** Lista sessões de aula do usuário (resumo, sem material completo). */
export async function listLessons(userId: string): Promise<Array<{
  id: string;
  topic: string;
  level: LessonLevel;
  tags: string[];
  createdAt: string;
}>> {
  const rows = await prisma.lessonSession.findMany({
    where: { userId },
    select: { id: true, topic: true, level: true, tags: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    level: r.level as LessonLevel,
    tags: r.tags,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Carrega uma sessão completa com material. */
export async function getLesson(
  userId: string,
  lessonId: string,
): Promise<{
  id: string;
  topic: string;
  level: LessonLevel;
  material: LessonMaterial;
  tags: string[];
  createdAt: string;
  messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
} | null> {
  const lesson = await prisma.lessonSession.findFirst({
    where: { id: lessonId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!lesson) return null;
  return {
    id: lesson.id,
    topic: lesson.topic,
    level: lesson.level as LessonLevel,
    material: lesson.material as unknown as LessonMaterial,
    tags: lesson.tags,
    createdAt: lesson.createdAt.toISOString(),
    messages: lesson.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/** Continua uma sessão de aula com uma pergunta de aprofundamento. */
export async function continueLesson(
  userId: string,
  lessonId: string,
  question: string,
): Promise<string> {
  const lesson = await prisma.lessonSession.findFirst({
    where: { id: lessonId, userId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
  });
  if (!lesson) throw new Error("Aula não encontrada");

  const material = lesson.material as unknown as LessonMaterial;
  const history = lesson.messages.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  const contextLine = `Aula sobre: ${lesson.topic} (${lesson.level})
Tópicos cobertos: ${material.topics.map((t) => t.title).join(", ")}`;

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1000,
    temperature: 0.7,
    system: `${KNOW_SYSTEM}\n\n${contextLine}\n\nVocê está aprofundando uma aula existente.`,
    messages: [...history, { role: "user", content: question }],
  });

  const answer = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  await prisma.$transaction([
    prisma.lessonMessage.create({
      data: { sessionId: lessonId, role: "user", content: question },
    }),
    prisma.lessonMessage.create({
      data: { sessionId: lessonId, role: "assistant", content: answer },
    }),
    prisma.lessonSession.update({ where: { id: lessonId }, data: { updatedAt: new Date() } }),
  ]);

  return answer;
}

export async function deleteLesson(userId: string, lessonId: string): Promise<void> {
  const owned = await prisma.lessonSession.findFirst({ where: { id: lessonId, userId } });
  if (!owned) throw new Error("Aula não encontrada");
  await prisma.lessonSession.delete({ where: { id: lessonId } });
}
