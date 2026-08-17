import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

export function useTimeline(filters?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ["timeline", "items", filters],
    queryFn: () => api.timeline.list(filters),
  });
}

export function useTimelineStats() {
  return useQuery({
    queryKey: ["timeline", "stats"],
    queryFn: () => api.timeline.stats(),
  });
}

export function useCreateTimelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.timeline.create(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["timeline"] }); },
  });
}

export function useUpdateTimelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Record<string, unknown> & { id: string }) =>
      api.timeline.update(id, input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["timeline"] }); },
  });
}

export function useDeleteTimelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.timeline.remove(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["timeline"] }); },
  });
}
