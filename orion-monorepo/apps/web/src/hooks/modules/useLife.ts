import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskCreateInput, TaskUpdateInput } from "@orion/types";
import { api } from "../../lib/api.js";

const QK = ["life", "tasks"] as const;

export function useTasks(): ReturnType<typeof useQuery<Task[]>> {
  return useQuery({
    queryKey: QK,
    queryFn: () => api.life.list(),
    staleTime: 30_000,
  });
}

export function useAllTasks(): ReturnType<typeof useQuery<Task[]>> {
  return useQuery({
    queryKey: ["life", "all"],
    queryFn: () => api.life.listAll(),
    staleTime: 30_000,
  });
}

export function useTasksByDate(date: string): ReturnType<typeof useQuery<Task[]>> {
  return useQuery({
    queryKey: ["life", "by-date", date],
    queryFn: () => api.life.listByDate(date),
    staleTime: 30_000,
    enabled: !!date,
  });
}

export function useOverdueTasks(): ReturnType<typeof useQuery<Task[]>> {
  return useQuery({
    queryKey: ["life", "overdue"],
    queryFn: () => api.life.listOverdue(),
    staleTime: 60_000,
  });
}

export function useCreateTask(): ReturnType<typeof useMutation<Task, Error, TaskCreateInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCreateInput) => api.life.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["life"] });
    },
  });
}

export function useUpdateTask(): ReturnType<typeof useMutation<Task, Error, TaskUpdateInput>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskUpdateInput) => api.life.update(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["life"] });
    },
  });
}

export function useDeleteTask(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.life.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["life"] });
    },
  });
}

export function useCompleteRecurring(): ReturnType<typeof useMutation<Task, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.life.completeRecurring(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["life"] });
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
