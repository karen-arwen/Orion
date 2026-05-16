import { create } from "zustand";
import type { ChatMessage, UserProfile } from "@orion/types";
import { api, ApiClientError } from "../lib/api.js";

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
  },

  reset: () => set({ messages: [], conversationId: null, input: "", loading: false }),
}));
