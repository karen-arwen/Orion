import type { Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@orion/types";
import { env } from "../config/env.js";
import { anthropic } from "./claude.js";
import { getToolsForContext, executeTool, type ToolContext } from "./tools.js";

/* ═══════════════════════════════════════════════════════════════════
   Streaming SSE — Claude API stream + tool use NATIVO.

   Versão anterior abortava o stream quando Claude pedia uma tool
   e mandava o frontend refazer via POST. Isso quebrava a experiência.

   Nova estratégia:
   1. Abre stream com anthropic.messages.stream()
   2. Emite deltas de texto token-a-token via SSE
   3. Quando Claude pede ferramenta:
      a. Acumula os tool_use blocks (podem ser múltiplos em paralelo)
      b. Sinaliza ao frontend: { type: "tool_start", tools: [...] }
      c. Executa todas as tools em paralelo
      d. Emite: { type: "tool_done", results: [...] }
      e. Abre NOVO stream com o contexto atualizado (loop)
   4. Repete até stop_reason !== "tool_use" ou MAX_ITERATIONS
   5. Ao final: { type: "done" }

   O frontend não precisa mais fazer nada — apenas ouvir o stream
   e renderizar texto + indicadores de tool use conforme chegam.

   Limite: MAX_TOOL_ITERATIONS = 5 (mesmo do non-streaming)
═══════════════════════════════════════════════════════════════════ */

const MAX_TOOL_ITERATIONS = 5;

export interface StreamCallOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  toolContext: ToolContext;
  maxTokens?: number;
  temperature?: number;
  onTextDelta: (text: string) => void;
  onToolStart: (toolNames: string[]) => void;    // avisa frontend que tool está rodando
  onToolDone: (results: Array<{ name: string; ok: boolean }>) => void;
  onComplete: (finalText: string) => void;
  onError: (err: Error) => void;
}

type AnthropicMsg = Anthropic.MessageParam;

export async function streamClaudeResponse(opts: StreamCallOptions): Promise<void> {
  const {
    systemPrompt,
    messages,
    toolContext,
    maxTokens = 8192,
    temperature = 0.7,
  } = opts;

  const tools = getToolsForContext(toolContext);

  // Conversa acumulada ao longo das iterações de tool use
  const conversation: AnthropicMsg[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  let fullText = "";
  let iteration = 0;

  try {
    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      // ── Abre o stream desta iteração ───────────────────────────
      const stream = anthropic.messages.stream({
        model: env.ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: conversation,
        ...(tools.length > 0 ? { tools } : {}),
      });

      // Coleta de tool_use blocks desta iteração
      const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
      let currentToolBlock: Partial<Anthropic.ToolUseBlock> | null = null;
      let inputJson = "";
      let iterationText = "";
      let rawContent: Anthropic.ContentBlock[] = [];

      // ── Processa eventos do stream ───�
      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "text") {
            currentToolBlock = null;
            inputJson = "";
          } else if (event.content_block.type === "tool_use") {
            currentToolBlock = {
              type: "tool_use",
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
            };
            inputJson = "";
          }
        } else if (event.type === "content_block_delta") {
          const delta = event.delta;
          if (delta.type === "text_delta") {
            iterationText += delta.text;
            fullText += delta.text;
            opts.onTextDelta(delta.text);
          } else if (delta.type === "input_json_delta") {
            inputJson += delta.partial_json;
          }
        } else if (event.type === "content_block_stop") {
          if (currentToolBlock?.type === "tool_use") {
            try {
              currentToolBlock.input = inputJson ? (JSON.parse(inputJson) as Record<string, unknown>) : {};
            } catch {
              currentToolBlock.input = {};
            }
            toolUseBlocks.push(currentToolBlock as Anthropic.ToolUseBlock);
            currentToolBlock = null;
            inputJson = "";
          }
        } else if (event.type === "message_stop") {
          const finalMessage = await stream.finalMessage();
          rawContent = finalMessage.content;
        }
      }

      if (toolUseBlocks.length === 0) {
        break;
      }

      opts.onToolStart(toolUseBlocks.map((t) => t.name));

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (tu) => {
          const result = await executeTool(
            tu.name,
            (tu.input ?? {}) as Record<string, unknown>,
            toolContext,
          );
          return {
            name: tu.name,
            ok: result.ok,
            block: {
              type: "tool_result" as const,
              tool_use_id: tu.id,
              content: result.result,
              ...(result.ok ? {} : { is_error: true }),
            },
          };
        }),
      );

      opts.onToolDone(toolResults.map((r) => ({ name: r.name, ok: r.ok })));

      conversation.push({ role: "assistant", content: rawContent });
      conversation.push({
        role: "user",
        content: toolResults.map((r) => r.block),
      });
    }

    opts.onComplete(fullText || "(ORION respondeu silenciosamente.)");
  } catch (err) {
    opts.onError(err as Error);
  }
}

export function sseEvent(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function setSseHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}
