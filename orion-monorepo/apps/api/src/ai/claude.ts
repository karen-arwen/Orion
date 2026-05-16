import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@orion/types";
import { env } from "../config/env.js";
import { executeTool, getToolsForContext, type ToolContext } from "./tools.js";

/* ═══════════════════════════════════════════════════════════════════
   Cliente Claude com TOOL USE (Gmail / Calendar / Drive via REST).

   Em vez de delegar pra um MCP remoto (que ainda não existe no Google),
   nós definimos as ferramentas localmente e executamos cada chamada
   usando o access_token OAuth do usuário (renovado pelo token-manager).

   Loop: o Claude pede ferramenta → executamos → devolvemos resultado →
   ele pode pedir outra ou responder. Limite de iterações pra segurança.
═══════════════════════════════════════════════════════════════════ */

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const MAX_TOOL_ITERATIONS = 5;

export interface ChatCallOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  toolContext: ToolContext;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatCallResult {
  text: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; ok: boolean }>;
  stopReason: string | null;
  iterations: number;
  usage: { inputTokens: number; outputTokens: number };
}

type AnthropicMsgParam = Anthropic.MessageParam;
type AnthropicContentBlock = Anthropic.ContentBlock;
type AnthropicToolUseBlock = Anthropic.ToolUseBlock;
type AnthropicToolResultBlock = Anthropic.ToolResultBlockParam;

function isToolUse(block: AnthropicContentBlock): block is AnthropicToolUseBlock {
  return block.type === "tool_use";
}

export async function callClaude(opts: ChatCallOptions): Promise<ChatCallResult> {
  const { systemPrompt, messages, toolContext, maxTokens = 2000, temperature = 0.7 } = opts;

  // Conversa que vai pro Claude (vamos crescendo a cada iteração de tool use)
  const conversation: AnthropicMsgParam[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const tools = getToolsForContext(toolContext);
  const collectedToolCalls: ChatCallResult["toolCalls"] = [];
  let totalInput = 0;
  let totalOutput = 0;
  let iterations = 0;
  let finalText = "";
  let stopReason: string | null = null;

  for (iterations = 0; iterations < MAX_TOOL_ITERATIONS; iterations++) {
    const response: Anthropic.Message = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: conversation,
      ...(tools.length > 0 ? { tools } : {}),
    });

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;
    stopReason = response.stop_reason ?? null;

    // Se ele não pediu ferramenta, a resposta é final
    if (response.stop_reason !== "tool_use") {
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      break;
    }

    // Caso contrário: rodar cada tool_use e devolver os resultados
    const toolUses = response.content.filter(isToolUse);

    const toolResults: AnthropicToolResultBlock[] = await Promise.all(
      toolUses.map(async (tu) => {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        const result = await executeTool(tu.name, input, toolContext);
        collectedToolCalls.push({ name: tu.name, input, ok: result.ok });
        return {
          type: "tool_result" as const,
          tool_use_id: tu.id,
          content: result.result,
          ...(result.ok ? {} : { is_error: true }),
        };
      }),
    );

    // Adiciona a vez do assistant (com os tool_use) + nossa resposta (tool_results)
    conversation.push({ role: "assistant", content: response.content });
    conversation.push({ role: "user", content: toolResults });
    // próxima iteração
  }

  // Se saiu do loop por limite e não capturou texto final, pega o último texto que veio
  if (!finalText) {
    finalText =
      "Atingi o limite de iterações de ferramentas. Tenta reformular a pergunta?";
  }

  return {
    text: finalText,
    toolCalls: collectedToolCalls,
    stopReason,
    iterations,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
  };
}
