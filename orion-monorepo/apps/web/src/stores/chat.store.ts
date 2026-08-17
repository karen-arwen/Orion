import { create } from "zustand";
import type { ChatMessage, UserProfile } from "@orion/types";
import { api, ApiClientError, streamChat } from "../lib/api.js";

// Ferramentas ativas que o ORION está executando agora
export interface ActiveTool {
  name: string;
  status: "running" | "done" | "error";
}

interface ChatStore {
  messages: ChatMessage[];
  conversationId: string | null;
  input: string;
  loading: boolean;
  activeTools: ActiveTool[];  // tools em execução no momento
  setInput: (v: string) => void;
  bootstrapWelcome: (profile: UserProfile) => void;
  send: (override?: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  reset: () => void;
}

let inFlight = false;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  conversationId: null,
  input: "",
  loading: false,
  activeTools: [],

  setInput: (v) => set({ input: v }),

  bootstrapWelcome: (profile) => {
    if (get().messages.length > 0) return;
    const welcome: ChatMessage = {
      id: "welcome",
      role: "assistant",
      content: `Sistemas reinicializados. Bem-vindo(a), ${profile.name}.

Sou O.R.I.O.N — seu sistema operacional pessoal. ${
        profile.mode === "STARK"
          ? "Modo STARK ativo: vou antecipar suas necessidades."
          : profile.mode === "SILENCIOSO"
          ? "Modo SILENCIOSO: só falo quando crítico."
          : "Modo NORMAL: proativo com bom senso."
      }

O que fazemos primeiro?`,
    };
    set({ messages: [welcome] });
  },

  send: async (override) => {
    const text = (override ?? get().input).trim();
    if (!text || inFlight) return;
    inFlight = true;

    const userMsg: ChatMessage = { role: "user", content: text };
    const placeholderId = `pending-${Date.now()}`;
    const placeholder: ChatMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      loading: true,
    };

    set((s) => ({
      messages: [...s.messages, userMsg, placeholder],
      input: "",
      loading: true,
      activeTools: [],
    }));

    let streamedText = "";
    let needsFallback = false;
    let streamError: string | null = null;

    try {
      const conversationId = get().conversationId ?? undefined;
      await streamChat(
        { message: text, conversationId },
        {
          onMeta: (cid) => set({ conversationId: cid }),

          onText: (chunk) => {
            streamedText += chunk;
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === placeholderId ? { ...m, content: streamedText, loading: true } : m,
              ),
            }));
          },

          // ORION começou a executar ferramentas — mostra indicadores
          onToolStart: (tools) => {
            set({
              activeTools: tools.map((name) => ({ name, status: "running" as const })),
            });
          },

          // Ferramentas concluídas — atualiza status
          onToolDone: (results) => {
            set({
              activeTools: results.map((r) => ({
                name: r.name,
                status: r.ok ? ("done" as const) : ("error" as const),
              })),
            });
            // Limpa após 2s para não poluir a UI
            setTimeout(() => set({ activeTools: [] }), 2000);
          },

          onFallback: () => {
            needsFallback = true;
          },
          onError: (msg) => {
            streamError = msg;
          },
        },
      );
    } catch (err) {
      streamError = err instanceof Error ? err.message : String(err);
    }

    // Fallback para non-streaming se necessário (compatibilidade)
    if (needsFallback || (streamError && !streamedText)) {
      try {
        const conversationId = get().conversationId ?? undefined;
        const response = await api.sendMessage({ message: text, conversationId });
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === placeholderId ? { ...response.message, id: `a-${Date.now()}` } : m,
          ),
          conversationId: response.conversationId,
          loading: false,
          activeTools: [],
        }));
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? `${err.code}: ${err.message}`
            : "Falha na comunicacao com o nucleo.";
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === placeholderId ? { ...m, content: `◌ ${msg}`, loading: false } : m,
          ),
          loading: false,
          activeTools: [],
        }));
      } finally {
        inFlight = false;
      }
      return;
    }

    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === placeholderId
          ? { ...m, id: `a-${Date.now()}`, content: streamedText || "(sem resposta)", loading: false }
          : m,
      ),
      loading: false,
      activeTools: [],
    }));
    inFlight = false;
  },

  loadConversation: async (id) => {
    if (!id) { get().reset(); return; }
    try {
      const data = await api.getChatHistory(id);
      if (!data?.messages) return;
      const msgs: ChatMessage[] = data.messages.map((m: { id: string; role: string; content: string }) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      set({ messages: msgs, conversationId: id, activeTools: [] });
    } catch { /* silent */ }
  },

  reset: () => set({ messages: [], conversationId: null, input: "", loading: false, activeTools: [] }),
}));
