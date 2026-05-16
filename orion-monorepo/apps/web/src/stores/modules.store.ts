import { create } from "zustand";
import type { ModuleId } from "@orion/types";
import { api } from "../lib/api.js";

interface ModulesStore {
  enabled: Set<ModuleId>;
  fetch: () => Promise<void>;
  toggle: (id: ModuleId, enabled: boolean) => Promise<void>;
  isEnabled: (id: ModuleId) => boolean;
}

export const useModulesStore = create<ModulesStore>((set, get) => ({
  enabled: new Set<ModuleId>(),

  fetch: async () => {
    try {
      const list = await api.listIntegrations(); // placeholder — backend lê de /modules/active
      // Em produção: api.listActiveModules(). Por enquanto, set vazio.
      void list;
      set({ enabled: new Set<ModuleId>() });
    } catch {
      // Silencioso
    }
  },

  toggle: async (id, enabled) => {
    const next = new Set(get().enabled);
    if (enabled) next.add(id);
    else next.delete(id);
    set({ enabled: next });
    try {
      await api.toggleModule(id, enabled);
    } catch {
      // Rollback otimista
      const rollback = new Set(get().enabled);
      if (enabled) rollback.delete(id);
      else rollback.add(id);
      set({ enabled: rollback });
    }
  },

  isEnabled: (id) => get().enabled.has(id),
}));
