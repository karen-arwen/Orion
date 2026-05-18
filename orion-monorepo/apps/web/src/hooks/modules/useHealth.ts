import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EnergyLog } from "@orion/types";
import { api } from "../../lib/api.js";

export function useEnergyToday(): ReturnType<typeof useQuery<EnergyLog[]>> {
  return useQuery({
    queryKey: ["health", "today"],
    queryFn: () => api.health.today(),
    staleTime: 30_000,
  });
}

export function useEnergyHeatmap(): ReturnType<
  typeof useQuery<Awaited<ReturnType<typeof api.health.heatmap>>>
> {
  return useQuery({
    queryKey: ["health", "heatmap"],
    queryFn: () => api.health.heatmap(),
    staleTime: 60_000,
  });
}

export function useLogEnergy(): ReturnType<
  typeof useMutation<{ id: string }, Error, { value: number; note?: string }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ value, note }: { value: number; note?: string }) =>
      api.health.log(value, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["health"] });
    },
  });
}
