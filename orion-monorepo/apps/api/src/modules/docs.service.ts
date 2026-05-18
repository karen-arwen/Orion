import Anthropic from "@anthropic-ai/sdk";
import type { DocAnalysis } from "@orion/types";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { driveSearch, driveReadDoc, type DriveFileSummary } from "../integrations/google-api.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";

/* ═══════════════════════════════════════════════════════════════════
   DOCS — Análise estruturada de documentos.

   Modos de input:
   - texto colado no chat
   - Google Doc via fileId (lê via Drive API)

   Output JSON estruturado: summary, risks, actions, questions, category.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const ANALYSIS_SYSTEM = `Você é o O.R.I.O.N. em modo ANALISTA DE DOCUMENTOS.

Sua tarefa: ler o texto fornecido e produzir uma análise EXECUTIVA estruturada,
em português BR.

Devolva APENAS JSON puro, sem markdown, com este formato exato:

{
  "category": "contrato | relatorio | email | codigo | proposta | termo_uso | outro",
  "summary": "3-5 linhas de resumo executivo (não despeje conteúdo, sintetize)",
  "risks": [
    { "topic": "tema curto", "level": "alto|medio|baixo", "detail": "1-2 frases explicando" }
  ],
  "actions": [
    { "title": "ação concreta", "why": "por que importa", "owner": "quem (opcional)", "deadline": "quando (opcional)" }
  ],
  "questions": [
    "pergunta crítica 1 que o usuário deve responder antes de agir"
  ]
}

REGRAS:
- 2-5 riscos. Marque "alto" só se for de verdade (consequência grave/irreversível).
- 2-5 ações práticas e específicas. Não inclua "ler o documento" — isso é trivial.
- 1-3 perguntas críticas — coisas que o documento NÃO responde mas o usuário precisa decidir.
- Se o documento for inofensivo (newsletter, etc), risks pode ficar vazio.
- NUNCA invente cláusulas/valores que não existem no texto. Se algo é ambíguo, marque como risco/pergunta.`;

export interface AnalyzeInput {
  userId: string;
  text: string;
  /** Hint opcional do usuário sobre o documento ("é um contrato de SaaS B2B") */
  hint?: string;
}

function parseJsonOutput<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export async function analyzeText(input: AnalyzeInput): Promise<DocAnalysis> {
  if (input.text.trim().length < 50) {
    throw new Error("Texto muito curto pra análise — mande pelo menos 50 caracteres.");
  }

  // Cap em ~25k chars pra não estourar contexto Claude
  const text = input.text.slice(0, 25_000);
  const userMsg = input.hint
    ? `Contexto do usuário: ${input.hint}\n\n──── TEXTO ────\n${text}`
    : text;

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 2500,
    temperature: 0.3,
    system: ANALYSIS_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = parseJsonOutput<Omit<DocAnalysis, "inputLength">>(raw);
  if (!parsed || typeof parsed.summary !== "string") {
    throw new Error("Não consegui estruturar a análise. Tenta de novo com mais contexto.");
  }

  return {
    summary: parsed.summary,
    category: parsed.category ?? "outro",
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    inputLength: text.length,
  };
}

/** Analisa um arquivo do Drive direto pelo fileId. */
export async function analyzeDriveDoc(userId: string, fileId: string): Promise<DocAnalysis> {
  const integ = await prisma.integration.findFirst({
    where: { userId, provider: "gdrive", status: "connected" },
  });
  if (!integ) throw new Error("Drive não conectado");
  const token = await tryEnsureFreshAccessToken(integ);
  if (!token) throw new Error("Token do Drive inválido");
  const text = await driveReadDoc(token, fileId);
  return analyzeText({ userId, text });
}

/** Lista os N arquivos mais recentes do Drive do usuário. */
export async function listRecentDriveFiles(
  userId: string,
  query?: string,
): Promise<DriveFileSummary[]> {
  const integ = await prisma.integration.findFirst({
    where: { userId, provider: "gdrive", status: "connected" },
  });
  if (!integ) throw new Error("Drive não conectado");
  const token = await tryEnsureFreshAccessToken(integ);
  if (!token) throw new Error("Token do Drive inválido");
  return driveSearch(token, query ?? "", 20);
}
