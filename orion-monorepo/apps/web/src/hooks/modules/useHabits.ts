import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Habit } from "@orion/types";
import { api } from "../../lib/api.js";

interface HabitWithLogs extends Habit {
  recentLogs: Record<string, boolean>;
}

export function useHabits(): ReturnType<typeof useQuery<HabitWithLogs[]>> {
  return useQuery({
    queryKey: ["habits"],
    queryFn: () => api.habits.list(),
    staleTime: 30_000,
  });
}

export function useCreateHabit(): ReturnType<
  typeof useMutation<
    { id: string },
    Error,
    { name: string; frequency?: string; color?: string; icon?: string }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.habits.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useToggleHabit(): ReturnType<
  typeof useMutation<
    { checked: boolean; streak: number; bestStreak: number },
    Error,
    string
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.habits.toggle(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useDeleteHabit(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.habits.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}
