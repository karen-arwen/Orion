import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

export function useQuestProfile() {
  return useQuery({
    queryKey: ["quest", "profile"],
    queryFn: () => api.quest.profile(),
    staleTime: 30_000,
  });
}

export function useAwardXp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, xp, module: mod }: { action: string; xp: number; module?: string }) =>
      api.quest.award(action, xp, mod),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["quest", "profile"] }); },
  });
}

export function useQuestProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questId, increment }: { questId: string; increment?: number }) =>
      api.quest.progress(questId, increment),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["quest", "profile"] }); },
  });
}
