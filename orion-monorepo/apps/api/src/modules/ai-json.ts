import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function generateJson<T>(system: string, payload: unknown, maxTokens = 1600): Promise<T> {
  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    temperature: 0.6,
    system,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  // Strategy 1: direct parse
  try { return JSON.parse(raw) as T; } catch { /* next */ }

  // Strategy 2: strip markdown fences
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(stripped) as T; } catch { /* next */ }

  // Strategy 3: extract first JSON object
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as T; } catch { /* next */ }
  }

  // Strategy 4: extract first JSON array
  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    try { return JSON.parse(raw.slice(firstBracket, lastBracket + 1)) as T; } catch { /* next */ }
  }

  throw new Error(`Falha ao parsear JSON da IA. Raw: ${raw.slice(0, 200)}`);
}
