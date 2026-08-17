import Anthropic from "@anthropic-ai/sdk";
import type { LanguagePracticeInput, LanguagePracticeResult } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM = `You are O.R.I.O.N. in LANGUAGE COACH mode.

CRITICAL RULES:
1. The user's message includes a "language" field — that is the TARGET language.
2. Your "reply" field MUST be written ENTIRELY in the TARGET language. NOT in Portuguese.
3. If the user wrote in Portuguese instead of the target language, reply in the target language anyway
   and gently encourage them to try writing in the target language next time.
4. "corrected" must be the user's message rewritten correctly in the TARGET language.
   If user wrote in Portuguese, translate it to the target language as the correction.
5. "notes" should be study tips in Portuguese (the user's native language) explaining grammar/vocab.
6. "drills" should be practice exercises mixing the target language with Portuguese instructions.

For BEGINNERS (iniciante):
- Use simple vocabulary and short sentences
- Include romanization/pronunciation hints for non-Latin scripts (e.g., Korean: 안녕하세요 (annyeonghaseyo))
- Be extra encouraging

Return ONLY valid JSON:
{"reply":"response in TARGET language","corrected":"user's text corrected in TARGET language","notes":["study note in Portuguese","..."],"drills":["practice exercise","..."]}`;

export async function practiceLanguage(
  userId: string,
  input: LanguagePracticeInput,
): Promise<LanguagePracticeResult> {
  const memories = await prisma.memory.findMany({
    where: { userId, type: { in: ["preference", "feedback", "fact"] } },
    orderBy: { importance: "desc" },
    take: 5,
  });
  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 900,
    temperature: 0.72,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          context: memories.map((m) => m.content),
          request: input,
        }),
      },
    ],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(text) as LanguagePracticeResult;
  } catch {
    return {
      reply: input.message,
      corrected: input.message,
      notes: ["Não consegui estruturar a correção agora. Tente de novo com uma frase menor."],
      drills: ["Reescreva a mesma frase de três formas diferentes."],
    };
  }
}
