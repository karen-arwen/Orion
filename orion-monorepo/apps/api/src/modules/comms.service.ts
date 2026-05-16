import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { gmailList, type GmailMessageSummary } from "../integrations/google-api.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";

/* ═══════════════════════════════════════════════════════════════════
   COMMS — Módulo de comunicação unificada.

   Hoje cobre Gmail. WhatsApp e Slack ficam pra Fase 2/3 (precisam de
   provedores específicos). A camada é dimensionada pra acomodar mais.

   Funcionalidades:
   - getInbox: lista emails com classificação de urgência
   - summarizeInbox: resumo executivo
   - classify: IA classifica um email em (urgente/relevante/ruído)
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export type Urgency = "urgent" | "relevant" | "noise";

export interface ClassifiedEmail extends GmailMessageSummary {
  urgency: Urgency;
  reason: string;
}

async function getGmailToken(userId: string): Promise<string | null> {
  const integ = await prisma.integration.findFirst({
    where: { userId, provider: "gmail", status: "connected" },
  });
  if (!integ) return null;
  return tryEnsureFreshAccessToken(integ);
}

/** Retorna inbox classificada por urgência. */
export async function getClassifiedInbox(userId: string, opts: { max?: number } = {}): Promise<ClassifiedEmail[]> {
  const token = await getGmailToken(userId);
  if (!token) throw new Error("Gmail não conectado");

  const raw = await gmailList(token, { query: "newer_than:3d", maxResults: opts.max ?? 15 });
  if (raw.length === 0) return [];

  // Classifica em lote — uma chamada Claude pra todos
  const numbered = raw.map((m, i) => `${i + 1}. De: ${m.from}\n   Assunto: ${m.subject}\n   Snippet: ${m.snippet}`).join("\n\n");

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 800,
    temperature: 0.2,
    system: `Você é o classificador de emails do O.R.I.O.N.

Para cada email, escolha:
- "urgent": exige ação rápida (segurança, pagamento, deadline, oportunidade tempo-sensível)
- "relevant": importa mas pode esperar (trabalho, contato pessoal genuíno, oportunidade calma)
- "noise": newsletter, marketing, promocional, automático sem urgência

Devolva APENAS JSON, sem markdown, no formato:
[{"i": 1, "urgency": "urgent|relevant|noise", "reason": "frase curta"}, ...]`,
    messages: [{ role: "user", content: numbered }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  let parsed: Array<{ i: number; urgency: Urgency; reason: string }> = [];
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    // se a classificação falhar, devolve tudo como "relevant"
    return raw.map((m) => ({ ...m, urgency: "relevant", reason: "(classificação indisponível)" }));
  }

  return raw.map((m, idx) => {
    const c = parsed.find((p) => p.i === idx + 1);
    return {
      ...m,
      urgency: c?.urgency ?? "relevant",
      reason: c?.reason ?? "",
    };
  });
}

/** Resumo executivo em texto da caixa. */
export async function summarizeInbox(userId: string): Promise<string> {
  const list = await getClassifiedInbox(userId, { max: 20 });
  if (list.length === 0) return "Caixa vazia nos últimos 3 dias.";

  const urgent = list.filter((m) => m.urgency === "urgent").length;
  const relevant = list.filter((m) => m.urgency === "relevant").length;
  const noise = list.filter((m) => m.urgency === "noise").length;

  const briefingInput = list
    .slice(0, 12)
    .map((m, i) => `${i + 1}. [${m.urgency}] ${m.subject} — ${m.from}\n   ${m.reason}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 400,
    temperature: 0.6,
    system: `Você é o O.R.I.O.N. resumindo a caixa de entrada do usuário.
Tom sofisticado, conciso. 3-5 linhas. Cite por nome só o que merece atenção real.
Termine com pergunta de ação ("Quer que eu rascunhe respostas pros urgentes?").`,
    messages: [
      {
        role: "user",
        content: `Estatística: ${urgent} urgentes, ${relevant} relevantes, ${noise} ruído.\n\nDetalhes:\n${briefingInput}`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
