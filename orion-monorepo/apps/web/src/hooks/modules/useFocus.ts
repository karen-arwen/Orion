import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FocusSession } from "@orion/types";
import { api } from "../../lib/api.js";

export function useFocusToday(): ReturnType<typeof useQuery<FocusSession[]>> {
  return useQuery({
    queryKey: ["focus", "today"],
    queryFn: () => api.focus.today(),
    staleTime: 10_000,
  });
}

export function useFocusWeekly(): ReturnType<
  typeof useQuery<Array<{ date: string; minutes: number }>>
> {
  return useQuery({
    queryKey: ["focus", "weekly"],
    queryFn: () => api.focus.weekly(),
    staleTime: 60_000,
  });
}

export function useStartFocus(): ReturnType<
  typeof useMutation<{ id: string; duration: number; startedAt: string }, Error, number>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (duration: number) => api.focus.start(duration),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["focus"] });
    },
  });
}

export function useCompleteFocus(): ReturnType<
  typeof useMutation<{ id: string; actualMinutes: number }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.focus.complete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["focus"] });
    },
  });
}

export function useInterruptFocus(): ReturnType<
  typeof useMutation<{ id: string; actualMinutes: number }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.focus.interrupt(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["focus"] });
    },
  });
}
