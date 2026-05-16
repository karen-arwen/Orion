import { env } from "../config/env.js";

/* ═══════════════════════════════════════════════════════════════════
   OpenAI Embeddings — text-embedding-3-small (1536 dims).

   Por quê OpenAI: padrão da indústria, $0.02/1M tokens, qualidade
   excelente. Decisão: 1 linha — preferimos provider externo testado
   em vez de empacotar modelo local que adicionaria 200MB+ ao deploy.

   Fallback gracioso: se OPENAI_API_KEY ausente, retornamos null
   (chamadores tratam isso → memória funciona sem busca semântica).
═══════════════════════════════════════════════════════════════════ */

const ENDPOINT = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

/** Gera embedding pra um texto. Retorna null se OpenAI não configurada. */
export async function embed(text: string): Promise<number[] | null> {
  if (!env.OPENAI_API_KEY) return null;

  // Trunca pra não estourar limite do modelo (8191 tokens ≈ 30k chars)
  const input = text.slice(0, 30_000);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input }),
    });

    if (!res.ok) {
      console.warn(`[embeddings] OpenAI ${res.status}: ${await res.text()}`);
      return null;
    }

    const json = (await res.json()) as EmbeddingResponse;
    return json.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn("[embeddings] falha:", (err as Error).message);
    return null;
  }
}

/** Gera embeddings em batch (mais eficiente que loop). */
export async function embedBatch(texts: string[]): Promise<Array<number[] | null>> {
  if (!env.OPENAI_API_KEY || texts.length === 0) return texts.map(() => null);

  const inputs = texts.map((t) => t.slice(0, 30_000));

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: inputs }),
    });

    if (!res.ok) return texts.map(() => null);

    const json = (await res.json()) as EmbeddingResponse;
    const byIndex = new Map(json.data.map((d) => [d.index, d.embedding] as const));
    return inputs.map((_, i) => byIndex.get(i) ?? null);
  } catch {
    return texts.map(() => null);
  }
}

/** Cosine similarity entre dois vetores normalizados. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
