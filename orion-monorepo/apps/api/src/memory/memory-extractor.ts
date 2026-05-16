import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { embedBatch } from "../embeddings/openai.js";

/* ═══════════════════════════════════════════════════════════════════
   Memory Extractor — destila fatos persistentes de cada conversa.

   Depois de cada turno bem-sucedido, fazemos uma chamada extra ao
   Claude pedindo: "olha o que aconteceu, extrai até 3 fatos NOVOS,
   PERSISTENTES, sobre o usuário. Devolve JSON."

   Resultado vai pro Memory model do Postgres → da próxima vez que o
   O.R.I.O.N. for conversar, ele já lembra. Esse é o segundo cérebro.

   Importante: roda em FIRE-AND-FORGET (não bloqueia a resposta).
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

interface ExtractedMemory {
  type: "fact" | "preference" | "event" | "feedback";
  content: string;
  importance: number;
}

const EXTRACTOR_PROMPT = `Você é o extrator de memórias do O.R.I.O.N.

Sua tarefa: ler a última troca user/assistente e extrair até 3 fatos NOVOS, PERSISTENTES e RELEVANTES sobre o usuário.

REGRAS:
- Só fatos sobre o usuário (preferências, rotina, projetos, pessoas importantes, restrições, gostos).
- NUNCA fatos efêmeros ("agora ele está perguntando sobre X").
- NUNCA duplicar memórias já existentes.
- Importância 0.0–1.0: 1.0 = muda como interajo sempre, 0.3 = útil mas não crítico.
- Se não houver nada relevante pra extrair, devolva [].

Tipos:
- "fact": informação objetiva ("tem 2 cachorras: Cindy e Galadriel")
- "preference": gosto/estilo ("prefere comunicação direta e curta")
- "event": evento recorrente ou data importante ("aula de inglês quarta e sexta 8h")
- "feedback": correção que o usuário deu sobre como interagir

FORMATO DE RESPOSTA — JSON puro, sem markdown, sem explicação:
[{"type":"...", "content":"...", "importance":0.X}, ...]
`;

function buildPrompt(opts: {
  userMessage: string;
  assistantMessage: string;
  existingMemories: string[];
}): string {
  const memDump =
    opts.existingMemories.length > 0
      ? opts.existingMemories.map((m) => `  • ${m}`).join("\n")
      : "  (nenhuma)";
  return `Memórias já registradas (não duplique):
${memDump}

──── Última troca ────
USUÁRIO: ${opts.userMessage}

O.R.I.O.N.: ${opts.assistantMessage}
──────────────────────

Extraia até 3 memórias novas (ou [] se nada relevante).`;
}

function parseExtraction(raw: string): ExtractedMemory[] {
  // Tenta extrair JSON mesmo se vier com cerca de markdown
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is ExtractedMemory =>
          typeof m === "object" &&
          m !== null &&
          "type" in m &&
          "content" in m &&
          typeof (m as ExtractedMemory).content === "string",
      )
      .map((m) => ({
        type: ["fact", "preference", "event", "feedback"].includes(m.type) ? m.type : "fact",
        content: String(m.content).slice(0, 500),
        importance: Math.max(0, Math.min(1, Number(m.importance) || 0.5)),
      }))
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** Extrai e persiste memórias da última troca. Fire-and-forget. */
export async function extractAndSaveMemories(opts: {
  userId: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  try {
    const existing = await prisma.memory.findMany({
      where: { userId: opts.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const response = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 500,
      temperature: 0.2,
      system: EXTRACTOR_PROMPT,
      messages: [
        {
          role: "user",
          content: buildPrompt({
            userMessage: opts.userMessage,
            assistantMessage: opts.assistantMessage,
            existingMemories: existing.map((m) => `[${m.type}] ${m.content}`),
          }),
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const memories = parseExtraction(text);
    if (memories.length === 0) return;

    // Gera embeddings em batch — best-effort.
    // Se OPENAI_API_KEY ausente, salva com [] e cai no fallback de importance.
    const embeddings = await embedBatch(memories.map((m) => m.content));

    await prisma.memory.createMany({
      data: memories.map((m, i) => ({
        userId: opts.userId,
        type: m.type,
        content: m.content,
        importance: m.importance,
        embedding: embeddings[i] ?? [],
      })),
    });

    console.log(
      `[memory] +${memories.length} pra ${opts.userId}:`,
      memories.map((m) => `[${m.type}] ${m.content.slice(0, 50)}…`).join(" | "),
    );
  } catch (err) {
    // Falhar a extração nunca pode quebrar o chat. Só logamos.
    console.warn("[memory] extração falhou:", (err as Error).message);
  }
}
