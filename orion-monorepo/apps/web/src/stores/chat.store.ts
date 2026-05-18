import { create } from "zustand";
import type { ChatMessage, UserProfile } from "@orion/types";
import { api, ApiClientError, streamChat } from "../lib/api.js";

interface ChatStore {
  messages: ChatMessage[];
  conversationId: string | null;
  input: string;
  loading: boolean;
  setInput: (v: string) => void;
  bootstrapWelcome: (profile: UserProfile) => void;
  send: (override?: string) => Promise<void>;
  reset: () => void;
}

let inFlight = false;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  conversationId: null,
  input: "",
  loading: false,

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
    }));

    // ── 1ª tentativa: STREAMING ────────────────────────────────
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

    // ── 2ª tentativa: se stream sinalizou tool_use OU falhou sem nada streamado ──
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
        }));
      } catch (err) {
        const msg = err instanceof ApiClientError ? err.message : "Falha na comunicação com o núcleo.";
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === placeholderId
              ? { ...m, content: `◌ ${msg}`, loading: false }
              : m,
          ),
          loading: false,
        }));
      } finally {
        inFlight = false;
      }
      return;
    }

    // ── Sucesso do stream: tira o flag loading ────────────────────
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === placeholderId
          ? { ...m, id: `a-${Date.now()}`, content: streamedText || "(sem resposta)", loading: false }
          : m,
      ),
      loading: false,
    }));
    inFlight = false;
  },

  reset: () => set({ messages: [], conversationId: null, input: "", loading: false }),
}));
