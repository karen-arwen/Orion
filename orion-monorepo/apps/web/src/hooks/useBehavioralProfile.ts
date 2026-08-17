import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import type { BehavioralProfileResult } from "../lib/api.js";

export function useBehavioralProfile() {
  return useQuery<BehavioralProfileResult | null>({
    queryKey: ["behavioral-profile"],
    queryFn: () => api.getBehavioralProfile(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnalyzeBehavioralProfile() {
  const qc = useQueryClient();
  return useMutation<BehavioralProfileResult, Error>({
    mutationFn: async () => { const r = await api.analyzeBehavioralProfile(); if (!r) throw new Error("no profile"); return r; },
    onSuccess: (data) => qc.setQueryData(["behavioral-profile"], data),
  });
}
