import { create } from "zustand";
import type { OrionMode, UserProfile, UserVitals } from "@orion/types";
import { api } from "../lib/api.js";

interface UserStore {
  profile: UserProfile | null;
  mode: OrionMode;
  vitals: UserVitals;
  connectedProviders: string[];
  hydrate: (p: UserProfile) => void;
  setMode: (m: OrionMode) => void;
  setVitals: (v: Partial<UserVitals>) => void;
  refreshIntegrations: () => Promise<void>;
}

/**
 * Estado global do usuário.
 * Carregado no boot por OrionLayout via Clerk + (opcional) GET /v1/user/profile.
 */
export const useUserStore = create<UserStore>((set, get) => ({
  profile: null,
  mode: "NORMAL",
  vitals: { energy: 78, focus: 62, mood: 85 },
  connectedProviders: [],

  hydrate: (p) => set({ profile: p, mode: p.mode }),

  setMode: (m) => {
    set({ mode: m });
    // Sync com o backend — silenciosamente, sem bloquear UI
    void api.setMode(m).catch(() => undefined);
  },

  setVitals: (v) => set({ vitals: { ...get().vitals, ...v } }),

  refreshIntegrations: async () => {
    try {
      const list = await api.listIntegrations();
      set({ connectedProviders: list.filter((i) => i.status === "connected").map((i) => i.provider) });
    } catch {
      // Sem auth ou sem rede: mantém vazio
    }
  },
}));
