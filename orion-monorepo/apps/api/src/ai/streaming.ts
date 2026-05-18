import type { Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@orion/types";
import { env } from "../config/env.js";
import { anthropic } from "./claude.js";
import { getToolsForContext, type ToolContext } from "./tools.js";

/* ═══════════════════════════════════════════════════════════════════
   Streaming SSE — Claude API stream:true direto pro browser.

   Estratégia: usamos `anthropic.messages.stream()` que retorna um
   AsyncIterator de eventos. Cada delta de texto vira um chunk SSE
   `data: {"type":"text","value":"..."}\n\n`.

   Sinaliza fim com `data: {"type":"done"}` e fecha conexão.

   IMPORTANTE: este streaming NÃO usa tool loop completo. Pra mensagens
   que disparam tools (gmail_list, etc), o frontend cai pro endpoint
   não-streaming /v1/chat. O streaming é só pra resposta pura/conversa.
═══════════════════════════════════════════════════════════════════ */

export interface StreamCallOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  toolContext: ToolContext;
  maxTokens?: number;
  temperature?: number;
  /** chamado a cada delta de texto */
  onTextDelta: (text: string) => void;
  /** chamado quando o stream termina */
  onComplete: (finalText: string) => void;
  /** se Claude pediu ferramenta, abortamos o stream */
  onToolUse: () => void;
  /** erro */
  onError: (err: Error) => void;
}

export async function streamClaudeResponse(opts: StreamCallOptions): Promise<void> {
  const { systemPrompt, messages, toolContext, maxTokens = 2000, temperature = 0.7 } = opts;

  const formatted: Anthropic.MessageParam[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const tools = getToolsForContext(toolContext);
  let collected = "";

  try {
    const stream = anthropic.messages.stream({
      model: env.ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: formatted,
      ...(tools.length > 0 ? { tools } : {}),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "text_delta") {
          collected += delta.text;
          opts.onTextDelta(delta.text);
        }
      } else if (event.type === "content_block_start") {
        // Se for tool_use → não dá pra continuar em streaming
        if (event.content_block.type === "tool_use") {
          opts.onToolUse();
          return;
        }
      }
    }

    opts.onComplete(collected);
  } catch (err) {
    opts.onError(err as Error);
  }
}

/** Helper SSE — formata um payload como evento server-sent. */
export function sseEvent(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/** Headers padrão pra SSE. */
export function setSseHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // desativa buffering do nginx se houver proxy
  res.flushHeaders();
}
