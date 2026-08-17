import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { gmailRead, gmailDraft } from "../integrations/google-api.js";
import { searchRelevantMemories } from "../memory/long-term.service.js";

/* ═══════════════════════════════════════════════════════════════════
   EMAIL DRAFTING — ORION lê emails e sugere respostas.

   Fluxo:
   1. Cognitive Loop detecta email novo de VIP ou urgente
   2. Este serviço lê o email e gera um rascunho de resposta
   3. O rascunho vai pra Decision Inbox para aprovação
   4. Se aprovado, cria o draft no Gmail

   Personaliza o tom baseado em:
   - BehavioralProfile do usuário
   - Histórico de emails com esse remetente (via memórias)
   - Contexto do projeto/pessoa (via entity graph)
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const DRAFT_SYSTEM = `Voce e o O.R.I.O.N escrevendo um rascunho de email em nome do usuario.

REGRAS:
- Mantenha o tom profissional mas natural — nao robotico
- Use o contexto sobre o remetente e o historico quando disponivel
- Se o email original esta em ingles, responda em ingles. Se em portugues, portugues.
- Seja conciso — emails longos nao sao lidos
- Inclua cumprimento e despedida apropriados
- Se nao tiver certeza do que responder, escreva algo generico mas educado e marque [REVISAR]

FORMATO: apenas o corpo do email, sem "Subject:" nem headers.`;

interface DraftInput {
  userId: string;
  emailId: string;
  accessToken: string;
  instructions?: string;  // instruções opcionais do usuário
}

interface DraftResult {
  originalSubject: string;
  originalFrom: string;
  draftBody: string;
  suggestedSubject: string;
  confidence: "high" | "medium" | "low";
}

export async function generateEmailDraft(input: DraftInput): Promise<DraftResult | null> {
  const { userId, emailId, accessToken, instructions } = input;

  // 1. Ler o email original
  const emailRaw = await gmailRead(accessToken, emailId).catch(() => null);
  if (!emailRaw) return null;
  const emailFrom: string = (emailRaw as Record<string, string>).from ?? "";
  const emailSubject: string = (emailRaw as Record<string, string>).subject ?? "";
  const emailDate: string = (emailRaw as Record<string, string>).date ?? "";
  const emailBody: string = (emailRaw as Record<string, string>).body ?? "";

  // 2. Buscar contexto sobre o remetente
  const senderName = emailFrom.split("<")[0]!.trim();
  const memories = await searchRelevantMemories(userId, `${senderName} email`, 3).catch(() => []);

  // 3. Buscar perfil comportamental
  const behavioralPref = await prisma.userPreference.findFirst({
    where: { userId, key: "behavioral_profile" },
  }).catch(() => null);

  let tonePref = "profissional e direto";
  if (behavioralPref?.value) {
    try {
      const profile = JSON.parse(behavioralPref.value) as Record<string, unknown>;
      if (profile.primaryLanguageTone) tonePref = String(profile.primaryLanguageTone);
    } catch { /* ignore */ }
  }

  // 4. Montar prompt
  const memoryContext = memories.length > 0
    ? `\nContexto sobre ${senderName}:\n${memories.map((m) => `- ${m.content}`).join("\n")}`
    : "";

  const prompt = `
EMAIL RECEBIDO:
De: ${emailFrom}
Assunto: ${emailSubject}
Data: ${emailDate}

Corpo:
${emailBody.slice(0, 3000)}
${memoryContext}
${instructions ? `\nInstrucoes do usuario: ${instructions}` : ""}

Tom preferido do usuario: ${tonePref}

Escreva o rascunho de resposta.`.trim();

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: DRAFT_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const body = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    if (!body) return null;

    // Determine confidence
    const hasReviewMark = body.includes("[REVISAR]");
    const isShort = body.length < 100;
    const confidence = hasReviewMark ? "low" : isShort ? "medium" : "high";

    const suggestedSubject = emailSubject.startsWith("Re:") ? emailSubject : `Re: ${emailSubject}`;

    return {
      originalSubject: emailSubject,
      originalFrom: emailFrom,
      draftBody: body,
      suggestedSubject,
      confidence,
    };
  } catch (err) {
    console.warn("[email-draft] Claude falhou:", (err as Error).message);
    return null;
  }
}

/** Cria o rascunho no Gmail após aprovação */
export async function createGmailDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  ): Promise<{ id: string } | null> {
  try {
    return await gmailDraft(accessToken, { to, subject, body });
  } catch (err) {
    console.warn("[email-draft] Gmail draft falhou:", (err as Error).message);
    return null;
  }
}
