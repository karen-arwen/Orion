import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

const KEYS = {
  list: ["projects"] as const,
  get: (id: string) => ["projects", id] as const,
  stalled: ["projects", "stalled"] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: () => api.projects.list(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: KEYS.get(id),
    queryFn: () => api.projects.get(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
}

export function useStalledProjects() {
  return useQuery({
    queryKey: KEYS.stalled,
    queryFn: () => api.projects.stalled(),
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.projects.create(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.projects.update(id, patch),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["projects"] }); },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projects.remove(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}

export function useAddMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { title: string; description?: string; dueDate?: string } }) =>
      api.projects.addMilestone(id, input),
    onSuccess: (_data, { id }) => { void qc.invalidateQueries({ queryKey: ["projects", id] }); void qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}

export function useCompleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, msId }: { id: string; msId: string }) =>
      api.projects.completeMilestone(id, msId),
    onSuccess: (_data, { id }) => { void qc.invalidateQueries({ queryKey: ["projects", id] }); void qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}

export function useRemoveMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, msId }: { id: string; msId: string }) =>
      api.projects.removeMilestone(id, msId),
    onSuccess: (_data, { id }) => { void qc.invalidateQueries({ queryKey: ["projects", id] }); void qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}
