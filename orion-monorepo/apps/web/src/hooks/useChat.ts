import type { ChatMessage } from "@orion/types";
import { useChatStore } from "../stores/chat.store.js";

/**
 * Hook fino que expõe só o que o ChatPanel precisa.
 * Componentes não devem tocar no store diretamente — usem este hook.
 */
export function useChat(): {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  setInput: (v: string) => void;
  send: (override?: string) => Promise<void>;
} {
  const messages = useChatStore((s) => s.messages);
  const input = useChatStore((s) => s.input);
  const loading = useChatStore((s) => s.loading);
  const setInput = useChatStore((s) => s.setInput);
  const send = useChatStore((s) => s.send);
  return { messages, input, loading, setInput, send };
}
