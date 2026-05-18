import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SleepLog, SleepStats } from "@orion/types";
import { api } from "../../lib/api.js";

export function useSleepRecent(): ReturnType<typeof useQuery<SleepLog[]>> {
  return useQuery({
    queryKey: ["sleep", "recent"],
    queryFn: () => api.sleep.recent() as Promise<SleepLog[]>,
    staleTime: 60_000,
  });
}

export function useSleepStats(): ReturnType<typeof useQuery<SleepStats>> {
  return useQuery({
    queryKey: ["sleep", "stats"],
    queryFn: () => api.sleep.stats(),
    staleTime: 60_000,
  });
}

export function useLogSleep(): ReturnType<
  typeof useMutation<
    SleepLog,
    Error,
    { bedTime: string; wakeTime: string; quality: number; notes?: string }
  >
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.sleep.log(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sleep"] });
    },
  });
}
