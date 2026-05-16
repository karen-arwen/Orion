import type Anthropic from "@anthropic-ai/sdk";
import {
  calendarCreate,
  calendarList,
  driveReadDoc,
  driveSearch,
  gmailDraft,
  gmailList,
  gmailRead,
  gmailReply,
  gmailSend,
} from "../integrations/google-api.js";

/* ═══════════════════════════════════════════════════════════════════
   Definição das ferramentas que o Claude pode chamar.

   - tools[] = schema (vai pro Claude)
   - executeTool() = dispatcher que recebe nome+args, executa e retorna
     o resultado como string (texto que o Claude lê no próximo turno).

   ToolContext carrega o que o executor precisa pra agir em nome do
   usuário: o access_token de cada provider (já renovado pelo
   token-manager) e o timezone pra interpretar datas relativas.
═══════════════════════════════════════════════════════════════════ */

export interface ToolContext {
  gmailToken: string | null;
  gcalToken: string | null;
  gdriveToken: string | null;
  timezone: string;
}

type ToolSchema = Anthropic.Tool;

/** Define o conjunto de tools que o Claude vê. */
export function getToolsForContext(ctx: ToolContext): ToolSchema[] {
  const tools: ToolSchema[] = [];

  if (ctx.gmailToken) {
    tools.push(
      {
        name: "gmail_list",
        description:
          "Lista os emails mais recentes da caixa de entrada do usuário. Use 'query' com sintaxe do Gmail (ex: 'is:unread', 'from:joao@x.com', 'newer_than:2d', 'has:attachment'). Sem query = últimos emails recebidos. Retorna metadados (não o corpo completo).",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Filtro estilo Gmail. Ex: 'is:unread newer_than:1d'. Deixe vazio pra últimos emails.",
            },
            max: {
              type: "number",
              description: "Quantidade de emails (1-25). Padrão 10.",
            },
          },
        },
      },
      {
        name: "gmail_read",
        description:
          "Lê o corpo completo de um email específico. Use o ID retornado por gmail_list. Útil quando o usuário quer detalhes ou pra rascunhar uma resposta.",
        input_schema: {
          type: "object",
          properties: {
            message_id: { type: "string", description: "ID da mensagem (vem de gmail_list)" },
          },
          required: ["message_id"],
        },
      },
      {
        name: "gmail_draft",
        description:
          "Cria um RASCUNHO de email — não envia. Útil quando o usuário quer revisar antes. Rascunho fica na pasta Rascunhos do Gmail.",
        input_schema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Email do destinatário" },
            subject: { type: "string", description: "Assunto" },
            body: { type: "string", description: "Corpo do email em texto plano" },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "gmail_send",
        description:
          "ENVIA um email direto da conta do usuário. AÇÃO IRREVERSÍVEL — SEMPRE confirme com o usuário (mostrando destinatário, assunto e corpo) ANTES de chamar. Se o usuário pediu pra 'enviar' diretamente, ainda assim mostre o rascunho final e pergunte 'Posso enviar?' antes de chamar essa tool.",
        input_schema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Email do destinatário" },
            subject: { type: "string", description: "Assunto" },
            body: { type: "string", description: "Corpo do email em texto plano" },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "gmail_reply",
        description:
          "Responde uma thread de email mantendo o histórico. Use após gmail_read pra pegar thread_id, message_id e from. AÇÃO IRREVERSÍVEL — confirme com o usuário ANTES de chamar.",
        input_schema: {
          type: "object",
          properties: {
            thread_id: { type: "string", description: "ID da thread (de gmail_list/read)" },
            message_id: { type: "string", description: "ID do email original (de gmail_list/read)" },
            to: { type: "string", description: "Email pra quem responder (geralmente o from do original)" },
            subject: { type: "string", description: "Assunto original (prefixo 'Re:' é adicionado se faltar)" },
            body: { type: "string", description: "Corpo da resposta" },
          },
          required: ["thread_id", "message_id", "to", "subject", "body"],
        },
      },
    );
  }

  if (ctx.gcalToken) {
    tools.push(
      {
        name: "calendar_list",
        description:
          "Lista eventos do calendário entre duas datas. Use ISO 8601 com timezone. Pra 'hoje', 'amanhã', 'esta semana' — calcule as datas concretas no timezone do usuário antes de chamar.",
        input_schema: {
          type: "object",
          properties: {
            time_min: { type: "string", description: "Início (ISO 8601, ex: 2026-05-15T00:00:00-03:00)" },
            time_max: { type: "string", description: "Fim (ISO 8601)" },
            max: { type: "number", description: "Máximo de eventos. Padrão 20." },
          },
          required: ["time_min", "time_max"],
        },
      },
      {
        name: "calendar_create",
        description:
          "Cria um evento no calendário do usuário. CONFIRME COM O USUÁRIO antes de criar (mostre data/hora completas). USE SEMPRE O ANO ATUAL (vide bloco DATA ATUAL no system prompt) — nunca crie em anos passados. Se o usuário disser 'amanhã' ou 'sexta', calcule a data exata no ano atual.",
        input_schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Título do evento" },
            start_iso: {
              type: "string",
              description:
                "Início no formato ISO 8601 com timezone, ex: 2026-05-18T14:00:00-03:00. ANO DEVE SER O ATUAL.",
            },
            end_iso: {
              type: "string",
              description:
                "Fim no formato ISO 8601 com timezone. ANO DEVE SER O ATUAL.",
            },
            description: { type: "string", description: "Descrição opcional" },
            location: { type: "string", description: "Local opcional" },
            attendees: {
              type: "array",
              items: { type: "string" },
              description: "Emails dos convidados (opcional)",
            },
          },
          required: ["summary", "start_iso", "end_iso"],
        },
      },
    );
  }

  if (ctx.gdriveToken) {
    tools.push(
      {
        name: "drive_search",
        description:
          "Busca arquivos no Google Drive por nome ou conteúdo. Retorna lista com IDs e nomes.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Termo de busca" },
            max: { type: "number", description: "Máximo de resultados. Padrão 10." },
          },
          required: ["query"],
        },
      },
      {
        name: "drive_read_doc",
        description:
          "Lê o texto de um Google Doc. Use o ID retornado por drive_search. Funciona só pra Google Docs (não PDFs/Sheets).",
        input_schema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "ID do arquivo (de drive_search)" },
          },
          required: ["file_id"],
        },
      },
    );
  }

  return tools;
}

// ── EXECUTOR ───────────────────────────────────────────────────────

interface ExecResult {
  ok: boolean;
  result: string;
}

/** Despacha uma tool_use call do Claude pra implementação real. */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ExecResult> {
  try {
    switch (name) {
      case "gmail_list": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const list = await gmailList(ctx.gmailToken, {
          query: typeof input.query === "string" ? input.query : undefined,
          maxResults: typeof input.max === "number" ? input.max : 10,
        });
        if (list.length === 0) return { ok: true, result: "Nenhum email encontrado pra esse filtro." };
        return {
          ok: true,
          result: list
            .map(
              (m, i) =>
                `${i + 1}. [${m.unread ? "NÃO LIDO" : "LIDO"}] ${m.subject}\n` +
                `   De: ${m.from}\n   Em: ${m.date}\n   ID: ${m.id}\n   Snippet: ${m.snippet}`,
            )
            .join("\n\n"),
        };
      }

      case "gmail_read": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const id = typeof input.message_id === "string" ? input.message_id : "";
        if (!id) return { ok: false, result: "message_id obrigatório." };
        const msg = await gmailRead(ctx.gmailToken, id);
        return {
          ok: true,
          result: `Assunto: ${msg.subject}\nDe: ${msg.from}\nData: ${msg.date}\n\n${msg.body}`,
        };
      }

      case "gmail_draft": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const to = typeof input.to === "string" ? input.to : "";
        const subject = typeof input.subject === "string" ? input.subject : "";
        const body = typeof input.body === "string" ? input.body : "";
        if (!to || !subject || !body) {
          return { ok: false, result: "to, subject e body são obrigatórios." };
        }
        const r = await gmailDraft(ctx.gmailToken, { to, subject, body });
        return { ok: true, result: `Rascunho criado (id: ${r.id}). Está na pasta Rascunhos do Gmail.` };
      }

      case "gmail_send": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const to = typeof input.to === "string" ? input.to : "";
        const subject = typeof input.subject === "string" ? input.subject : "";
        const body = typeof input.body === "string" ? input.body : "";
        if (!to || !subject || !body) {
          return { ok: false, result: "to, subject e body são obrigatórios." };
        }
        const r = await gmailSend(ctx.gmailToken, { to, subject, body });
        return { ok: true, result: `Email enviado pra ${to} (id: ${r.id}).` };
      }

      case "gmail_reply": {
        if (!ctx.gmailToken) return { ok: false, result: "Gmail não conectado." };
        const threadId = typeof input.thread_id === "string" ? input.thread_id : "";
        const messageId = typeof input.message_id === "string" ? input.message_id : "";
        const to = typeof input.to === "string" ? input.to : "";
        const subject = typeof input.subject === "string" ? input.subject : "";
        const body = typeof input.body === "string" ? input.body : "";
        if (!threadId || !messageId || !to || !subject || !body) {
          return { ok: false, result: "thread_id, message_id, to, subject e body são obrigatórios." };
        }
        const r = await gmailReply(ctx.gmailToken, { threadId, messageId, to, subject, body });
        return { ok: true, result: `Resposta enviada pra ${to} (id: ${r.id}).` };
      }

      case "calendar_list": {
        if (!ctx.gcalToken) return { ok: false, result: "Calendar não conectado." };
        const timeMin = typeof input.time_min === "string" ? input.time_min : "";
        const timeMax = typeof input.time_max === "string" ? input.time_max : "";
        if (!timeMin || !timeMax) return { ok: false, result: "time_min e time_max obrigatórios (ISO 8601)." };
        const events = await calendarList(ctx.gcalToken, {
          timeMin,
          timeMax,
          maxResults: typeof input.max === "number" ? input.max : 20,
        });
        if (events.length === 0) return { ok: true, result: "Nenhum evento nesse período." };
        return {
          ok: true,
          result: events
            .map(
              (e, i) =>
                `${i + 1}. ${e.summary}\n   ${e.start} → ${e.end}` +
                (e.location ? `\n   Local: ${e.location}` : "") +
                (e.meetingUrl ? `\n   Vídeo: ${e.meetingUrl}` : "") +
                (e.attendees.length ? `\n   Com: ${e.attendees.join(", ")}` : ""),
            )
            .join("\n\n"),
        };
      }

      case "calendar_create": {
        if (!ctx.gcalToken) return { ok: false, result: "Calendar não conectado." };
        const summary = typeof input.summary === "string" ? input.summary : "";
        const startISO = typeof input.start_iso === "string" ? input.start_iso : "";
        const endISO = typeof input.end_iso === "string" ? input.end_iso : "";
        if (!summary || !startISO || !endISO) {
          return { ok: false, result: "summary, start_iso e end_iso obrigatórios." };
        }
        // ── Guard contra criação em ano passado ───────────────────
        // Bug recorrente: Claude às vezes infere ano errado quando user fala "amanhã".
        // Aqui rejeitamos com mensagem clara — Claude vê o erro e corrige no próximo turno.
        const startDate = new Date(startISO);
        const now = new Date();
        if (isNaN(startDate.getTime())) {
          return { ok: false, result: `start_iso "${startISO}" inválido — precisa ser ISO 8601.` };
        }
        // Tolerância: se o evento começa mais de 1 dia ATRÁS, é provável erro de ano
        if (startDate.getTime() < now.getTime() - 24 * 3600 * 1000) {
          const currentYear = now.getFullYear();
          return {
            ok: false,
            result: `Data ${startISO} parece estar no passado. O ano atual é ${currentYear}. Confirme com o usuário e recrie usando o ano correto.`,
          };
        }
        const r = await calendarCreate(ctx.gcalToken, {
          summary,
          startISO,
          endISO,
          description: typeof input.description === "string" ? input.description : undefined,
          location: typeof input.location === "string" ? input.location : undefined,
          attendees: Array.isArray(input.attendees)
            ? input.attendees.filter((a): a is string => typeof a === "string")
            : undefined,
        });
        return { ok: true, result: `Evento criado: ${r.htmlLink}` };
      }

      case "drive_search": {
        if (!ctx.gdriveToken) return { ok: false, result: "Drive não conectado." };
        const q = typeof input.query === "string" ? input.query : "";
        if (!q) return { ok: false, result: "query obrigatório." };
        const files = await driveSearch(
          ctx.gdriveToken,
          q,
          typeof input.max === "number" ? input.max : 10,
        );
        if (files.length === 0) return { ok: true, result: "Nenhum arquivo encontrado." };
        return {
          ok: true,
          result: files
            .map(
              (f, i) =>
                `${i + 1}. ${f.name}\n   Tipo: ${f.mimeType}\n   Modificado: ${f.modifiedTime}\n   ID: ${f.id}`,
            )
            .join("\n\n"),
        };
      }

      case "drive_read_doc": {
        if (!ctx.gdriveToken) return { ok: false, result: "Drive não conectado." };
        const id = typeof input.file_id === "string" ? input.file_id : "";
        if (!id) return { ok: false, result: "file_id obrigatório." };
        const text = await driveReadDoc(ctx.gdriveToken, id);
        return { ok: true, result: text || "(documento vazio)" };
      }

      default:
        return { ok: false, result: `Ferramenta desconhecida: ${name}` };
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[tools] ${name} falhou:`, reason);
    return { ok: false, result: `Erro ao executar ${name}: ${reason}` };
  }
}
