import { create } from "zustand";
import type { Project } from "@orion/types";
import { api } from "../lib/api.js";

interface ProjectsStore {
  projects: Project[];
  fetch: () => Promise<void>;
}

export const useProjectsStore = create<ProjectsStore>((set) => ({
  projects: [],

  fetch: async () => {
    try {
      const list = await api.listProjects();
      set({ projects: list });
    } catch {
      // Sem auth / sem backend — UI segue funcional com lista vazia
    }
  },
}));
