import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

export function useRoutines() {
  return useQuery({ queryKey: ["routines"], queryFn: () => api.routines.list(), staleTime: 30_000 });
}

export function useRoutineToday(id: string) {
  return useQuery({ queryKey: ["routines", id, "today"], queryFn: () => api.routines.today(id), staleTime: 10_000 });
}

export function useRoutineHistory(id: string, days = 30) {
  return useQuery({ queryKey: ["routines", id, "history", days], queryFn: () => api.routines.history(id, days), staleTime: 60_000 });
}

export function useRoutineNudge(id: string, enabled = true) {
  return useQuery({ queryKey: ["routines", id, "nudge"], queryFn: () => api.routines.nudge(id), enabled, staleTime: 300_000 });
}

export function useCreateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.routines.create(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["routines"] }); },
  });
}

export function useUpdateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => api.routines.update(id, patch),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["routines"] }); },
  });
}

export function useDeleteRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.routines.remove(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["routines"] }); },
  });
}

export function useStartRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.routines.start(id),
    onSuccess: (_d, id) => { void qc.invalidateQueries({ queryKey: ["routines", id, "today"] }); },
  });
}

export function useCompleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stepId }: { id: string; stepId: string }) => api.routines.completeStep(id, stepId),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: ["routines", id, "today"] });
      void qc.invalidateQueries({ queryKey: ["quest", "profile"] });
    },
  });
}
