import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskCreateInput, TaskUpdateInput } from "@orion/types";
import { api } from "../../lib/api.js";

export function useTasks(): ReturnType<typeof useQuery<Task[]>> {
  return useQuery({
    queryKey: ["life", "tasks"],
    queryFn: () => api.life.list(),
    staleTime: 30_000,
  });
}

export function useCreateTask(): ReturnType<typeof useMutation<Task, Error, TaskCreateInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCreateInput) => api.life.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["life", "tasks"] });
    },
  });
}

export function useUpdateTask(): ReturnType<typeof useMutation<Task, Error, TaskUpdateInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskUpdateInput) => api.life.update(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["life", "tasks"] });
    },
  });
}

export function useDeleteTask(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.life.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["life", "tasks"] });
    },
  });
}

export function useSuggestNext(): ReturnType<
  typeof useMutation<{ suggestion: string }, Error, 1 | 2 | 3>
> {
  return useMutation({
    mutationFn: (energy: 1 | 2 | 3) => api.life.suggestNext(energy),
  });
}
