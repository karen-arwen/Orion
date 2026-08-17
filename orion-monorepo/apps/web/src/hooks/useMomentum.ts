import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export interface MomentumBreakdown {
  score: number;
  sleep: number;
  focus: number;
  habits: number;
  mood: number;
  productivity: number;
  trend: "rising" | "stable" | "falling";
  insight: string;
}

export function useMomentum() {
  return useQuery<MomentumBreakdown>({
    queryKey: ["momentum"],
    queryFn: () => api.getMomentum() as Promise<MomentumBreakdown>,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}
