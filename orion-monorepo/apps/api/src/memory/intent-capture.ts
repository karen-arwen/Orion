import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { routeInternalAction } from "../decisions/action-router.js";
import type { InternalActionType } from "@orion/types";

/* ═══════════════════════════════════════════════════════════════════
   INTENT CAPTURE — segundo cérebro automático.

   O ORION lê cada mensagem do usuário e extrai intenções implícitas
   que o usuário NÃO pediu explicitamente mas claramente tem:

   "Preciso ligar pra minha mãe essa semana"
   → cria tarefa "Ligar pra mãe" sem o usuário pedir

   "Esse livro 'Sapiens' parece interessante"
   → adiciona à lista de leitura sem o usuário pedir

   "Tenho que lembrar de renovar o passaporte em agosto"
   → cria tarefa com deadline em agosto sem o usuário pedir

   "Nossa, faz tempo que não falo com o Paulo"
   → cria follow-up no Social CRM sem o usuário pedir

   O usuário pode ver tudo que foi capturado no histórico.
   Nada é oculto. E pode configurar a sensibilidade.

   Roda ANTES de responder ao usuário — é proativo, não reativo.
═══════════════════════════════════════════════════════════════════ */

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ─── Tipos ─────────────────────────────────────────────────────────

interface CapturedIntent {
  type: "task" | "reminder" | "note" | "reading" | "contact_followup" | "memory";
  confidence: number;   // 0-1: quão certo que o usuário quer isso
  title: string;
  content: string;
  dueDate?: string;     // ISO se detectou prazo
  actionType: InternalActionType;
  actionInput: Record<string, unknown>;
}

// ─── Extrator ─────────────────────────────────────────────────────

const INTENT_SYSTEM = `Você é o extrator de intenções implícitas do O.R.I.O.N.

Leia a mensagem do usuário e identifique INTENÇÕES IMPLÍCITAS que ele tem mas não pediu explicitamente.

TIPOS DE INTENÇÃO:
- "task": o usuário menciona que precisa fazer algo ("preciso ligar", "tenho que renovar")
- "reminder": mencionou uma data ou evento futuro ("em agosto", "semana que vem")
- "note": compartilhou uma ideia ou insight que vale guardar
- "reading": mencionou um livro, artigo, filme ou série que quer consumir
- "contact_followup": mencionou alguém que quer ou deveria contatar
- "memory": revelou algo importante sobre si mesmo que vale lembrar

REGRAS CRÍTICAS:
- Só capture se confidence >= 0.65 (alta certeza que o usuário quer isso)
- NUNCA capture o que o usuário JÁ pediu ao ORION — isso seria duplicar
- Se é pergunta ou curiosidade, NÃO capture — só capture intenções de ação
- Máx 3 intenções por mensagem (filtre as mais relevantes)
- actionType: use SOMENTE "task.create" ou "memory.create"
- Se não encontrar nenhuma intenção implícita clara, retorne []

CAMPOS OBRIGATÓRIOS POR actionType:
- "task.create" → actionInput DEVE ter: { "title": "...", "notes": "...", "priority": 2, "energy": 2 }
- "memory.create" → actionInput DEVE ter: { "type": "fact", "content": "...", "importance": 0.72 }

FORMATO JSON PURO:
[
  {
    "type": "task | reminder | note | reading | contact_followup | memory",
    "confidence": 0.8,
    "title": "título curto e claro",
    "content": "detalhes capturados",
    "dueDate": "2026-08-01T00:00:00.000Z ou null",
    "actionType": "task.create | memory.create",
    "actionInput": { ... campos obrigatórios conforme actionType acima ... }
  }
]`;

export async function captureImplicitIntents(
  userMessage: string,
  userId: string,
): Promise<CapturedIntent[]> {
  // Mensagens muito curtas provavelmente não têm intenções implícitas
  if (userMessage.trim().length < 15) return [];

  // Filtra mensagens que são claramente só perguntas
  const isJustQuestion = /^(o que|como|quando|quem|onde|por que|qual|me (diga|fala|explica|conta)|você (sabe|pode|consegue))/i.test(
    userMessage.trim()
  );
  if (isJustQuestion && !userMessage.includes("preciso") && !userMessage.includes("tenho que")) return [];

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: INTENT_SYSTEM,
      messages: [{ role: "user", content: `Mensagem do usuário:\n"${userMessage}"` }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];

    return (parsed as CapturedIntent[]).filter((i) => i.confidence >= 0.65).slice(0, 3);
  } catch {
    return [];
  }
}

// ─── Executor de intenções capturadas ────────────────────────────

export async function executeIntents(userId: string, intents: CapturedIntent[]): Promise<void> {
  for (const intent of intents) {
    await routeInternalAction(userId, {
      title: intent.title,
      summary: `[Captura automática] ${intent.content}`,
      proposedAction: `ORION detectou e capturou: "${intent.title}" da sua conversa.`,
      priority: intent.confidence >= 0.85 ? "medium" : "low",
      actionType: intent.actionType,
      actionInput: buildActionInput(intent),
    }).catch(console.warn);
  }
}

function buildActionInput(intent: CapturedIntent): Record<string, unknown> {
  // Para memory.create: garante campo "content" obrigatório
  if (intent.actionType === "memory.create") {
    const base = Object.keys(intent.actionInput).length > 0 ? intent.actionInput : {};
    return {
      type: "fact",
      importance: intent.confidence * 0.8,
      ...base,
      // content é obrigatório — nunca pode ser undefined
      content: (base["content"] as string | undefined) || `${intent.title}: ${intent.content}`,
    };
  }

  // Para task.create: garante campos "title" e "notes" obrigatórios
  if (intent.actionType === "task.create") {
    const base = Object.keys(intent.actionInput).length > 0 ? intent.actionInput : {};
    return {
      priority: 2,
      energy: 2,
      estMinutes: 30,
      ...base,
      title: (base["title"] as string | undefined) || intent.title,
      notes: (base["notes"] as string | undefined) || intent.content,
      ...(intent.dueDate ? { scheduledFor: intent.dueDate } : {}),
    };
  }

  // Fallback por tipo semântico (caso actionType seja outro)
  switch (intent.type) {
    case "task":
    case "reminder":
      return {
        title: intent.title,
        notes: intent.content,
        priority: 2,
        energy: 2,
        estMinutes: 30,
        ...(intent.dueDate ? { scheduledFor: intent.dueDate } : {}),
      };

    case "reading":
      return {
        title: intent.title,
        type: "book",
        status: "want",
        notes: intent.content,
      };

    case "contact_followup":
      return {
        title: `Follow-up: ${intent.title}`,
        notes: intent.content,
        priority: 1,
        energy: 1,
        estMinutes: 15,
      };

    case "note":
    case "memory":
    default:
      return {
        type: "fact",
        content: `${intent.title}: ${intent.content}`,
        importance: intent.confidence * 0.8,
      };
  }
}
