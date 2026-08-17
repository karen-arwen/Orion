import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import {
  gmailList,
  gmailRead,
  gmailReply,
  gmailDraft,
  gmailArchive,
  gmailMarkRead,
  type GmailMessageSummary,
} from "../integrations/google-api.js";
import { tryEnsureFreshAccessToken } from "../integrations/token-manager.js";
import { createTask } from "./life.service.js";

/* ═══════════════════════════════════════════════════════════════════
   COMMS — Módulo de comunicação unificada.

   Funcionalidades:
   - getClassifiedInbox: inbox com urgência IA
   - summarizeInbox: resumo executivo IA
   - readEmail: conteúdo completo de um email
   - draftReply: Claude gera rascunho de resposta
   - sendReply: envia resposta real via Gmail
   - archiveEmail: arquiva (remove do INBOX)
   - snoozeEmail: agenda reaparecimento no banco (local)
   - createTaskFromEmail: cria Task no Life OS
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export type Urgency = "urgent" | "relevant" | "noise";

export interface ClassifiedEmail extends GmailMessageSummary {
  urgency: Urgency;
  reason: string;
}

export interface SnoozedEmail {
  id: string;
  userId: string;
  emailId: string;
  emailSubject: string;
  emailFrom: string;
  snoozeUntil: string;
  createdAt: string;
}

async function getGmailToken(userId: string): Promise<string> {
  const integ = await prisma.integration.findFirst({
    where: { userId, provider: "gmail", status: "connected" },
  });
  if (!integ) throw new Error("Gmail não conectado. Conecte em Integrações.");
  const token = await tryEnsureFreshAccessToken(integ);
  if (!token) throw new Error("Token Gmail expirado. Reconecte em Integrações.");
  return token;
}

/** Retorna inbox classificada por urgência. */
export async function getClassifiedInbox(
  userId: string,
  opts: { max?: number; filter?: "all" | "unread" | "starred" } = {},
): Promise<ClassifiedEmail[]> {
  const token = await getGmailToken(userId);

  const queryMap: Record<string, string> = {
    unread: "is:unread newer_than:3d",
    starred: "is:starred",
    all: "newer_than:3d",
  };
  const q = queryMap[opts.filter ?? "all"] ?? "newer_than:3d";

  const raw = await gmailList(token, { query: q, maxResults: opts.max ?? 20 });
  if (raw.length === 0) return [];

  const numbered = raw
    .map((m, i) => `${i + 1}. De: ${m.from}\n   Assunto: ${m.subject}\n   Snippet: ${m.snippet}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 900,
    temperature: 0.1,
    system: `Classifique emails como urgente/relevant/noise. JSON puro:
[{"i":1,"urgency":"urgent|relevant|noise","reason":"frase curta em pt-BR"}]`,
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
  try { parsed = JSON.parse(text) as typeof parsed; } catch {
    return raw.map((m) => ({ ...m, urgency: "relevant" as Urgency, reason: "" }));
  }

  return raw.map((m, idx) => {
    const c = parsed.find((p) => p.i === idx + 1);
    return { ...m, urgency: c?.urgency ?? "relevant", reason: c?.reason ?? "" };
  });
}

/** Lê corpo completo de um email. */
export async function readEmail(
  userId: string,
  emailId: string,
): Promise<{ subject: string; from: string; date: string; body: string }> {
  const token = await getGmailToken(userId);
  await gmailMarkRead(token, emailId).catch(() => void 0);
  return gmailRead(token, emailId);
}

/** Claude gera rascunho de resposta para o email. */
export async function draftReply(
  userId: string,
  emailId: string,
  instructions?: string,
): Promise<{ draft: string }> {
  const token = await getGmailToken(userId);
  const email = await gmailRead(token, emailId);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const fromName = user?.name ?? "usuário";

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 600,
    system: `Você é o O.R.I.O.N. rascunhando uma resposta de email para ${fromName}.
Tom: profissional mas humano. Resposta concisa. Em pt-BR.
${instructions ? `Instrução extra: ${instructions}` : ""}
Devolva APENAS o corpo da resposta — sem assunto, sem saudação genérica no início.`,
    messages: [
      {
        role: "user",
        content: `Email recebido:\nDe: ${email.from}\nAssunto: ${email.subject}\n\n${email.body}`,
      },
    ],
  });

  const draft = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return { draft };
}

/** Envia resposta real. Usuário deve ter confirmado no frontend. */
export async function sendReply(
  userId: string,
  opts: { emailId: string; threadId: string; to: string; subject: string; body: string },
): Promise<{ id: string; threadId: string }> {
  const token = await getGmailToken(userId);
  return gmailReply(token, {
    threadId: opts.threadId,
    messageId: opts.emailId,
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
  });
}

/** Arquiva email (remove do INBOX). */
export async function archiveEmail(userId: string, emailId: string): Promise<void> {
  const token = await getGmailToken(userId);
  await gmailArchive(token, emailId);
}

/** Snooze: guarda no banco pra reaparecer depois (sem mudar labels no Gmail). */
export async function snoozeEmail(
  userId: string,
  opts: { emailId: string; subject: string; from: string; snoozeUntil: Date },
): Promise<void> {
  // Usa a tabela InboxItem ou cria registro genérico num campo JSON de UserPattern
  // Por ora, armazenamos em InboxItem com status especial (reusing existing infrastructure)
  // Persist snooze as a UserPattern entry (survives across sessions)
  const snoozeKey = `email_snooze_${opts.emailId}`;
  await prisma.userPattern.upsert({
    where: { userId_patternType: { userId, patternType: snoozeKey } },
    create: {
      userId,
      patternType: snoozeKey,
      data: {
        emailId: opts.emailId,
        subject: opts.subject,
        from: opts.from,
        snoozeUntil: opts.snoozeUntil.toISOString(),
      },
      confidence: 1.0,
    },
    update: {
      data: {
        emailId: opts.emailId,
        subject: opts.subject,
        from: opts.from,
        snoozeUntil: opts.snoozeUntil.toISOString(),
      },
    },
  });
}

/** Cria tarefa no Life OS a partir de um email. */
export async function createTaskFromEmail(
  userId: string,
  emailId: string,
  opts?: { customTitle?: string; dueAt?: string },
): Promise<unknown> {
  const token = await getGmailToken(userId);
  const email = await gmailRead(token, emailId);

  const title = opts?.customTitle ?? `Email: ${email.subject}`;

  return createTask(userId, {
    title,
    notes: `De: ${email.from}\n\n${email.body.slice(0, 500)}`,
    priority: 2,
    energy: 2,
    dueAt: opts?.dueAt,
  });
}

/** Resumo executivo da caixa. */
export async function summarizeInbox(userId: string): Promise<string> {
  const list = await getClassifiedInbox(userId, { max: 20 });
  if (list.length === 0) return "Caixa vazia nos últimos 3 dias.";

  const urgent   = list.filter((m) => m.urgency === "urgent").length;
  const relevant = list.filter((m) => m.urgency === "relevant").length;
  const noise    = list.filter((m) => m.urgency === "noise").length;

  const briefingInput = list
    .slice(0, 12)
    .map((m, i) => `${i + 1}. [${m.urgency}] ${m.subject} — ${m.from}\n   ${m.reason}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 400,
    temperature: 0.5,
    system: `Você é o O.R.I.O.N. resumindo a caixa de entrada.
Tom sofisticado, conciso. 3-4 linhas. Cite só o que merece atenção.
Termine com uma ação sugerida.`,
    messages: [
      {
        role: "user",
        content: `${urgent} urgentes, ${relevant} relevantes, ${noise} ruído.\n\n${briefingInput}`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
